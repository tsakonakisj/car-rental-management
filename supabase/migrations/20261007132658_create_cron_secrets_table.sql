/*
# Create secure storage for cron secret

1. Purpose
- Stores the CLEANUP_CRON_SECRET in a dedicated table since Vault decryption is not 
  returning the expected plaintext value via the decrypted_secrets view.
- The secret is accessible only via a SECURITY DEFINER function.

2. New Tables
- `cron_secrets` — stores key/value pairs for cron authorization
  - `id` uuid PK
  - `name` text unique (e.g. 'CLEANUP_CRON_SECRET')
  - `value` text (the secret)
  - `created_at` timestamptz

3. Security
- RLS enabled, no policies (table is inaccessible to anon/authenticated roles directly).
- Only accessible via SECURITY DEFINER function `get_cron_secret(name text)`.
*/

CREATE TABLE IF NOT EXISTS cron_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cron_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_cron_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM cron_secrets WHERE name = secret_name LIMIT 1;
$$;

