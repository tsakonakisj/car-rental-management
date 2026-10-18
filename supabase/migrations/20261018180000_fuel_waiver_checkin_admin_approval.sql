-- Fuel-shortage exceptions are recorded atomically with the actual vehicle return.
CREATE TABLE IF NOT EXISTS public.fuel_waiver_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE RESTRICT,
 checkin_id uuid NOT NULL UNIQUE REFERENCES public.checkins(id) ON DELETE RESTRICT,
 requested_by uuid NOT NULL REFERENCES public.users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(btrim(reason))>=5),
 checkout_fuel integer NOT NULL,
 checkin_fuel integer NOT NULL,
 fuel_liters numeric NOT NULL CHECK(fuel_liters>0),
 fuel_price_per_liter numeric(10,2) NOT NULL CHECK(fuel_price_per_liter>0),
 proposed_charge numeric(12,2) NOT NULL CHECK(proposed_charge>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES public.users(id),
 reviewed_at timestamptz,
 admin_note text,
 CONSTRAINT fuel_waiver_review_consistency CHECK (
 (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_fuel_waiver_pending ON public.fuel_waiver_requests(status,requested_at);
ALTER TABLE public.fuel_waiver_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY fuel_waiver_admin_read ON public.fuel_waiver_requests
 FOR SELECT TO authenticated USING(public.get_current_role()='admin');
REVOKE ALL ON public.fuel_waiver_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fuel_waiver_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_vehicle_checkin_v2(p_reservation_id uuid, p_fuel_level integer, p_odometer integer, p_new_damages jsonb, p_additional_charges jsonb, p_fuel_price numeric, p_fuel_waiver_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_reservation public.reservations%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_checkout_odometer integer;
  v_actor uuid;
  v_damage jsonb;
  v_charge jsonb;
  v_damage_ids uuid[] := ARRAY[]::uuid[];
  v_damage_id uuid;
  v_cost numeric;
  v_checkout_fuel integer;
  v_shortfall integer;
  v_expected numeric;
  v_fuel_count integer;
BEGIN
  IF COALESCE((SELECT public.get_current_role()), '') NOT IN ('admin','manager','agent') THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:ROLE';
  END IF;
  SELECT id INTO v_actor FROM public.users
    WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'CHECKIN_DENIED:USER'; END IF;
  SELECT * INTO v_reservation FROM public.reservations
    WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.vehicle_id IS NULL
     OR v_reservation.status <> 'active' THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:RESERVATION_STATUS';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE id = v_reservation.vehicle_id FOR UPDATE;
  IF NOT FOUND OR v_vehicle.status <> 'rented' THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:VEHICLE_STATUS';
  END IF;
  SELECT odometer, fuel_level INTO v_checkout_odometer, v_checkout_fuel FROM public.checkouts
    WHERE reservation_id = p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKIN_DENIED:NO_CHECKOUT'; END IF;
  IF EXISTS (SELECT 1 FROM public.checkins WHERE reservation_id = p_reservation_id) THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:ALREADY_DONE';
  END IF;
  IF p_fuel_level IS NULL OR p_fuel_level NOT BETWEEN 0 AND 100
     OR p_odometer IS NULL OR p_odometer < GREATEST(
       COALESCE(v_checkout_odometer,0),COALESCE(v_vehicle.odometer,0)) THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:MEASUREMENTS';
  END IF;
  IF p_new_damages IS NULL OR jsonb_typeof(p_new_damages) <> 'array'
     OR jsonb_array_length(p_new_damages) > 100
     OR p_additional_charges IS NULL OR jsonb_typeof(p_additional_charges) <> 'array'
     OR jsonb_array_length(p_additional_charges) > 100 THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:PAYLOAD';
  END IF;

  FOR v_damage IN SELECT value FROM jsonb_array_elements(p_new_damages) AS t(value) LOOP
    IF jsonb_typeof(v_damage) <> 'object'
       OR NULLIF(btrim(v_damage->>'description'), '') IS NULL
       OR length(v_damage->>'description') > 2000 THEN
      RAISE EXCEPTION 'CHECKIN_DENIED:DAMAGES';
    END IF;
    v_cost := NULL;
    IF v_damage ? 'estimated_cost' AND v_damage->>'estimated_cost' IS NOT NULL THEN
      v_cost := (v_damage->>'estimated_cost')::numeric;
      IF v_cost < 0 THEN RAISE EXCEPTION 'CHECKIN_DENIED:DAMAGES'; END IF;
    END IF;
    INSERT INTO public.damages (description, estimated_cost)
      VALUES (btrim(v_damage->>'description'), v_cost)
      RETURNING id INTO v_damage_id;
    v_damage_ids := array_append(v_damage_ids, v_damage_id);
  END LOOP;

  FOR v_charge IN SELECT value FROM jsonb_array_elements(p_additional_charges) AS t(value) LOOP
    IF jsonb_typeof(v_charge) <> 'object'
       OR NULLIF(btrim(v_charge->>'type'), '') IS NULL
       OR COALESCE(jsonb_typeof(v_charge->'amount'), '') <> 'number'
       OR (v_charge->>'amount')::numeric < 0 THEN
      RAISE EXCEPTION 'CHECKIN_DENIED:CHARGES';
    END IF;
  END LOOP;

  v_shortfall := GREATEST(0, v_checkout_fuel - p_fuel_level);
  IF v_shortfall > 0 THEN
    IF v_vehicle.fuel_tank_capacity IS NULL OR v_vehicle.fuel_tank_capacity <= 0 OR p_fuel_price IS NULL
      OR p_fuel_price <= 0 OR p_fuel_price <> round(p_fuel_price,2) THEN
      RAISE EXCEPTION 'CHECKIN_DENIED:FUEL_CALCULATION_REQUIRED';
    END IF;
    v_expected := round(v_shortfall::numeric / 100 * v_vehicle.fuel_tank_capacity * p_fuel_price,2);
    SELECT count(*) INTO v_fuel_count FROM jsonb_array_elements(p_additional_charges) e
      WHERE e->>'type'='Καύσιμο';
    IF length(btrim(coalesce(p_fuel_waiver_reason,''))) >= 5 THEN
      IF v_fuel_count <> 0 THEN RAISE EXCEPTION 'CHECKIN_DENIED:FUEL_WAIVER_WITH_CHARGE'; END IF;
    ELSE
      IF v_fuel_count <> 1 OR NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(p_additional_charges) e
        WHERE e->>'type'='Καύσιμο' AND (e->>'amount')::numeric=v_expected
      ) THEN RAISE EXCEPTION 'CHECKIN_DENIED:FUEL_CHARGE_REQUIRED'; END IF;
    END IF;
  ELSIF nullif(btrim(coalesce(p_fuel_waiver_reason,'')),'') IS NOT NULL THEN
    RAISE EXCEPTION 'CHECKIN_DENIED:NO_FUEL_SHORTAGE';
  END IF;

  INSERT INTO public.checkins (
    reservation_id, fuel_level, odometer, new_damage_ids,
    additional_charges, checked_in_by, checked_in_at
  ) VALUES (
    p_reservation_id, p_fuel_level, p_odometer,
    v_damage_ids, p_additional_charges, v_actor, now()
  );

  IF v_shortfall > 0 AND length(btrim(coalesce(p_fuel_waiver_reason,''))) >= 5 THEN
    INSERT INTO public.fuel_waiver_requests(
      reservation_id, checkin_id, requested_by, reason, checkout_fuel,
      checkin_fuel, fuel_liters, fuel_price_per_liter, proposed_charge
    )
    SELECT p_reservation_id, ci.id, v_actor, btrim(p_fuel_waiver_reason),
      v_checkout_fuel, p_fuel_level, v_shortfall::numeric / 100 * v_vehicle.fuel_tank_capacity,
      p_fuel_price, v_expected
    FROM public.checkins ci WHERE ci.reservation_id=p_reservation_id;
  END IF;
  UPDATE public.reservations SET status = 'completed', updated_at = now()
    WHERE id = p_reservation_id;
  UPDATE public.vehicles SET current_station_id = v_reservation.return_station_id,
    status = 'available', odometer = p_odometer,
    updated_at = now() WHERE id = v_vehicle.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.review_fuel_waiver(p_request_id uuid, p_approve boolean, p_admin_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_req public.fuel_waiver_requests%ROWTYPE;v_actor uuid;
BEGIN
 IF public.get_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:ADMIN_ONLY'; END IF;
 IF p_approve IS NULL OR length(btrim(coalesce(p_admin_note,'')))<5 THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:NOTE_REQUIRED'; END IF;
 SELECT id INTO v_actor FROM public.users WHERE auth_user_id=(SELECT auth.uid()) AND active=true LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:USER_NOT_FOUND'; END IF;
 SELECT * INTO v_req FROM public.fuel_waiver_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status<>'pending' THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:NOT_PENDING'; END IF;
 IF NOT p_approve THEN
   UPDATE public.checkins SET additional_charges=coalesce(additional_charges,'[]'::jsonb)
     ||jsonb_build_array(jsonb_build_object('type','Καύσιμο','amount',v_req.proposed_charge,
       'description','Χρέωση μετά από απόρριψη εξαίρεσης καυσίμου #'||left(v_req.id::text,8)))
   WHERE id=v_req.checkin_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:CHECKIN_NOT_FOUND'; END IF;
 END IF;
 UPDATE public.fuel_waiver_requests SET
   status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   reviewed_by=v_actor,reviewed_at=now(),admin_note=btrim(p_admin_note)
 WHERE id=p_request_id;
END $function$
;
REVOKE ALL ON FUNCTION public.complete_vehicle_checkin(uuid,integer,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_vehicle_checkin_v2(uuid,integer,integer,jsonb,jsonb,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_vehicle_checkin_v2(uuid,integer,integer,jsonb,jsonb,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_fuel_waiver(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_fuel_waiver(uuid,boolean,text) TO authenticated;