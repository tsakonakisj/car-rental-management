/*
# Update cron job to send x-cron-secret header from Vault

1. Purpose
- Unschedules the old cron job that called the Edge Function without authorization.
- Creates a new cron job that reads CLEANUP_CRON_SECRET from Vault and sends it
  in the x-cron-secret header.
- Same 03:00 UTC daily schedule.

2. Security
- The secret is read from vault.decrypted_secrets server-side only.
- Never exposed in frontend code or VITE env variables.
*/

SELECT cron.unschedule('cleanup-reservation-photos-daily');

SELECT cron.schedule(
  'cleanup-reservation-photos-daily',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://gvmjtfaehvdqgnworxqw.supabase.co/functions/v1/cleanup-reservation-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT secret FROM vault.decrypted_secrets WHERE name = 'CLEANUP_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    )
  $$
);