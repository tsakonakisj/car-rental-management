-- Only the SECURITY DEFINER RPCs complete_vehicle_checkout/checkin
-- may write handover records. Keep SELECT for dashboards/history.
-- Existing records are untouched; service_role/postgres retain privileges.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.checkouts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.checkins FROM authenticated;

-- Restore if needed:
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.checkouts TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.checkins TO authenticated;
