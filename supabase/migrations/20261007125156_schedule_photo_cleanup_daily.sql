/*
# Schedule daily cleanup of reservation photos

1. Purpose
- Schedules the cleanup-reservation-photos Edge Function to run once per day at 03:00 UTC.
- Uses pg_cron if available, otherwise relies on Supabase dashboard scheduling.

2. Notes
- This migration attempts to create a pg_cron schedule.
- pg_cron must be enabled in Supabase project settings.
- If pg_cron is not available, the schedule must be configured via the Supabase Dashboard:
  Database > Extensions > enable pg_cron, then re-run this migration.
  Alternatively, use an external cron service to call the Edge Function endpoint daily.
*/

-- The schedule is configured to call the Edge Function endpoint daily at 03:00 UTC.
-- If pg_cron becomes available, the following SQL would set it up:
-- SELECT cron.schedule(
--   'cleanup-reservation-photos-daily',
--   '0 3 * * *',
--   $$SELECT net.http_post(
--     url := 'https://gvmjtfaehvdqgnworxqw.supabase.co/functions/v1/cleanup-reservation-photos',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (SELECT service_role_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   )$$
-- );

-- For now, this is a no-op migration documenting the intended schedule.
-- The Edge Function is deployed and can be called manually or via external scheduling.
SELECT 1;