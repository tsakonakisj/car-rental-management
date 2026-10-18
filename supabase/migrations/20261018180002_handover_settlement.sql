-- Additive settlement checks; no existing financial records are changed.
ALTER TABLE public.checkins ADD COLUMN unpaid_reason text;
ALTER TABLE public.checkins ADD COLUMN unpaid_amount numeric(12,2);

-- Serialize receipts/refunds with handover's reservation row lock.
CREATE OR REPLACE FUNCTION public.lock_reservation_finances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.reservations WHERE id=NEW.reservation_id FOR UPDATE;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_reservation_finances() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payments_reservation_lock BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.lock_reservation_finances();
CREATE TRIGGER refunds_reservation_lock BEFORE INSERT ON public.payment_refunds
FOR EACH ROW EXECUTE FUNCTION public.lock_reservation_finances();

CREATE OR REPLACE FUNCTION public.require_checkout_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric; v_paid numeric; v_refunded numeric;
BEGIN
  SELECT total_amount INTO v_total FROM public.reservations WHERE id=NEW.reservation_id FOR UPDATE;
  IF v_total IS NULL OR v_total::text IN ('NaN','Infinity','-Infinity') OR v_total<0 THEN
    RAISE EXCEPTION 'SETTLEMENT_INVALID_TOTAL';
  END IF;
  SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments
    WHERE reservation_id=NEW.reservation_id AND voided_at IS NULL;
  SELECT coalesce(sum(amount),0) INTO v_refunded FROM public.payment_refunds WHERE reservation_id=NEW.reservation_id;
  IF round(v_total-v_paid+v_refunded,2)>0 THEN
    RAISE EXCEPTION 'CHECKOUT_UNPAID';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_checkout_settlement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER checkout_requires_settlement BEFORE INSERT ON public.checkouts
FOR EACH ROW EXECUTE FUNCTION public.require_checkout_settlement();

CREATE OR REPLACE FUNCTION public.complete_vehicle_checkin_v3(
  p_reservation_id uuid,p_fuel_level integer,p_odometer integer,
  p_new_damages jsonb,p_additional_charges jsonb,p_fuel_price numeric,
  p_fuel_waiver_reason text,p_unpaid_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric; v_paid numeric; v_refunded numeric; v_extra numeric; v_due numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_employee_permission('bookings','edit'),false)
    OR NOT coalesce(public.has_employee_permission('payments','view'),false) THEN
    RAISE EXCEPTION 'SETTLEMENT_PERMISSION';
  END IF;
  SELECT total_amount INTO v_total FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF v_total IS NULL OR v_total::text IN ('NaN','Infinity','-Infinity') OR v_total<0 THEN
    RAISE EXCEPTION 'SETTLEMENT_INVALID_TOTAL';
  END IF;
  -- Existing RPC validates handover, roles, fuel calculation and waiver atomically.
  PERFORM public.complete_vehicle_checkin_v2(p_reservation_id,p_fuel_level,p_odometer,
    p_new_damages,p_additional_charges,p_fuel_price,p_fuel_waiver_reason);
  SELECT coalesce(sum((c->>'amount')::numeric),0) INTO v_extra
    FROM jsonb_array_elements(p_additional_charges) c;
  SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments
    WHERE reservation_id=p_reservation_id AND voided_at IS NULL;
  SELECT coalesce(sum(amount),0) INTO v_refunded FROM public.payment_refunds WHERE reservation_id=p_reservation_id;
  v_due := greatest(0,round(v_total+v_extra-v_paid+v_refunded,2));
  IF v_due>0 THEN
    IF length(btrim(coalesce(p_unpaid_reason,''))) NOT BETWEEN 5 AND 2000 THEN
      RAISE EXCEPTION 'CHECKIN_UNPAID_REASON_REQUIRED';
    END IF;
    UPDATE public.checkins SET unpaid_reason=btrim(p_unpaid_reason),unpaid_amount=v_due
      WHERE reservation_id=p_reservation_id AND voided_at IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.complete_vehicle_checkin_v2(uuid,integer,integer,jsonb,jsonb,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_vehicle_checkin_v3(uuid,integer,integer,jsonb,jsonb,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_vehicle_checkin_v3(uuid,integer,integer,jsonb,jsonb,numeric,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
