-- Applied to Supabase: tracked partial refunds, immutable financial history.
CREATE TABLE IF NOT EXISTS public.payment_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
 reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
 amount numeric(12,2) NOT NULL CHECK (amount > 0),
 method text NOT NULL CHECK (method IN ('cash','card','transfer')),
 reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_reservation ON public.payment_refunds(reservation_id);
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_read_permission ON public.payment_refunds FOR SELECT TO authenticated
  USING (public.has_employee_permission('payments','view'));
REVOKE ALL ON public.payment_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_refunds TO authenticated;
CREATE OR REPLACE FUNCTION public.record_payment_refund(p_payment_id uuid,p_amount numeric,p_method text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid; v_payment public.payments%ROWTYPE; v_refunded numeric;
BEGIN
 IF public.get_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:PERMISSION'; END IF;
 IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:INVALID_AMOUNT'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('cash','card','transfer') THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:INVALID_METHOD'; END IF;
 IF length(btrim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:REASON_REQUIRED'; END IF;
 SELECT id INTO v_actor FROM public.users WHERE auth_user_id=(SELECT auth.uid()) AND active=true LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:USER_NOT_FOUND'; END IF;
 SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND OR v_payment.voided_at IS NOT NULL THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:INVALID_PAYMENT'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_refunded FROM public.payment_refunds WHERE payment_id=p_payment_id;
 IF v_refunded+p_amount > v_payment.amount THEN RAISE EXCEPTION 'PAYMENT_REFUND_DENIED:AMOUNT_EXCEEDS_PAID'; END IF;
 INSERT INTO public.payment_refunds(payment_id,reservation_id,amount,method,reason,created_by)
 VALUES(p_payment_id,v_payment.reservation_id,p_amount,p_method,btrim(p_reason),v_actor);
END $$;
REVOKE ALL ON FUNCTION public.record_payment_refund(uuid,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_payment_refund(uuid,numeric,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.void_reservation_payment(p_payment_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid; v_payment public.payments%ROWTYPE;
BEGIN
 IF NOT public.has_employee_permission('payments','delete') THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:PERMISSION'; END IF;
 IF length(btrim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:REASON_REQUIRED'; END IF;
 SELECT id INTO v_actor FROM public.users WHERE auth_user_id=(SELECT auth.uid()) AND active=true LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:USER_NOT_FOUND'; END IF;
 SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:NOT_FOUND'; END IF;
 IF v_payment.voided_at IS NOT NULL THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:ALREADY_VOIDED'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_refunds WHERE payment_id=p_payment_id) THEN RAISE EXCEPTION 'PAYMENT_VOID_DENIED:HAS_REFUNDS'; END IF;
 UPDATE public.payments SET voided_at=now(),voided_by=v_actor,void_reason=btrim(p_reason) WHERE id=p_payment_id;
END $$;
REVOKE ALL ON FUNCTION public.void_reservation_payment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.void_reservation_payment(uuid,text) TO authenticated;
