-- Rentovio / Car Rental Management: Function definitions and EXECUTE permissions
-- Snapshot date: 2026-10-17 (read directly from live Supabase)
-- BACKUP REFERENCE ONLY. NEVER EXECUTE DIRECTLY AGAINST THE LIVE DATABASE.
-- NOT a tracked migration. Needs expert reconciliation and isolated restore test.
-- No customer data or secret values are included.

-- Recorded live function: get_cleanup_cron_secret()
CREATE OR REPLACE FUNCTION public.get_cleanup_cron_secret()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT secret FROM vault.decrypted_secrets WHERE name = 'CLEANUP_CRON_SECRET' LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION "public"."get_cleanup_cron_secret"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_cleanup_cron_secret"() TO service_role;

-- Recorded live function: get_cron_secret(secret_name text)
CREATE OR REPLACE FUNCTION public.get_cron_secret(secret_name text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT value FROM cron_secrets WHERE name = secret_name LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION "public"."get_cron_secret"(secret_name text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_cron_secret"(secret_name text) TO service_role;

-- Recorded live function: get_current_role()
CREATE OR REPLACE FUNCTION public.get_current_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT role
FROM public.users
WHERE auth_user_id = auth.uid()
AND active = true
LIMIT 1
$function$;
REVOKE EXECUTE ON FUNCTION "public"."get_current_role"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_current_role"() TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_current_role"() TO service_role;

-- Recorded live function: get_photos_for_cleanup()
CREATE OR REPLACE FUNCTION public.get_photos_for_cleanup()
 RETURNS TABLE(id uuid, url text, type text, reservation_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT p.id, p.url, p.type, p.reference_id AS reservation_id
FROM photos p
JOIN (
SELECT reservation_id, MAX(checked_in_at) AS latest_checkin
FROM checkins
GROUP BY reservation_id
) latest ON latest.reservation_id = p.reference_id
WHERE p.type IN ('checkout', 'checkin')
AND latest.latest_checkin < now() - interval '7 days';
$function$;
REVOKE EXECUTE ON FUNCTION "public"."get_photos_for_cleanup"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_photos_for_cleanup"() TO service_role;

