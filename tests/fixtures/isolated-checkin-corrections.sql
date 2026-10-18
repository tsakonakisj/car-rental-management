-- Disposable PostgreSQL fixtures only. Never run against production.
DO $$
DECLARE
  v_good uuid := '66666666-6666-4666-8666-666666666666';
  v_other uuid := '77777777-7777-4777-8777-777777777777';
  v_third uuid := '88888888-8888-4888-8888-888888888888';
  v_request uuid; v_revision integer; v_context jsonb;
BEGIN
  UPDATE public.users SET role = 'manager';
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_good,0,50,10120,2,'[]','Test correction');
    RAISE EXCEPTION 'TEST FAILED: manager correction accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:ADMIN_ONLY' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.get_checkin_correction_context(v_good);
    RAISE EXCEPTION 'TEST FAILED: manager audit access accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:ADMIN_ONLY' THEN RAISE; END IF; END;
  UPDATE public.users SET role = 'admin';
  IF has_table_privilege('authenticated','public.checkins','UPDATE')
    OR has_table_privilege('authenticated','public.checkin_corrections','INSERT')
    OR has_table_privilege('authenticated','public.checkin_corrections','UPDATE')
    OR has_table_privilege('authenticated','public.checkin_corrections','DELETE')
    OR has_function_privilege('anon','public.correct_vehicle_checkin(uuid,integer,integer,integer,numeric,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'TEST FAILED: permissions';
  END IF;
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_good,0,50,10120,2,'[]','');
    RAISE EXCEPTION 'TEST FAILED: empty reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:REASON' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_good,0,50,10120,2,'[{"type":"Καύσιμο","amount":0}]','Test correction');
    RAISE EXCEPTION 'TEST FAILED: injected fuel charge';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:CHARGES' THEN RAISE; END IF; END;
  PERFORM public.correct_vehicle_checkin(v_good,0,50,10120,2,'[{"type":"Cleaning","amount":15,"description":"test charge"}]','Correct return measurements');
  IF (SELECT status FROM public.reservations WHERE id=v_good) <> 'completed'
    OR (SELECT status FROM public.vehicles WHERE id='33333333-3333-4333-8333-333333333333') <> 'available'
    OR (SELECT odometer FROM public.vehicles WHERE id='33333333-3333-4333-8333-333333333333') <> 10120
    OR (SELECT count(*) FROM public.checkin_corrections) <> 1
    OR (SELECT correction_revision FROM public.checkins WHERE reservation_id=v_good) <> 1
    OR (SELECT (additional_charges->1->>'amount')::numeric FROM public.checkins WHERE reservation_id=v_good) <> 25
    OR (SELECT (before_data->>'odometer')::integer FROM public.checkin_corrections LIMIT 1) <> 10100 THEN
    RAISE EXCEPTION 'TEST FAILED: correction/audit/fuel/status';
  END IF;
  v_context := public.get_checkin_correction_context(v_good);
  IF jsonb_array_length(v_context->'history') <> 1 OR v_context->'checkin'->>'fuel_level' <> '50' THEN
    RAISE EXCEPTION 'TEST FAILED: load context';
  END IF;
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_good,0,40,10120,2,'[]','Stale browser');
    RAISE EXCEPTION 'TEST FAILED: stale version';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:STALE' THEN RAISE; END IF; END;
  -- A subsequent checkout must protect the current fleet odometer.
  UPDATE public.vehicles SET odometer=10200 WHERE id='33333333-3333-4333-8333-333333333333';
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_good,1,50,10130,NULL,'[]','Historical odometer correction');
    RAISE EXCEPTION 'TEST FAILED: later movement overwritten';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:LATER_MOVEMENT' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.checkin_corrections) <> 1 THEN RAISE EXCEPTION 'TEST FAILED: rejected correction logged'; END IF;

  -- Manager's waiver completes the physical return before any admin decision.
  UPDATE public.users SET role='manager';
  UPDATE public.reservations SET status='active' WHERE id=v_other;
  UPDATE public.vehicles SET status='rented', insurance_expiry=CURRENT_DATE+30 WHERE id='44444444-4444-4444-8444-444444444444';
  INSERT INTO public.checkouts(reservation_id,fuel_level,odometer,checked_out_at) VALUES(v_other,100,10000,now());
  PERFORM public.complete_vehicle_checkin_v2(v_other,75,10100,'[]','[]',2,'Agreed exception with customer');
  SELECT id INTO v_request FROM public.fuel_waiver_requests WHERE reservation_id=v_other;
  IF v_request IS NULL OR (SELECT status FROM public.reservations WHERE id=v_other) <> 'completed'
    OR (SELECT status FROM public.vehicles WHERE id='44444444-4444-4444-8444-444444444444') <> 'available'
    OR (SELECT proposed_charge FROM public.fuel_waiver_requests WHERE id=v_request) <> 25 THEN
    RAISE EXCEPTION 'TEST FAILED: pending waiver blocks return';
  END IF;
  BEGIN
    PERFORM public.review_fuel_waiver(v_request,true,'Manager bypass attempt');
    RAISE EXCEPTION 'TEST FAILED: manager reviewed waiver';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'FUEL_WAIVER_DENIED:ADMIN_ONLY' THEN RAISE; END IF; END;
  UPDATE public.users SET role='admin';
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_other,0,100,10100,NULL,'[]','Attempt to change pending fuel');
    RAISE EXCEPTION 'TEST FAILED: pending fuel changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:FUEL_LOCKED' THEN RAISE; END IF; END;
  PERFORM public.correct_vehicle_checkin(v_other,0,75,10100,NULL,'[{"type":"Cleaning","amount":5}]','Correct non-fuel charge');
  PERFORM public.review_fuel_waiver(v_request,false,'Exception was not agreed');
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_other,1,75,10100,NULL,'[]','Browser before review');
    RAISE EXCEPTION 'TEST FAILED: review not versioned';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:STALE' THEN RAISE; END IF; END;
  PERFORM public.correct_vehicle_checkin(v_other,2,75,10100,NULL,'[]','Remove cleaning charge only');
  IF (SELECT jsonb_array_length(additional_charges) FROM public.checkins WHERE reservation_id=v_other) <> 1
    OR (SELECT (additional_charges->0->>'amount')::numeric FROM public.checkins WHERE reservation_id=v_other) <> 25 THEN
    RAISE EXCEPTION 'TEST FAILED: rejected waiver fuel removed';
  END IF;
  BEGIN
    PERFORM public.review_fuel_waiver(v_request,false,'Duplicate review');
    RAISE EXCEPTION 'TEST FAILED: duplicate waiver review';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'FUEL_WAIVER_DENIED:NOT_PENDING' THEN RAISE; END IF; END;

  UPDATE public.reservations SET status='active' WHERE id=v_third;
  UPDATE public.vehicles SET status='rented' WHERE id='55555555-5555-4555-8555-555555555555';
  INSERT INTO public.checkouts(reservation_id,fuel_level,odometer,checked_out_at) VALUES(v_third,100,10000,now());
  PERFORM public.complete_vehicle_checkin_v2(v_third,75,10100,'[]','[]',2,'Another agreed exception');
  SELECT id INTO v_request FROM public.fuel_waiver_requests WHERE reservation_id=v_third;
  PERFORM public.review_fuel_waiver(v_request,true,'Approved agreed exception');
  BEGIN
    PERFORM public.correct_vehicle_checkin(v_third,0,75,10100,2,'[]','Attempt to recharge approved fuel');
    RAISE EXCEPTION 'TEST FAILED: approved waiver changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'CHECKIN_CORRECTION_DENIED:FUEL_LOCKED' THEN RAISE; END IF; END;
  IF (SELECT jsonb_array_length(additional_charges) FROM public.checkins WHERE reservation_id=v_third) <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: approved waiver charged';
  END IF;
  RAISE NOTICE 'PASS: admin correction, audit, validation, stale edits, later movement, pending/rejected/approved waivers, role restrictions';
END $$;
