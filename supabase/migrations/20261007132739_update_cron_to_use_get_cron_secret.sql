/*
# Update cron job to use get_cron_secret function instead of vault.decrypted_secrets

1. Purpose
- The cron job previously read CLEANUP_CRON_SECRET from vault.decrypted_secrets,
  which returns an encrypted/wrapped value that doesn't match the plaintext.
- Now reads from the cron_secrets table via the get_cron_secret() SECURITY DEFINER function.
- Same 03:00 UTC daily schedule.
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
        'x-cron-secret', public.get_cron_secret('CLEANUP_CRON_SECRET')
      ),
      body := '{}'::jsonb
    )
  $$
);