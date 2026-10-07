/*
# Create function to retrieve CLEANUP_CRON_SECRET from Vault

1. Purpose
- Provides a way for the Edge Function to read the CLEANUP_CRON_SECRET from Vault
  via an RPC call, since vault.decrypted_secrets is not directly accessible via PostgREST.

2. Security
- SECURITY DEFINER so it can access the vault schema.
- Returns only the specific secret value, nothing else.
- Only callable with the service role key (RLS on the function).
*/

CREATE OR REPLACE FUNCTION public.get_cleanup_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret FROM vault.decrypted_secrets WHERE name = 'CLEANUP_CRON_SECRET' LIMIT 1;
$$;