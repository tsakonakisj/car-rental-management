-- Preserve every return and decision. Only non-voided returns contribute to current balances.
ALTER TABLE public.checkins ADD COLUMN voided_at timestamptz;
ALTER TABLE public.checkins ADD COLUMN voided_by uuid REFERENCES public.users(id);
ALTER TABLE public.checkins ADD COLUMN void_reason text;
ALTER TABLE public.fuel_waiver_requests ADD COLUMN voided_at timestamptz;
-- Replace uniqueness, without deleting any records, to allow a new return after reversal.
DROP INDEX public.checkins_reservation_id_unique;
CREATE UNIQUE INDEX checkins_reservation_id_unique ON public.checkins(reservation_id) WHERE voided_at IS NULL;
ALTER TABLE public.fuel_waiver_requests DROP CONSTRAINT fuel_waiver_requests_reservation_id_key;
ALTER TABLE public.fuel_waiver_requests DROP CONSTRAINT fuel_waiver_requests_checkin_id_key;
CREATE UNIQUE INDEX fuel_waiver_one_current_reservation ON public.fuel_waiver_requests(reservation_id) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX fuel_waiver_one_current_checkin ON public.fuel_waiver_requests(checkin_id) WHERE voided_at IS NULL;

CREATE VIEW public.current_checkins WITH (security_invoker = true) AS SELECT * FROM public.checkins WHERE voided_at IS NULL;
REVOKE ALL ON public.current_checkins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.current_checkins TO authenticated;

CREATE TABLE public.reservation_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.users(id), actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL,
  previous_status text NOT NULL, next_status text NOT NULL,
  snapshot jsonb NOT NULL
);
CREATE INDEX reservation_status_events_reservation ON public.reservation_status_events(reservation_id,created_at);
CREATE INDEX reservation_status_events_actor ON public.reservation_status_events(actor_id);
ALTER TABLE public.reservation_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_events_admin_read ON public.reservation_status_events FOR SELECT TO authenticated
  USING ((SELECT public.get_current_role())='admin');
REVOKE ALL ON public.reservation_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reservation_status_events TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_vehicle_return(p_reservation_id uuid, p_checkin_id uuid, p_revision integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_res public.reservations%ROWTYPE; v_ci public.checkins%ROWTYPE; v_vehicle public.vehicles%ROWTYPE;
  v_actor uuid; v_name text; v_snapshot jsonb; v_checkout_odometer integer;
BEGIN
  IF auth.uid() IS NULL OR public.get_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'RETURN_DENIED:ADMIN_ONLY'; END IF;
  SELECT id,name INTO v_actor,v_name FROM public.users WHERE auth_user_id=auth.uid() AND active=true;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'RETURN_DENIED:ADMIN_ONLY'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'RETURN_DENIED:REASON'; END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_res.status<>'completed' THEN RAISE EXCEPTION 'RETURN_DENIED:STATUS'; END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=v_res.vehicle_id FOR UPDATE;
  IF NOT FOUND OR v_vehicle.status NOT IN ('available','reserved') THEN RAISE EXCEPTION 'RETURN_DENIED:VEHICLE'; END IF;
  PERFORM id FROM public.fuel_waiver_requests WHERE reservation_id=p_reservation_id AND voided_at IS NULL FOR UPDATE;
  SELECT * INTO v_ci FROM public.checkins WHERE reservation_id=p_reservation_id AND voided_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_ci.id IS DISTINCT FROM p_checkin_id OR v_ci.correction_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'RETURN_DENIED:STALE'; END IF;
  SELECT odometer INTO v_checkout_odometer FROM public.checkouts WHERE reservation_id=p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RETURN_DENIED:NO_CHECKOUT'; END IF;
  IF v_vehicle.odometer IS DISTINCT FROM v_ci.odometer
    OR EXISTS(SELECT 1 FROM public.checkouts co JOIN public.reservations r ON r.id=co.reservation_id
      WHERE r.vehicle_id=v_res.vehicle_id AND r.id<>p_reservation_id AND (co.checked_out_at>=v_ci.checked_in_at OR co.checked_out_at IS NULL))
    OR EXISTS(SELECT 1 FROM public.checkins ci JOIN public.reservations r ON r.id=ci.reservation_id
      WHERE r.vehicle_id=v_res.vehicle_id AND ci.id<>v_ci.id AND ci.voided_at IS NULL AND (ci.checked_in_at>=v_ci.checked_in_at OR ci.checked_in_at IS NULL)) THEN
    RAISE EXCEPTION 'RETURN_DENIED:LATER_MOVEMENT';
  END IF;
  IF EXISTS(SELECT 1 FROM public.reservations r WHERE r.vehicle_id=v_res.vehicle_id AND r.id<>p_reservation_id
    AND (r.status='active' OR (r.status='upcoming' AND r.pickup_date<GREATEST(v_res.return_date,now()::timestamp)
      AND r.return_date>v_res.pickup_date))) THEN RAISE EXCEPTION 'RETURN_DENIED:CONFLICT'; END IF;
  v_snapshot := jsonb_build_object('checkin',to_jsonb(v_ci),'vehicle',to_jsonb(v_vehicle),
    'waivers',COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.fuel_waiver_requests w WHERE w.checkin_id=v_ci.id),'[]'::jsonb),
    'damages',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.damages d WHERE d.id=ANY(v_ci.new_damage_ids)),'[]'::jsonb));
  UPDATE public.fuel_waiver_requests SET voided_at=now() WHERE checkin_id=v_ci.id AND voided_at IS NULL;
  UPDATE public.checkins SET voided_at=now(),voided_by=v_actor,void_reason=btrim(p_reason) WHERE id=v_ci.id;
  UPDATE public.vehicles SET status='rented',odometer=v_checkout_odometer,current_station_id=v_res.pickup_station_id,updated_at=now() WHERE id=v_res.vehicle_id;
  UPDATE public.reservations SET status='active',updated_at=now() WHERE id=p_reservation_id;
  INSERT INTO public.reservation_status_events(reservation_id,actor_id,actor_name,reason,previous_status,next_status,snapshot)
    VALUES(p_reservation_id,v_actor,COALESCE(v_name,'Admin'),btrim(p_reason),'completed','active',v_snapshot);
END $$;

CREATE OR REPLACE FUNCTION public.change_unstarted_reservation_status(p_reservation_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_res public.reservations%ROWTYPE; v_actor uuid; v_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.has_employee_permission('bookings','edit'),false) THEN RAISE EXCEPTION 'RETURN_DENIED:PERMISSION'; END IF;
  SELECT id,name INTO v_actor,v_name FROM public.users WHERE auth_user_id=auth.uid() AND active=true;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'RETURN_DENIED:PERMISSION'; END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_res.status NOT IN ('upcoming','cancelled') OR p_status IS NULL OR p_status NOT IN ('upcoming','cancelled') THEN RAISE EXCEPTION 'RETURN_DENIED:HANDOVER_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.checkouts WHERE reservation_id=p_reservation_id) THEN RAISE EXCEPTION 'RETURN_DENIED:HAS_CHECKOUT'; END IF;
  UPDATE public.reservations SET status=p_status,updated_at=now() WHERE id=p_reservation_id;
  INSERT INTO public.reservation_status_events(reservation_id,actor_id,actor_name,reason,previous_status,next_status,snapshot)
    VALUES(p_reservation_id,v_actor,COALESCE(v_name,'User'),'Αλλαγή κατάστασης πριν την παράδοση',v_res.status,p_status,to_jsonb(v_res));
END $$;

CREATE OR REPLACE FUNCTION public.guard_reservation_handover_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status='active' THEN
    IF NOT EXISTS(SELECT 1 FROM public.checkouts WHERE reservation_id=OLD.id)
      OR EXISTS(SELECT 1 FROM public.checkins WHERE reservation_id=OLD.id AND voided_at IS NULL) THEN RAISE EXCEPTION 'RETURN_DENIED:HANDOVER_REQUIRED'; END IF;
  ELSIF NEW.status='completed' THEN
    IF OLD.status<>'active' OR NOT EXISTS(SELECT 1 FROM public.checkins WHERE reservation_id=OLD.id AND voided_at IS NULL) THEN RAISE EXCEPTION 'RETURN_DENIED:HANDOVER_REQUIRED'; END IF;
  ELSIF NEW.status IN ('upcoming','cancelled') THEN
    IF EXISTS(SELECT 1 FROM public.checkouts WHERE reservation_id=OLD.id) THEN RAISE EXCEPTION 'RETURN_DENIED:HAS_CHECKOUT'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_handover_status BEFORE UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_handover_status();
REVOKE ALL ON FUNCTION public.guard_reservation_handover_status() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.edit_vehicle_return(
  p_reservation_id uuid, p_checkin_id uuid, p_revision integer, p_fuel_level integer, p_odometer integer,
  p_fuel_price numeric, p_charges jsonb, p_damages jsonb, p_waiver_reason text, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_res public.reservations%ROWTYPE; v_ci public.checkins%ROWTYPE; v_vehicle public.vehicles%ROWTYPE;
  v_waiver record; v_preserve boolean; v_nonfuel jsonb; v_fuel jsonb; v_original_fuel jsonb;
  v_d jsonb; v_damage_id uuid; v_damage_ids uuid[] := ARRAY[]::uuid[];
  v_before jsonb; v_after jsonb; v_audit uuid; v_checkout_fuel integer; v_actor uuid;
  v_expected numeric; v_request boolean;
BEGIN
  IF auth.uid() IS NULL OR public.get_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'RETURN_DENIED:ADMIN_ONLY'; END IF;
  SELECT id INTO v_actor FROM public.users WHERE auth_user_id=auth.uid() AND active=true;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'RETURN_DENIED:ADMIN_ONLY'; END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_res.status<>'completed' THEN RAISE EXCEPTION 'RETURN_DENIED:STATUS'; END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=v_res.vehicle_id FOR UPDATE;
  SELECT * INTO v_waiver FROM public.fuel_waiver_requests WHERE reservation_id=p_reservation_id AND voided_at IS NULL FOR UPDATE;
  SELECT * INTO v_ci FROM public.checkins WHERE reservation_id=p_reservation_id AND voided_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_ci.id IS DISTINCT FROM p_checkin_id OR v_ci.correction_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'RETURN_DENIED:STALE'; END IF;
  SELECT fuel_level INTO v_checkout_fuel FROM public.checkouts WHERE reservation_id=p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RETURN_DENIED:NO_CHECKOUT'; END IF;
  IF p_charges IS NULL OR jsonb_typeof(p_charges)<>'array' OR p_damages IS NULL OR jsonb_typeof(p_damages)<>'array' THEN RAISE EXCEPTION 'RETURN_DENIED:PAYLOAD'; END IF;
  IF jsonb_array_length(p_charges)>100 OR jsonb_array_length(p_damages)>100 THEN RAISE EXCEPTION 'RETURN_DENIED:PAYLOAD'; END IF;
  SELECT COALESCE(jsonb_agg(e),'[]'::jsonb) INTO v_nonfuel FROM jsonb_array_elements(p_charges) e WHERE btrim(e->>'type') IS DISTINCT FROM 'Καύσιμο';
  SELECT COALESCE(jsonb_agg(jsonb_build_object('type','Καύσιμο','amount',(e->>'amount')::numeric,'description',COALESCE(e->>'description',''))),'[]'::jsonb) INTO v_fuel FROM jsonb_array_elements(p_charges) e WHERE btrim(e->>'type')='Καύσιμο';
  SELECT COALESCE(jsonb_agg(jsonb_build_object('type','Καύσιμο','amount',(e->>'amount')::numeric,'description',COALESCE(e->>'description',''))),'[]'::jsonb) INTO v_original_fuel FROM jsonb_array_elements(COALESCE(v_ci.additional_charges,'[]'::jsonb)) e WHERE e->>'type'='Καύσιμο';
  v_request := NULLIF(btrim(COALESCE(p_waiver_reason,'')),'') IS NOT NULL;
  IF v_request AND (length(btrim(p_waiver_reason)) NOT BETWEEN 5 AND 2000 OR p_fuel_level>=v_checkout_fuel OR jsonb_array_length(v_fuel)<>0) THEN RAISE EXCEPTION 'RETURN_DENIED:FUEL'; END IF;
  v_preserve := p_fuel_level=v_ci.fuel_level AND v_fuel=v_original_fuel
    AND ((v_waiver.id IS NULL AND NOT v_request AND p_fuel_price IS NULL)
      OR (v_waiver.id IS NOT NULL AND
        ((v_waiver.status='rejected' AND NOT v_request) OR (v_waiver.status IN ('pending','approved') AND v_request AND btrim(p_waiver_reason)=v_waiver.reason))
        AND (p_fuel_price IS NULL OR p_fuel_price=v_waiver.fuel_price_per_liter)));
  v_before := to_jsonb(v_ci) || jsonb_build_object(
    'damages',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.damages d WHERE d.id=ANY(v_ci.new_damage_ids)),'[]'::jsonb),
    'waivers',COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.fuel_waiver_requests w WHERE w.checkin_id=v_ci.id),'[]'::jsonb));
  IF NOT v_preserve AND v_waiver.id IS NOT NULL THEN
    UPDATE public.fuel_waiver_requests SET voided_at=now() WHERE id=v_waiver.id;
  END IF;
  IF NOT v_preserve AND p_fuel_level<v_checkout_fuel THEN
    IF p_fuel_price IS NULL OR p_fuel_price::text IN ('NaN','Infinity','-Infinity') OR p_fuel_price<=0 OR p_fuel_price>100 OR p_fuel_price<>round(p_fuel_price,2)
      OR v_vehicle.fuel_tank_capacity IS NULL OR v_vehicle.fuel_tank_capacity<=0 THEN RAISE EXCEPTION 'RETURN_DENIED:FUEL'; END IF;
    v_expected := round((v_checkout_fuel-p_fuel_level)::numeric/100*v_vehicle.fuel_tank_capacity*p_fuel_price,2);
    IF NOT v_request AND (jsonb_array_length(v_fuel)<>1 OR (v_fuel->0->>'amount')::numeric<>v_expected) THEN RAISE EXCEPTION 'RETURN_DENIED:FUEL'; END IF;
  ELSIF NOT v_preserve AND (v_request OR jsonb_array_length(v_fuel)<>0) THEN
    RAISE EXCEPTION 'RETURN_DENIED:FUEL';
  END IF;
  -- Reuse existing measurement, monetary, latest-movement and role validation.
  PERFORM public.correct_vehicle_checkin(p_reservation_id,p_revision,p_fuel_level,p_odometer,
    CASE WHEN v_preserve THEN NULL ELSE p_fuel_price END,v_nonfuel,p_reason);
  SELECT id INTO v_audit FROM public.checkin_corrections WHERE checkin_id=v_ci.id
    AND (before_data->>'correction_revision')::integer=p_revision ORDER BY corrected_at DESC LIMIT 1;
  FOR v_d IN SELECT value FROM jsonb_array_elements(p_damages) LOOP
    IF jsonb_typeof(v_d)<>'object' OR NULLIF(btrim(v_d->>'description'),'') IS NULL OR length(v_d->>'description')>2000
      OR (v_d->>'estimated_cost' IS NOT NULL AND (jsonb_typeof(v_d->'estimated_cost')<>'number'
        OR (v_d->>'estimated_cost')::numeric<0 OR (v_d->>'estimated_cost')::numeric>999999.99)) THEN RAISE EXCEPTION 'RETURN_DENIED:DAMAGES'; END IF;
    -- Copy-on-write preserves the original damage description and estimate in history.
    INSERT INTO public.damages(description,estimated_cost) VALUES(btrim(v_d->>'description'),(v_d->>'estimated_cost')::numeric) RETURNING id INTO v_damage_id;
    v_damage_ids := array_append(v_damage_ids,v_damage_id);
  END LOOP;
  UPDATE public.checkins SET new_damage_ids=v_damage_ids,
    additional_charges=CASE WHEN v_preserve THEN v_nonfuel||v_original_fuel ELSE p_charges END WHERE id=v_ci.id;
  IF v_request AND NOT v_preserve THEN
    INSERT INTO public.fuel_waiver_requests(reservation_id,checkin_id,requested_by,reason,checkout_fuel,checkin_fuel,fuel_liters,fuel_price_per_liter,proposed_charge)
    VALUES(p_reservation_id,v_ci.id,v_actor,btrim(p_waiver_reason),v_checkout_fuel,p_fuel_level,
      (v_checkout_fuel-p_fuel_level)::numeric/100*v_vehicle.fuel_tank_capacity,p_fuel_price,v_expected);
  END IF;
  SELECT to_jsonb(ci) || jsonb_build_object(
    'damages',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.damages d WHERE d.id=ANY(ci.new_damage_ids)),'[]'::jsonb),
    'waivers',COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.fuel_waiver_requests w WHERE w.checkin_id=ci.id),'[]'::jsonb))
    INTO v_after FROM public.checkins ci WHERE ci.id=v_ci.id;
  UPDATE public.checkin_corrections SET before_data=v_before,after_data=v_after WHERE id=v_audit;
END $$;
REVOKE ALL ON FUNCTION public.edit_vehicle_return(uuid,uuid,integer,integer,integer,numeric,jsonb,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_vehicle_return(uuid,uuid,integer,integer,integer,numeric,jsonb,jsonb,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.reopen_vehicle_return(uuid,uuid,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.change_unstarted_reservation_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reopen_vehicle_return(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_unstarted_reservation_status(uuid,text) TO authenticated;
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
  IF EXISTS (SELECT 1 FROM public.checkins WHERE reservation_id = p_reservation_id AND voided_at IS NULL) THEN
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
    FROM public.checkins ci WHERE ci.reservation_id=p_reservation_id AND ci.voided_at IS NULL;
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
 IF NOT FOUND OR (v_req.status<>'pending' OR v_req.voided_at IS NOT NULL) THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:NOT_PENDING'; END IF;
 IF NOT p_approve THEN
   UPDATE public.checkins SET additional_charges=coalesce(additional_charges,'[]'::jsonb)
     ||jsonb_build_array(jsonb_build_object('type','Καύσιμο','amount',v_req.proposed_charge,
       'description','Χρέωση μετά από απόρριψη εξαίρεσης καυσίμου #'||left(v_req.id::text,8)))
   WHERE id=v_req.checkin_id AND voided_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'FUEL_WAIVER_DENIED:CHECKIN_NOT_FOUND'; END IF;
 END IF;
 UPDATE public.fuel_waiver_requests SET
   status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   reviewed_by=v_actor,reviewed_at=now(),admin_note=btrim(p_admin_note)
 WHERE id=p_request_id;
END $function$
;

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
    'waiver', (SELECT to_jsonb(w) FROM public.fuel_waiver_requests w WHERE w.checkin_id = ci.id AND w.voided_at IS NULL),
    'damages', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.damages d WHERE d.id=ANY(ci.new_damage_ids)), '[]'::jsonb),
    'status_history', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC) FROM public.reservation_status_events e WHERE e.reservation_id=r.id), '[]'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.corrected_at DESC, h.id) FROM public.checkin_corrections h WHERE h.checkin_id = ci.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.checkins ci JOIN public.reservations r ON r.id = ci.reservation_id
    JOIN public.checkouts co ON co.reservation_id = r.id JOIN public.vehicles v ON v.id = r.vehicle_id
  WHERE r.id = p_reservation_id AND r.status = 'completed' AND ci.voided_at IS NULL;
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
  PERFORM id FROM public.fuel_waiver_requests WHERE reservation_id = p_reservation_id AND voided_at IS NULL FOR UPDATE;
  v_has_waiver := FOUND;
  SELECT * INTO v_ci FROM public.checkins WHERE reservation_id = p_reservation_id AND voided_at IS NULL FOR UPDATE;
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
        WHERE r.vehicle_id = v_res.vehicle_id AND ci.voided_at IS NULL AND ci.id <> v_ci.id
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
