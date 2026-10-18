-- Additive: existing returns, payments, refunds and rental statuses are not rewritten.
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS correction_revision integer NOT NULL DEFAULT 0;

CREATE TABLE public.checkin_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE RESTRICT,
  corrected_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_name text NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 2000),
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL
);
CREATE INDEX checkin_corrections_history ON public.checkin_corrections(checkin_id, corrected_at);
ALTER TABLE public.checkin_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_corrections_admin_read ON public.checkin_corrections
  FOR SELECT TO authenticated USING ((SELECT public.get_current_role()) = 'admin');
REVOKE ALL ON public.checkin_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.checkin_corrections TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_checkin_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.correction_revision := OLD.correction_revision + 1;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bump_checkin_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER checkin_revision BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.bump_checkin_revision();
-- Corrections and waiver decisions must go through their validated RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.checkins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_checkin_correction_context(p_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.get_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:ADMIN_ONLY';
  END IF;
  SELECT jsonb_build_object(
    'checkin', to_jsonb(ci), 'checkout_fuel', co.fuel_level, 'checkout_odometer', co.odometer,
    'tank_capacity', v.fuel_tank_capacity,
    'waiver', (SELECT jsonb_build_object('status', w.status) FROM public.fuel_waiver_requests w WHERE w.checkin_id = ci.id),
    'history', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.corrected_at DESC, h.id) FROM public.checkin_corrections h WHERE h.checkin_id = ci.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.checkins ci JOIN public.reservations r ON r.id = ci.reservation_id
    JOIN public.checkouts co ON co.reservation_id = r.id JOIN public.vehicles v ON v.id = r.vehicle_id
  WHERE r.id = p_reservation_id AND r.status = 'completed';
  IF v_result IS NULL THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:NOT_COMPLETED'; END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.correct_vehicle_checkin(
  p_reservation_id uuid, p_expected_revision integer, p_fuel_level integer,
  p_odometer integer, p_fuel_price numeric, p_non_fuel_charges jsonb, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
  v_ci public.checkins%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_actor uuid; v_actor_name text; v_before jsonb; v_after jsonb;
  v_has_waiver boolean; v_co_fuel integer; v_co_odometer integer;
  v_charge jsonb; v_charges jsonb := '[]'::jsonb; v_fuel_charges jsonb;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR public.get_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:ADMIN_ONLY';
  END IF;
  SELECT id, name INTO v_actor, v_actor_name FROM public.users WHERE auth_user_id = auth.uid() AND active = true;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:USER'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:REASON';
  END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_res.status <> 'completed' THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:NOT_COMPLETED'; END IF;
  -- Same lock order as review_fuel_waiver: waiver before checkin.
  PERFORM id FROM public.fuel_waiver_requests WHERE reservation_id = p_reservation_id FOR UPDATE;
  v_has_waiver := FOUND;
  SELECT * INTO v_ci FROM public.checkins WHERE reservation_id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:NO_CHECKIN'; END IF;
  IF p_expected_revision IS DISTINCT FROM v_ci.correction_revision THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:STALE'; END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_res.vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:NO_VEHICLE'; END IF;
  SELECT fuel_level, odometer INTO v_co_fuel, v_co_odometer FROM public.checkouts WHERE reservation_id = p_reservation_id;
  IF NOT FOUND OR v_co_fuel IS NULL THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:NO_CHECKOUT'; END IF;
  IF p_fuel_level IS NULL OR p_fuel_level NOT BETWEEN 0 AND 100 OR p_odometer IS NULL OR p_odometer < v_co_odometer THEN
    RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:MEASUREMENTS';
  END IF;
  IF p_non_fuel_charges IS NULL OR jsonb_typeof(p_non_fuel_charges) <> 'array' THEN
    RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:CHARGES';
  END IF;
  IF jsonb_array_length(p_non_fuel_charges) > 100 THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:CHARGES'; END IF;
  FOR v_charge IN SELECT value FROM jsonb_array_elements(p_non_fuel_charges) LOOP
    IF jsonb_typeof(v_charge) <> 'object' OR NULLIF(btrim(v_charge->>'type'),'') IS NULL
      OR length(v_charge->>'type') > 100 OR btrim(v_charge->>'type') = 'Καύσιμο'
      OR COALESCE(jsonb_typeof(v_charge->'amount'),'') <> 'number'
      OR (v_charge->>'amount')::numeric < 0 OR (v_charge->>'amount')::numeric > 999999.99
      OR (v_charge->>'amount')::numeric <> round((v_charge->>'amount')::numeric, 2)
      OR length(COALESCE(v_charge->>'description','')) > 2000 THEN
      RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:CHARGES';
    END IF;
    v_charges := v_charges || jsonb_build_array(jsonb_build_object('type', btrim(v_charge->>'type'),
      'amount', (v_charge->>'amount')::numeric, 'description', COALESCE(v_charge->>'description','')));
  END LOOP;
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_fuel_charges
    FROM jsonb_array_elements(COALESCE(v_ci.additional_charges,'[]'::jsonb)) e WHERE e->>'type' = 'Καύσιμο';
  IF v_has_waiver THEN
    IF p_fuel_level <> v_ci.fuel_level OR p_fuel_price IS NOT NULL THEN RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:FUEL_LOCKED'; END IF;
  ELSIF p_fuel_level <> v_ci.fuel_level OR p_fuel_price IS NOT NULL THEN
    v_fuel_charges := '[]'::jsonb;
    IF p_fuel_level < v_co_fuel THEN
      IF v_vehicle.fuel_tank_capacity IS NULL OR v_vehicle.fuel_tank_capacity <= 0
        OR p_fuel_price IS NULL OR p_fuel_price::text IN ('NaN','Infinity','-Infinity')
        OR p_fuel_price <= 0 OR p_fuel_price > 100 OR p_fuel_price <> round(p_fuel_price,2) THEN
        RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:FUEL_PRICE';
      END IF;
      v_amount := round((v_co_fuel - p_fuel_level)::numeric / 100 * v_vehicle.fuel_tank_capacity * p_fuel_price,2);
      v_fuel_charges := jsonb_build_array(jsonb_build_object('type','Καύσιμο','amount',v_amount,'description','Διόρθωση ελλείμματος καυσίμου από Admin'));
    END IF;
  END IF;
  v_charges := v_charges || v_fuel_charges;
  IF p_odometer <> v_ci.odometer THEN
    IF v_vehicle.odometer IS DISTINCT FROM v_ci.odometer OR v_vehicle.status = 'rented'
      OR EXISTS (SELECT 1 FROM public.checkouts co JOIN public.reservations r ON r.id = co.reservation_id
        WHERE r.vehicle_id = v_res.vehicle_id AND co.reservation_id <> p_reservation_id
          AND (co.checked_out_at >= v_ci.checked_in_at OR co.checked_out_at IS NULL))
      OR EXISTS (SELECT 1 FROM public.checkins ci JOIN public.reservations r ON r.id = ci.reservation_id
        WHERE r.vehicle_id = v_res.vehicle_id AND ci.id <> v_ci.id
          AND (ci.checked_in_at >= v_ci.checked_in_at OR ci.checked_in_at IS NULL)) THEN
      RAISE EXCEPTION 'CHECKIN_CORRECTION_DENIED:LATER_MOVEMENT';
    END IF;
    UPDATE public.vehicles SET odometer = p_odometer, updated_at = now() WHERE id = v_vehicle.id;
  END IF;
  v_before := to_jsonb(v_ci);
  UPDATE public.checkins SET fuel_level = p_fuel_level, odometer = p_odometer, additional_charges = v_charges
    WHERE id = v_ci.id RETURNING to_jsonb(checkins) INTO v_after;
  INSERT INTO public.checkin_corrections(checkin_id, corrected_by, actor_name, reason, before_data, after_data)
    VALUES (v_ci.id, v_actor, COALESCE(v_actor_name,'Admin'), btrim(p_reason), v_before, v_after);
END $$;

REVOKE ALL ON FUNCTION public.get_checkin_correction_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_vehicle_checkin(uuid,integer,integer,integer,numeric,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_checkin_correction_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_vehicle_checkin(uuid,integer,integer,integer,numeric,jsonb,text) TO authenticated;
