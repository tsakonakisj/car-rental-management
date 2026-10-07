/*
# Role-Based RLS for users, settings, pricing, seasons

## Purpose
Replace the generic `authenticated_access` policy on 4 tables with
explicit role-based policies using `public.get_current_role()`.

## Access Model
| Table    | admin | manager | agent | anon    |
|----------|-------|---------|-------|---------|
| users    | CRUD  | none    | none  | none    |
| settings | CRUD  | none    | none  | SELECT  |
| pricing  | CRUD  | CRUD    | none  | none    |
| seasons  | CRUD  | CRUD    | none  | none    |

## Implementation
- Drop `authenticated_access` policy on each table.
- Create 4 role-based policies (SELECT/INSERT/UPDATE/DELETE) per table.
- Use `public.get_current_role()` for role checks (SECURITY DEFINER, no recursion).
- Keep RLS enabled on all 4 tables.
- Revoke anon CRUD where anon should have no access; keep anon SELECT on settings.
- Keep authenticated grants consistent with policies.

## No other changes
- No other tables modified.
- No application code modified.
- No Auth users or data modified.
*/

-- =============================================================
-- USERS: admin only
-- =============================================================

DROP POLICY IF EXISTS "authenticated_access" ON public.users;

-- admin CRUD
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT TO authenticated
  USING (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "users_update_admin" ON public.users;
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE TO authenticated
  USING (public.get_current_role() = 'admin');

-- Revoke anon entirely
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;

-- =============================================================
-- SETTINGS: admin full CRUD, anon SELECT only
-- =============================================================

DROP POLICY IF EXISTS "authenticated_all_settings" ON public.settings;
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;

-- admin CRUD
DROP POLICY IF EXISTS "settings_select_admin" ON public.settings;
CREATE POLICY "settings_select_admin" ON public.settings
  FOR SELECT TO authenticated
  USING (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "settings_insert_admin" ON public.settings;
CREATE POLICY "settings_insert_admin" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

DROP POLICY IF EXISTS "settings_delete_admin" ON public.settings;
CREATE POLICY "settings_delete_admin" ON public.settings
  FOR DELETE TO authenticated
  USING (public.get_current_role() = 'admin');

-- anon SELECT only
DROP POLICY IF EXISTS "settings_select_anon" ON public.settings;
CREATE POLICY "settings_select_anon" ON public.settings
  FOR SELECT TO anon
  USING (true);

-- Grants: anon SELECT only, authenticated full (policy enforces admin-only)
REVOKE INSERT, UPDATE, DELETE ON public.settings FROM anon;
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;

-- =============================================================
-- PRICING: admin + manager full CRUD
-- =============================================================

DROP POLICY IF EXISTS "authenticated_access" ON public.pricing;

DROP POLICY IF EXISTS "pricing_select_mgmt" ON public.pricing;
CREATE POLICY "pricing_select_mgmt" ON public.pricing
  FOR SELECT TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "pricing_insert_mgmt" ON public.pricing;
CREATE POLICY "pricing_insert_mgmt" ON public.pricing
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "pricing_update_mgmt" ON public.pricing;
CREATE POLICY "pricing_update_mgmt" ON public.pricing
  FOR UPDATE TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'))
  WITH CHECK (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "pricing_delete_mgmt" ON public.pricing;
CREATE POLICY "pricing_delete_mgmt" ON public.pricing
  FOR DELETE TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'));

-- Revoke anon entirely
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.pricing FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing TO authenticated;

-- =============================================================
-- SEASONS: admin + manager full CRUD
-- =============================================================

DROP POLICY IF EXISTS "authenticated_access" ON public.seasons;

DROP POLICY IF EXISTS "seasons_select_mgmt" ON public.seasons;
CREATE POLICY "seasons_select_mgmt" ON public.seasons
  FOR SELECT TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "seasons_insert_mgmt" ON public.seasons;
CREATE POLICY "seasons_insert_mgmt" ON public.seasons
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "seasons_update_mgmt" ON public.seasons;
CREATE POLICY "seasons_update_mgmt" ON public.seasons
  FOR UPDATE TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'))
  WITH CHECK (public.get_current_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "seasons_delete_mgmt" ON public.seasons;
CREATE POLICY "seasons_delete_mgmt" ON public.seasons
  FOR DELETE TO authenticated
  USING (public.get_current_role() IN ('admin', 'manager'));

-- Revoke anon entirely
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.seasons FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
