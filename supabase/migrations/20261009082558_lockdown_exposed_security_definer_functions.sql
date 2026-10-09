/*
# Lock down exposed SECURITY DEFINER functions + cron_secrets grants

## Findings fixed (from security audit)
1. CRITICAL: get_cleanup_cron_secret() was callable by anon + authenticated
   — anyone with the anon key could retrieve the CLEANUP_CRON_SECRET plaintext.
2. HIGH: get_photos_for_cleanup() was callable by anon + authenticated
   — bypassed RLS, exposed all photo storage paths.
3. HIGH: cron_secrets table had full grants (incl. TRUNCATE) to anon + authenticated
   — RLS with no policies blocked PostgREST, but grants were dangerously broad.

## Changes
- REVOKE EXECUTE on both functions from PUBLIC, anon, authenticated.
  Only service_role / postgres can call them (used by the Edge Function + pg_cron).
- REVOKE ALL on cron_secrets from anon + authenticated.
  Keep postgres + service_role grants. RLS stays enabled (no policies = no API access).

## Not changed
- Edge Function source, cron job schedule, cron job headers, storage policies,
  pg_net extension, Auth users, app code, unrelated schema.
*/

-- 1. get_cleanup_cron_secret() — revoke all client-facing execute
REVOKE EXECUTE ON FUNCTION public.get_cleanup_cron_secret() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cleanup_cron_secret() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cleanup_cron_secret() FROM authenticated;

-- 2. get_photos_for_cleanup() — revoke all client-facing execute
REVOKE EXECUTE ON FUNCTION public.get_photos_for_cleanup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_photos_for_cleanup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_photos_for_cleanup() FROM authenticated;

-- 3. cron_secrets — strip all grants from anon + authenticated
REVOKE ALL ON public.cron_secrets FROM anon;
REVOKE ALL ON public.cron_secrets FROM authenticated;
