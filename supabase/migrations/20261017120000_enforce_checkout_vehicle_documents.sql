/*
 * Checkout document validity, isolated feature draft.
 * Apply ONLY after separately reviewing and testing; never run on live Supabase
 * from this branch without an explicit release approval.
 *
 * This guard operates in PostgreSQL: authenticated users cannot bypass it by
 * writing to public.checkouts outside the app.
 *
 * NOTE: It guards checkout INSERT and reassignment UPDATE, not later changes
 * to reservation dates or vehicle documents. Those need a separate workflow.
 */

CREATE OR REPLACE FUNCTION public.reject_checkout_without_valid_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  pickup_day date;
  return_day date;
  vehicle_id_value uuid;
  insurance_day date;
  inspection_day date;
  valid_through date;
BEGIN
  SELECT r.pickup_date::date,
         r.return_date::date,
         r.vehicle_id,
         v.insurance_expiry,
         v.inspection_expiry
    INTO pickup_day, return_day, vehicle_id_value, insurance_day, inspection_day
    FROM public.reservations r
    LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
   WHERE r.id = NEW.reservation_id;

  IF NOT FOUND OR vehicle_id_value IS NULL OR return_day IS NULL
     OR pickup_day IS NULL OR return_day < pickup_day THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'CHECKOUT_DOCUMENTS_INVALID:RESERVATION_OR_VEHICLE';
  END IF;

  valid_through := GREATEST(return_day, CURRENT_DATE);

  IF insurance_day IS NULL OR insurance_day < valid_through THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'CHECKOUT_DOCUMENTS_INVALID:INSURANCE';
  END IF;

  IF inspection_day IS NULL OR inspection_day < valid_through THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'CHECKOUT_DOCUMENTS_INVALID:INSPECTION';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_checkout_without_valid_documents() FROM PUBLIC, anon, authenticated;
-- The trigger executes the function via its table context; direct RPC usage is not necessary.

DROP TRIGGER IF EXISTS checkouts_require_valid_vehicle_documents ON public.checkouts;
CREATE TRIGGER checkouts_require_valid_vehicle_documents
  BEFORE INSERT OR UPDATE OF reservation_id ON public.checkouts
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_checkout_without_valid_documents();
