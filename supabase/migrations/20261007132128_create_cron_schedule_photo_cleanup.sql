/*
# Schedule daily cleanup of reservation photos via pg_cron

1. Purpose
- Runs the cleanup-reservation-photos Edge Function once per day at 03:00 UTC.
- The Edge Function has verify_jwt=false, so no auth header needed for the call.
- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY from its own Deno env internally.

2. Notes
- pg_cron and pg_net extensions are now installed.
- No changes to existing tables, RLS, or Auth.
- The cron job is created with a unique name and can be unscheduled if needed.
*/

SELECT cron.schedule(
  'cleanup-reservation-photos-daily',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://gvmjtfaehvdqgnworxqw.supabase.co/functions/v1/cleanup-reservation-photos',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
  $$
);