-- Retain all original payment records; mark erroneous entries as void instead of deleting them.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_void_metadata_consistent
  CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND nullif(btrim(void_reason), '') IS NOT NULL));

CREATE OR REPLACE FUNCTION public.void_reservation_payment(p_payment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid; v_payment public.payments%ROWTYPE;
BEGIN
  IF NOT public.has_employee_permission('payments','delete') THEN
    RAISE EXCEPTION 'PAYMENT_VOID_DENIED:PERMISSION';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'PAYMENT_VOID_DENIED:REASON_REQUIRED';
  END IF;
  SELECT u.id INTO v_actor
  FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.active = true LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_VOID_DENIED:USER_NOT_FOUND';
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_VOID_DENIED:NOT_FOUND';
  END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_VOID_DENIED:ALREADY_VOIDED';
  END IF;
  UPDATE public.payments SET voided_at = now(), voided_by = v_actor,
    void_reason = btrim(p_reason) WHERE id = p_payment_id;
END $$;

REVOKE ALL ON FUNCTION public.void_reservation_payment(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_reservation_payment(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.void_reservation_payment(uuid,text) TO authenticated;
REVOKE UPDATE, DELETE ON public.payments FROM authenticated;
REVOKE UPDATE, DELETE ON public.payments FROM anon;
