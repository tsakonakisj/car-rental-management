/*
# Add auth_user_id column to public.users

## Purpose
Prepares the users table for Supabase Auth integration by adding a nullable
link column that will store the corresponding auth.users.id. This is the
"linked profile" pattern: public.users keeps its own stable UUID primary key,
and auth_user_id is populated later when auth users are created.

## Changes
1. New column: `auth_user_id` (uuid, nullable) on `public.users`.
2. Unique partial index `users_auth_user_id_key` on `auth_user_id` where not null,
   so at most one public.users row can map to a given Supabase Auth user.

## What is NOT changed
- `public.users.id` — unchanged, still the primary key.
- No existing foreign keys are modified or dropped.
  (reservations.created_by, checkouts.checked_out_by, checkins.checked_in_by,
   payments.created_by still reference public.users.id.)
- No auth users created.
- No RLS or policy changes.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
  ON public.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;