/*
# Store CLEANUP_CRON_SECRET in Supabase Vault

1. Purpose
- Stores a shared secret used to authorize the daily cron-triggered Edge Function call.
- The Edge Function checks the x-cron-secret header against this value.
- pg_net reads this secret from Vault and sends it in the x-cron-secret header.

2. Security
- Secret is stored in vault.secrets (encrypted at rest).
- Never exposed in frontend code or VITE env variables.
- Only accessible server-side.
*/

SELECT vault.create_secret(
  'dev8RJhmIg0SS2moCqWCA6JEYOJGJ0v6rlTgYpxYMCM=',
  'CLEANUP_CRON_SECRET',
  'Shared secret for authorizing the cleanup-reservation-photos cron job'
);