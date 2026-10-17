-- Rentovio / Car Rental Management: Observed client-role table privileges
-- Snapshot date: 2026-10-17 (read directly from live Supabase)
-- BACKUP REFERENCE ONLY. NEVER EXECUTE DIRECTLY AGAINST THE LIVE DATABASE.
-- NOT a tracked migration. Needs expert reconciliation and isolated restore test.
-- No customer data or secret values are included.

-- Service-role and owner permissions are intentionally left intact.

REVOKE ALL PRIVILEGES ON TABLE "public"."checkins" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."checkins" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."checkouts" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."checkouts" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."cron_secrets" FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."customers" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."customers" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."damages" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."damages" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."extras" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."extras" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."insurance_types" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."insurance_types" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."payments" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."payments" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."photos" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."photos" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."pricing" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."pricing" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."reservation_extras" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."reservation_extras" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."reservations" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."reservations" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."seasons" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."seasons" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."settings" FROM anon, authenticated;
GRANT SELECT ON TABLE "public"."settings" TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."settings" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."stations" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."stations" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."users" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."users" TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."vehicles" FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."vehicles" TO authenticated;
