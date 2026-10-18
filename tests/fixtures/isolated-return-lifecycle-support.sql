-- Disposable CI schema only, no live data connection.
ALTER TABLE public.reservations ADD COLUMN pickup_station_id uuid;
CREATE OR REPLACE FUNCTION public.has_employee_permission(resource text, action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.get_current_role() IN ('admin','manager');
$$;
CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reservation_id uuid,amount numeric);
CREATE TABLE public.payment_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reservation_id uuid,amount numeric);
