/*
# Create Auth user for agent@antilia.com and link to public.users

## Purpose
Create a Supabase Auth user for the existing agent@antilia.com profile
and link the auth UUID back to public.users.auth_user_id.

## Method
Uses a SECURITY DEFINER function to insert into auth.users and auth.identities,
then updates public.users.auth_user_id. The function is dropped after use.

## No other changes
- No RLS or policy changes.
- No application code changes.
- No other users modified.
*/

CREATE OR REPLACE FUNCTION public._temp_create_agent_auth_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions, pg_temp
AS $$
DECLARE
  new_auth_id uuid;
BEGIN
  SELECT id INTO new_auth_id FROM auth.users WHERE email = 'agent@antilia.com';
  IF new_auth_id IS NOT NULL THEN
    RETURN new_auth_id;
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'agent@antilia.com',
    crypt('AntiliaAgent2026!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_auth_id;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_auth_id,
    jsonb_build_object('sub', new_auth_id::text, 'email', 'agent@antilia.com'),
    'email',
    new_auth_id::text,
    now(),
    now(),
    now()
  );

  RETURN new_auth_id;
END;
$$;

DO $$
DECLARE
  auth_id uuid;
BEGIN
  SELECT public._temp_create_agent_auth_user() INTO auth_id;
  RAISE NOTICE 'Auth user id: %', auth_id;

  UPDATE public.users
  SET auth_user_id = auth_id
  WHERE email = 'agent@antilia.com' AND auth_user_id IS NULL;

  RAISE NOTICE 'Linked to public.users';
END $$;

DROP FUNCTION public._temp_create_agent_auth_user();
