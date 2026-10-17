/*
 * Rentovio atomic handover / return operations.
 * DRAFT ONLY: deploy schema migration first, then compatible frontend.
 * One RPC call = one PostgreSQL transaction. Exception rolls back all writes.
 * Security: role check against active public.users, authenticated EXECUTE only.
 * Photos live in Storage and are NOT part of this database transaction.
 */
CREATE UNIQUE INDEX IF NOT EXISTS checkins_reservation_id_unique
  ON public.checkins (reservation_id);

CREATE OR REPLACE FUNCTION public.complete_vehicle_checkout(
  p_reservation_id uuid,
  p_fuel_level integer,
  p_odometer integer,
  p_accessories text[],
  p_damages jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_reservation public.reservations%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_actor uuid;
  v_damage jsonb;
  v_damage_ids uuid[] := ARRAY[]::uuid[];
  v_damage_id uuid;
BEGIN
  IF COALESCE((SELECT public.get_current_role()), '') NOT IN ('admin','manager','agent') THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:ROLE';
  END IF;
  SELECT id INTO v_actor FROM public.users
   WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'CHECKOUT_DENIED:USER'; END IF;

  SELECT * INTO v_reservation FROM public.reservations
    WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.vehicle_id IS NULL
     OR v_reservation.status <> 'upcoming' THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:RESERVATION_STATUS';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE id = v_reservation.vehicle_id FOR UPDATE;
  IF NOT FOUND OR v_vehicle.status NOT IN ('available','reserved') THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:VEHICLE_STATUS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.checkouts WHERE reservation_id = p_reservation_id) THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:ALREADY_DONE';
  END IF;
  IF p_fuel_level IS NULL OR p_fuel_level NOT BETWEEN 0 AND 100
    OR p_odometer IS NULL OR p_odometer < 0
    OR p_odometer < COALESCE(v_vehicle.odometer, 0) THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:MEASUREMENTS';
  END IF;
  IF p_damages IS NULL OR jsonb_typeof(p_damages) <> 'array'
    OR jsonb_array_length(p_damages) > 100 THEN
    RAISE EXCEPTION 'CHECKOUT_DENIED:DAMAGES';
  END IF;

  -- Duplicate document check at the point of commit; the existing
  -- checkouts trigger from the preceding feature migration is also enforced.
  IF v_vehicle.insurance_expiry IS NULL
    OR v_vehicle.insurance_expiry < GREATEST(CURRENT_DATE, v_reservation.return_date::date) THEN
    RAISE EXCEPTION 'CHECKOUT_DOCUMENTS_INVALID:INSURANCE';
  END IF;
  IF v_vehicle.inspection_expiry IS NULL
    OR v_vehicle.inspection_expiry < GREATEST(CURRENT_DATE, v_reservation.return_date::date) THEN
    RAISE EXCEPTION 'CHECKOUT_DOCUMENTS_INVALID:INSPECTION';
  END IF;

  FOR v_damage IN SELECT value FROM jsonb_array_elements(p_damages) AS t(value) LOOP
    IF jsonb_typeof(v_damage) <> 'object'
       OR NULLIF(btrim(v_damage->>'description'), '') IS NULL
       OR length(v_damage->>'description') > 2000 THEN
      RAISE EXCEPTION 'CHECKOUT_DENIED:DAMAGES';
    END IF;
    INSERT INTO public.damages (description)
      VALUES (btrim(v_damage->>'description'))
      RETURNING id INTO v_damage_id;
    v_damage_ids := array_append(v_damage_ids, v_damage_id);
  END LOOP;

  INSERT INTO public.checkouts (
    reservation_id, fuel_level, odometer, accessories_given,
    damage_ids, checked_out_by, checked_out_at
  ) VALUES (
    p_reservation_id, p_fuel_level, p_odometer,
    COALESCE(p_accessories, ARRAY[]::text[]),
    v_damage_ids, v_actor, now()
  );

  UPDATE public.reservations SET status = 'active', updated_at = now()
    WHERE id = p_reservation_id;
  UPDATE public.vehicles SET status = 'rented', odometer = p_odometer,
    updated_at = now() WHERE id = v_vehicle.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.complete_vehicle_checkin(
  p_reservation_id uuid,
  p_fuel_level integer,
  p_odometer integer,
  p_new_damages jsonb,
  p_additional_charges jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
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
  SELECT odometer INTO v_checkout_odometer FROM public.checkouts
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

  INSERT INTO public.checkins (
    reservation_id, fuel_level, odometer, new_damage_ids,
    additional_charges, checked_in_by, checked_in_at
  ) VALUES (
    p_reservation_id, p_fuel_level, p_odometer,
    v_damage_ids, p_additional_charges, v_actor, now()
  );

  UPDATE public.reservations SET status = 'completed', updated_at = now()
    WHERE id = p_reservation_id;
  UPDATE public.vehicles SET status = 'available', odometer = p_odometer,
    updated_at = now() WHERE id = v_vehicle.id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.complete_vehicle_checkout(uuid,integer,integer,text[],jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_vehicle_checkin(uuid,integer,integer,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_vehicle_checkout(uuid,integer,integer,text[],jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_vehicle_checkin(uuid,integer,integer,jsonb,jsonb) TO authenticated;

-- After the application switches to the RPC routes, block direct client
-- inserts that could bypass the atomic workflow (RLS alone permits these).
-- Deploy alongside compatible frontend: older clients using direct INSERT
-- will stop working. Service role operations remain available.
REVOKE INSERT ON TABLE public.checkouts, public.checkins FROM authenticated;

