-- Disposable PostgreSQL only.
DO $$
DECLARE v uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); ci uuid;
BEGIN
 UPDATE public.users SET role='manager';
 INSERT INTO public.vehicles(id,status,odometer,insurance_expiry,inspection_expiry,fuel_tank_capacity)
 VALUES(v,'available',10000,CURRENT_DATE+30,CURRENT_DATE+30,50);
 INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date,total_amount)
 VALUES(r,v,'upcoming',CURRENT_DATE,CURRENT_DATE+1,108);
 BEGIN
  PERFORM public.complete_vehicle_checkout(r,100,10000,'{}','[]');
  RAISE EXCEPTION 'TEST FAILED unpaid checkout';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKOUT_UNPAID' THEN RAISE; END IF; END;
 INSERT INTO public.payments(reservation_id,amount) VALUES(r,50);
 BEGIN
  PERFORM public.complete_vehicle_checkout(r,100,10000,'{}','[]');
  RAISE EXCEPTION 'TEST FAILED deposit checkout';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKOUT_UNPAID' THEN RAISE; END IF; END;
 INSERT INTO public.payments(reservation_id,amount,voided_at) VALUES(r,58,now());
 BEGIN
  PERFORM public.complete_vehicle_checkout(r,100,10000,'{}','[]');
  RAISE EXCEPTION 'TEST FAILED void counted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKOUT_UNPAID' THEN RAISE; END IF; END;
 INSERT INTO public.payments(reservation_id,amount) VALUES(r,58);
 INSERT INTO public.payment_refunds(reservation_id,amount) VALUES(r,10);
 BEGIN
  PERFORM public.complete_vehicle_checkout(r,100,10000,'{}','[]');
  RAISE EXCEPTION 'TEST FAILED refund ignored';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKOUT_UNPAID' THEN RAISE; END IF; END;
 INSERT INTO public.payments(reservation_id,amount) VALUES(r,10);
 PERFORM public.complete_vehicle_checkout(r,100,10000,'{}','[]');
 BEGIN
  PERFORM public.complete_vehicle_checkin_v3(r,62,10100,'[]','[{"type":"Καύσιμο","amount":41.80}]',2.2,NULL,NULL);
  RAISE EXCEPTION 'TEST FAILED unpaid return';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKIN_UNPAID_REASON_REQUIRED' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.checkins WHERE reservation_id=r) OR
   (SELECT status FROM public.reservations WHERE id=r)<>'active' THEN RAISE EXCEPTION 'TEST FAILED rollback'; END IF;
 INSERT INTO public.payments(reservation_id,amount) VALUES(r,41.80);
 PERFORM public.complete_vehicle_checkin_v3(r,62,10100,'[]','[{"type":"Καύσιμο","amount":41.80}]',2.2,NULL,NULL);
 IF (SELECT unpaid_reason FROM public.checkins WHERE reservation_id=r) IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED paid marked unpaid'; END IF;
 -- Normal return: booking paid, no extra, no extra receipt.
 INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date,total_amount)
 VALUES(r2,v,'upcoming',CURRENT_DATE+2,CURRENT_DATE+3,100);
 INSERT INTO public.payments(reservation_id,amount) VALUES(r2,100);
 PERFORM public.complete_vehicle_checkout(r2,100,10100,'{}','[]');
 PERFORM public.complete_vehicle_checkin_v3(r2,100,10200,'[]','[]',NULL,NULL,NULL);
 IF (SELECT count(*) FROM public.payments WHERE reservation_id=r2)<>1 THEN RAISE EXCEPTION 'TEST FAILED automatic receipt'; END IF;
 -- Explicit unpaid return with audited reason, not a waived debt.
 r2:=gen_random_uuid();
 INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date,total_amount)
 VALUES(r2,v,'upcoming',CURRENT_DATE+4,CURRENT_DATE+5,100);
 INSERT INTO public.payments(reservation_id,amount) VALUES(r2,100);
 PERFORM public.complete_vehicle_checkout(r2,100,10200,'{}','[]');
 PERFORM public.complete_vehicle_checkin_v3(r2,75,10300,'[]','[{"type":"Καύσιμο","amount":25}]',2,NULL,'Customer will pay later');
 IF NOT EXISTS(SELECT 1 FROM public.checkins WHERE reservation_id=r2 AND unpaid_amount=25 AND unpaid_reason='Customer will pay later') THEN RAISE EXCEPTION 'TEST FAILED missing reason'; END IF;
 -- Pending waiver does not charge the customer yet.
 r2:=gen_random_uuid();
 INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date,total_amount)
 VALUES(r2,v,'upcoming',CURRENT_DATE+6,CURRENT_DATE+7,100);
 INSERT INTO public.payments(reservation_id,amount) VALUES(r2,100);
 PERFORM public.complete_vehicle_checkout(r2,100,10300,'{}','[]');
 PERFORM public.complete_vehicle_checkin_v3(r2,75,10400,'[]','[]',2,'Agreed fuel exception',NULL);
 IF NOT EXISTS(SELECT 1 FROM public.fuel_waiver_requests WHERE reservation_id=r2 AND status='pending') THEN RAISE EXCEPTION 'TEST FAILED pending waiver'; END IF;
 IF has_function_privilege('authenticated','public.complete_vehicle_checkin_v2(uuid,integer,integer,jsonb,jsonb,numeric,text)','EXECUTE')
 OR has_function_privilege('anon','public.complete_vehicle_checkin_v3(uuid,integer,integer,jsonb,jsonb,numeric,text,text)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED bypass privileges'; END IF;
 RAISE NOTICE 'PASS: deposits, voids, refunds, settled checkout, fuel-only collection, no-extra return, unpaid reason, waiver and rollback';
END $$;
