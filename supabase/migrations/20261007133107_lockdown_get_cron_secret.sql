/*
# Lock down get_cron_secret to service-role only

1. Purpose
- Revoke EXECUTE on get_cron_secret from PUBLIC, anon, and authenticated.
- Only the service role (used by Edge Functions and pg_cron) can call it.
- Prevents any frontend or anon-key client from reading the secret.

2. Security
- No changes to cleanup logic or unrelated schema.
*/

REVOKE EXECUTE ON FUNCTION public.get_cron_secret(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cron_secret(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cron_secret(text) FROM authenticated;