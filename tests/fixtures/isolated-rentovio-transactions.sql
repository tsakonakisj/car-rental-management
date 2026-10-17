
DO $$
DECLARE
  v_good uuid := '66666666-6666-4666-8666-666666666666';
  v_expired uuid := '77777777-7777-4777-8777-777777777777';
  v_rollback uuid := '88888888-8888-4888-8888-888888888888';
  v_count int;
BEGIN
  -- Invalid documents must fail without persisting checkout or changing reservation.
  BEGIN
    PERFORM public.complete_vehicle_checkout(v_expired,80,10002,ARRAY[]::text[],'[]'::jsonb);
    RAISE EXCEPTION 'TEST FAILED: expired insurance was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST FAILED: expired insurance was allowed' THEN RAISE; END IF;
    IF position('CHECKOUT_DOCUMENTS_INVALID:INSURANCE' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.reservations WHERE id=v_expired)<>'upcoming' THEN
    RAISE EXCEPTION 'TEST FAILED: expired reservation status changed';
  END IF;

  -- Failed checkout after inserting a damage must rollback the damage.
  BEGIN
    PERFORM public.complete_vehicle_checkout(v_rollback,80,9999,ARRAY[]::text[], '[{"description":"test damage"}]'::jsonb);
    RAISE EXCEPTION 'TEST FAILED: invalid odometer was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST FAILED: invalid odometer was allowed' THEN RAISE; END IF;
    IF position('CHECKOUT_DENIED:MEASUREMENTS' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
  SELECT COUNT(*) INTO v_count FROM public.damages;
  IF v_count<>0 THEN RAISE EXCEPTION 'TEST FAILED: damages persisted'; END IF;

  -- Normal checkout must update all tables together.
  PERFORM public.complete_vehicle_checkout(v_good,75,10010,ARRAY['child seat']::text[],
    '[{"description":"existing scratch"}]'::jsonb);
  IF (SELECT status FROM public.reservations WHERE id=v_good)<>'active'
     OR (SELECT status FROM public.vehicles WHERE id='33333333-3333-4333-8333-333333333333')<>'rented'
     OR (SELECT COUNT(*) FROM public.checkouts WHERE reservation_id=v_good)<>1
     OR (SELECT COUNT(*) FROM public.damages)<>1 THEN
    RAISE EXCEPTION 'TEST FAILED: checkout incomplete';
  END IF;

  -- Repeated checkout is blocked and doesn't add records.
  BEGIN
    PERFORM public.complete_vehicle_checkout(v_good,70,10020,ARRAY[]::text[],'[]'::jsonb);
    RAISE EXCEPTION 'TEST FAILED: duplicate checkout was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST FAILED: duplicate checkout was allowed' THEN RAISE; END IF;
  END;

  -- Failed return cannot create return rows or modify status.
  BEGIN
    PERFORM public.complete_vehicle_checkin(v_good,70,10000,'[]'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'TEST FAILED: invalid check-in odometer was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST FAILED: invalid check-in odometer was allowed' THEN RAISE; END IF;
    IF position('CHECKIN_DENIED:MEASUREMENTS' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.checkins WHERE reservation_id=v_good)<>0
     OR (SELECT status FROM public.reservations WHERE id=v_good)<>'active' THEN
    RAISE EXCEPTION 'TEST FAILED: failed checkin changed database';
  END IF;

  -- Successful return commits all updates.
  PERFORM public.complete_vehicle_checkin(v_good,60,10100,
    '[{"description":"new damage","estimated_cost":50}]'::jsonb,
    '[{"type":"Cleaning","amount":15,"description":"test charge"}]'::jsonb);
  IF (SELECT status FROM public.reservations WHERE id=v_good)<>'completed'
     OR (SELECT status FROM public.vehicles WHERE id='33333333-3333-4333-8333-333333333333')<>'available'
     OR (SELECT odometer FROM public.vehicles WHERE id='33333333-3333-4333-8333-333333333333')<>10100
     OR (SELECT COUNT(*) FROM public.checkins WHERE reservation_id=v_good)<>1
     OR (SELECT COUNT(*) FROM public.damages)<>2 THEN
    RAISE EXCEPTION 'TEST FAILED: checkin incomplete';
  END IF;
  RAISE NOTICE 'PASS: document guard, checkout, rollback, checkin, duplicate prevention';
END $$;
