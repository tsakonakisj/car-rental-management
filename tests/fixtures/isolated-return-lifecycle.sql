-- Synthetic data only. Tests run in the isolated Actions PostgreSQL service.
DO $$
DECLARE
  v_vehicle uuid := gen_random_uuid(); v_res uuid := gen_random_uuid(); v_other uuid := gen_random_uuid();
  v_ci uuid; v_revision integer; v_context jsonb; v_old_request uuid; v_new_request uuid;
BEGIN
  UPDATE public.users SET role='admin';
  INSERT INTO public.vehicles(id,status,odometer,insurance_expiry,inspection_expiry,fuel_tank_capacity) VALUES(v_vehicle,'rented',10000,CURRENT_DATE+30,CURRENT_DATE+30,50);
  INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date) VALUES(v_res,v_vehicle,'active',CURRENT_DATE-1,CURRENT_DATE+1);
  INSERT INTO public.checkouts(reservation_id,fuel_level,odometer,checked_out_at) VALUES(v_res,100,10000,now()-interval '1 day');
  INSERT INTO public.payments(reservation_id,amount) VALUES(v_res,200);
  INSERT INTO public.payment_refunds(reservation_id,amount) VALUES(v_res,10);
  PERFORM public.complete_vehicle_checkin_v2(v_res,75,10100,'[]','[{"type":"Καύσιμο","amount":25,"description":"initial"}]',2,NULL);
  SELECT id,correction_revision INTO v_ci,v_revision FROM public.current_checkins WHERE reservation_id=v_res;
  BEGIN
    UPDATE public.reservations SET status='active' WHERE id=v_res;
    RAISE EXCEPTION 'TEST FAILED: direct completed-active transition';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:HANDOVER_REQUIRED' THEN RAISE; END IF; END;
  UPDATE public.users SET role='manager';
  BEGIN
    PERFORM public.reopen_vehicle_return(v_res,v_ci,v_revision,'Accidental return');
    RAISE EXCEPTION 'TEST FAILED: manager reopened';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:ADMIN_ONLY' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,50,10100,2,'[{"type":"Καύσιμο","amount":50}]','[]',NULL,'Correct fuel');
    RAISE EXCEPTION 'TEST FAILED: manager edited return';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:ADMIN_ONLY' THEN RAISE; END IF; END;
  UPDATE public.users SET role='admin';
  PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,50,10120,2,'[{"type":"Καύσιμο","amount":50,"description":"corrected"},{"type":"Cleaning","amount":10}]','[{"description":"Corrected scratch","estimated_cost":30}]',NULL,'Correct fuel, odometer and damage');
  v_context := public.get_checkin_correction_context(v_res);
  IF v_context->'checkin'->>'fuel_level'<>'50' OR v_context->'checkin'->>'odometer'<>'10120'
    OR jsonb_array_length(v_context->'damages')<>1 OR v_context->'damages'->0->>'description'<>'Corrected scratch'
    OR (SELECT status FROM public.reservations WHERE id=v_res)<>'completed'
    OR (SELECT status FROM public.vehicles WHERE id=v_vehicle)<>'available' THEN RAISE EXCEPTION 'TEST FAILED: full return edit'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.checkin_corrections WHERE checkin_id=v_ci AND before_data->>'fuel_level'='75'
    AND after_data->'damages'->0->>'description'='Corrected scratch') THEN RAISE EXCEPTION 'TEST FAILED: complete audit snapshot'; END IF;
  BEGIN
    PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,50,10120,2,'[]','[]',NULL,'Stale edit');
    RAISE EXCEPTION 'TEST FAILED: stale edit accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:STALE' THEN RAISE; END IF; END;
  v_revision := (v_context->'checkin'->>'correction_revision')::integer;
  PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,60,10120,2,'[]','[]','Agreed fuel exception','Correct fuel settlement');
  SELECT id INTO v_old_request FROM public.fuel_waiver_requests WHERE checkin_id=v_ci AND voided_at IS NULL;
  PERFORM public.review_fuel_waiver(v_old_request,true,'Approved agreed exception');
  SELECT correction_revision INTO v_revision FROM public.checkins WHERE id=v_ci;
  PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,75,10120,2,'[{"type":"Καύσιμο","amount":25}]','[]',NULL,'Replace exception with correct charge');
  IF NOT EXISTS(SELECT 1 FROM public.fuel_waiver_requests WHERE id=v_old_request AND status='approved' AND voided_at IS NOT NULL) THEN RAISE EXCEPTION 'TEST FAILED: approved decision history lost'; END IF;
  SELECT correction_revision INTO v_revision FROM public.checkins WHERE id=v_ci;
  PERFORM public.edit_vehicle_return(v_res,v_ci,v_revision,75,10120,2,'[]','[]','New pending exception','Request new settlement');
  SELECT id INTO v_old_request FROM public.fuel_waiver_requests WHERE checkin_id=v_ci AND voided_at IS NULL;
  SELECT correction_revision INTO v_revision FROM public.checkins WHERE id=v_ci;
  -- A conflicting upcoming booking blocks the reversal atomically.
  INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date) VALUES(v_other,v_vehicle,'upcoming',CURRENT_DATE,CURRENT_DATE+2);
  BEGIN
    PERFORM public.reopen_vehicle_return(v_res,v_ci,v_revision,'Accidental return');
    RAISE EXCEPTION 'TEST FAILED: conflicting reversal';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:CONFLICT' THEN RAISE; END IF; END;
  IF NOT EXISTS(SELECT 1 FROM public.current_checkins WHERE id=v_ci) THEN RAISE EXCEPTION 'TEST FAILED: reversal rollback'; END IF;
  PERFORM public.change_unstarted_reservation_status(v_other,'cancelled');
  BEGIN
    PERFORM public.reopen_vehicle_return(v_res,v_ci,v_revision,'');
    RAISE EXCEPTION 'TEST FAILED: missing reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:REASON' THEN RAISE; END IF; END;
  PERFORM public.reopen_vehicle_return(v_res,v_ci,v_revision,'Accidental check-in, customer still has car');
  IF (SELECT status FROM public.reservations WHERE id=v_res)<>'active'
    OR (SELECT status FROM public.vehicles WHERE id=v_vehicle)<>'rented'
    OR (SELECT odometer FROM public.vehicles WHERE id=v_vehicle)<>10000
    OR EXISTS(SELECT 1 FROM public.current_checkins WHERE reservation_id=v_res)
    OR NOT EXISTS(SELECT 1 FROM public.checkins WHERE id=v_ci AND voided_at IS NOT NULL AND void_reason IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.fuel_waiver_requests WHERE id=v_old_request AND voided_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.reservation_status_events WHERE reservation_id=v_res AND snapshot->'checkin'->>'id'=v_ci::text) THEN
    RAISE EXCEPTION 'TEST FAILED: reversal states/history/balance';
  END IF;
  BEGIN
    PERFORM public.review_fuel_waiver(v_old_request,false,'Stale dashboard decision');
    RAISE EXCEPTION 'TEST FAILED: voided waiver reviewed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'FUEL_WAIVER_DENIED:NOT_PENDING' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.change_unstarted_reservation_status(v_res,'upcoming');
    RAISE EXCEPTION 'TEST FAILED: unsafe active-upcoming';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:HANDOVER_REQUIRED' THEN RAISE; END IF; END;
  -- A fresh check-in is possible without duplicate current charges or requests.
  PERFORM public.complete_vehicle_checkin_v2(v_res,80,10080,'[]','[]',2,'New return exception');
  SELECT id INTO v_new_request FROM public.fuel_waiver_requests WHERE reservation_id=v_res AND voided_at IS NULL;
  IF v_new_request=v_old_request OR (SELECT count(*) FROM public.current_checkins WHERE reservation_id=v_res)<>1
    OR (SELECT count(*) FROM public.checkins WHERE reservation_id=v_res)<>2
    OR (SELECT sum(amount) FROM public.payments WHERE reservation_id=v_res)<>200
    OR (SELECT sum(amount) FROM public.payment_refunds WHERE reservation_id=v_res)<>10 THEN
    RAISE EXCEPTION 'TEST FAILED: repeat return/payments/refunds';
  END IF;
  SELECT id,correction_revision INTO v_ci,v_revision FROM public.current_checkins WHERE reservation_id=v_res;
  -- A later checkout blocks historical reversal even if the car appears available.
  INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date) VALUES(gen_random_uuid(),v_vehicle,'upcoming',CURRENT_DATE+3,CURRENT_DATE+4) RETURNING id INTO v_other;
  INSERT INTO public.checkouts(reservation_id,fuel_level,odometer,checked_out_at) VALUES(v_other,100,10080,now()+interval '1 hour');
  BEGIN
    PERFORM public.reopen_vehicle_return(v_res,v_ci,v_revision,'Historical reversal attempt');
    RAISE EXCEPTION 'TEST FAILED: later handover ignored';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RETURN_DENIED:LATER_MOVEMENT' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','public.reopen_vehicle_return(uuid,uuid,integer,text)','EXECUTE')
    OR has_table_privilege('authenticated','public.reservation_status_events','UPDATE')
    OR has_table_privilege('authenticated','public.checkins','UPDATE') THEN RAISE EXCEPTION 'TEST FAILED: API privileges'; END IF;
  RAISE NOTICE 'PASS: full return edit, reversal, repeated check-in, waiver history, unchanged payments/refunds, stale requests, conflicts, subsequent movements, role guards';
END $$;
