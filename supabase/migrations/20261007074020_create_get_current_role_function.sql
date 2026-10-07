/*
# Create get_current_role() helper function

## Purpose
Provides a safe, read-only way for RLS policies to determine the current
user's application role (admin / manager / agent) by resolving:

    auth.uid() -> public.users.auth_user_id -> public.users.role

## Why SECURITY DEFINER
A policy on `public.users` that queries `public.users` causes infinite
recursion. This function runs with the table owner's privileges, bypassing
RLS, so policies on any table can safely call it without recursion.

## Security
- SECURITY DEFINER, owned by postgres (default migration owner).
- Explicit search_path = public, pg_temp (prevents search-path injection).
- Read-only: single SELECT, no writes.
- EXECUTE granted only to authenticated; revoked from PUBLIC and anon.
- Returns NULL if no matching active user exists (deny-by-default).
- Only users with active = true are considered valid.

## No other changes
- No existing RLS policies modified.
- No table grants modified.
- No application code modified.
- No Auth users or data modified.
*/

-- Drop first for idempotency
DROP FUNCTION IF EXISTS public.get_current_role();

CREATE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.users
  WHERE auth_user_id = auth.uid()
    AND active = true
  LIMIT 1
$$;

-- Lock down execute: revoke from everyone, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.get_current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated;
