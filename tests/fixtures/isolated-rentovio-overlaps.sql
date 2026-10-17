
-- Isolated test only. Uses synthetic rows from isolated-rentovio-schema.sql.
DO $$
DECLARE
v_vehicle uuid := '33333333-3333-4333-8333-333333333333';
v_original uuid := '66666666-6666-4666-8666-666666666666';
v_adjacent uuid := '99999999-9999-4999-8999-999999999999';
v_conflict uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
  -- Prior transaction fixture completed this booking. Reopen it in the
  -- disposable fixture only, to exercise the partial exclusion index.
  UPDATE public.reservations SET status='upcoming' WHERE id=v_original;
  -- Existing upcoming booking is [today, today+4).
  BEGIN
    INSERT INTO public.reservations(id, vehicle_id,status,pickup_date,return_date)
    VALUES (v_conflict,v_vehicle,'upcoming',CURRENT_DATE+1,CURRENT_DATE+5);
    RAISE EXCEPTION 'TEST FAILED: overlapping booking accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE id=v_conflict) THEN
    RAISE EXCEPTION 'TEST FAILED: overlap persisted';
  END IF;

  -- Adjacent booking starts exactly at first return timestamp.
  INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date)
  VALUES (v_adjacent,v_vehicle,'upcoming',CURRENT_DATE+4,CURRENT_DATE+5);

  -- Cancelled bookings may overlap, but switching back to active must fail.
  INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date)
  VALUES (v_conflict,v_vehicle,'cancelled',CURRENT_DATE+1,CURRENT_DATE+3);
  BEGIN
    UPDATE public.reservations SET status='active' WHERE id=v_conflict;
    RAISE EXCEPTION 'TEST FAILED: cancelled -> active overlap accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  IF (SELECT status FROM public.reservations WHERE id=v_conflict) <> 'cancelled' THEN
    RAISE EXCEPTION 'TEST FAILED: invalid status update persisted';
  END IF;

  -- Completed bookings do not block historical overlaps.
  UPDATE public.reservations SET status='completed' WHERE id=v_original;
  UPDATE public.reservations SET status='upcoming' WHERE id=v_conflict;
  IF (SELECT status FROM public.reservations WHERE id=v_conflict) <> 'upcoming' THEN
    RAISE EXCEPTION 'TEST FAILED: completed booking still blocks overlap';
  END IF;
  RAISE NOTICE 'PASS: overlapping, adjacent, reactivation, completed bookings';
END $$;
