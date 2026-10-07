/*
# Fix RLS on public.users: add self-profile SELECT for manager/agent

## Problem
AuthContext fetches the signed-in user's own public.users row by auth_user_id
after login/session restore. Current policies only allow admin SELECT, so
manager/agent get 0 rows and can't load their profile.

## Fix
- Keep existing admin CRUD policies (select/insert/update/delete via get_current_role).
- Add a SELECT policy for non-admin authenticated users to read only their own row
  where auth_user_id = auth.uid().
- Anon remains blocked (no grants, no policy).

## No other changes
- No application code changes.
- No Auth users or public.users data changes.
- No other tables or policies touched.
*/

-- Add self-profile SELECT for manager and agent (any authenticated non-admin)
DROP POLICY IF EXISTS "users_select_own_profile" ON public.users;
CREATE POLICY "users_select_own_profile" ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND public.get_current_role() IN ('manager', 'agent')
  );
