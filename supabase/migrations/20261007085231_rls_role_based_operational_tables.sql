/*
# Role-based RLS for operational tables

## Tables (12 total)

FULL CRUD (admin, manager, agent):
  reservations, customers, reservation_extras, checkouts, checkins,
  damages, photos, payments

ADMIN+MANAGER CRUD, AGENT SELECT-only:
  vehicles, stations, extras, insurance_types

## Changes
- Drop generic `authenticated_access` (FOR ALL, USING(true)) on all 12 tables.
- Add 4 role-based policies (SELECT/INSERT/UPDATE/DELETE) per table.
- Revoke all access from anon; grant full CRUD to authenticated.
- RLS stays enabled.

## No other changes
- users, settings, pricing, seasons policies untouched.
- No schema, data, application code, or Auth user changes.
*/

-- =============================================================
-- Helper: define a function to bulk-create policies for a table
-- =============================================================

-- FULL CRUD tables: all 3 roles get all 4 verbs
DO $$
DECLARE
  tbl text;
  full_crud_tables text[] := ARRAY[
    'reservations','customers','reservation_extras','checkouts','checkins',
    'damages','photos','payments'
  ];
  roles text := '''admin'', ''manager'', ''agent''';
BEGIN
  FOREACH tbl IN ARRAY full_crud_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_select_all" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_insert_all" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_update_all" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_delete_all" ON public.%I;', tbl);

    EXECUTE format($f$
      CREATE POLICY "op_select_all" ON public.%I
      FOR SELECT TO authenticated
      USING (public.get_current_role() IN (%s))
    $f$, tbl, roles);

    EXECUTE format($f$
      CREATE POLICY "op_insert_all" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (public.get_current_role() IN (%s))
    $f$, tbl, roles);

    EXECUTE format($f$
      CREATE POLICY "op_update_all" ON public.%I
      FOR UPDATE TO authenticated
      USING (public.get_current_role() IN (%s))
      WITH CHECK (public.get_current_role() IN (%s))
    $f$, tbl, roles, roles);

    EXECUTE format($f$
      CREATE POLICY "op_delete_all" ON public.%I
      FOR DELETE TO authenticated
      USING (public.get_current_role() IN (%s))
    $f$, tbl, roles);

    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM anon;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', tbl);
  END LOOP;
END $$;

-- AGENT SELECT-ONLY tables: admin+manager full CRUD, agent SELECT only
DO $$
DECLARE
  tbl text;
  select_only_tables text[] := ARRAY['vehicles','stations','extras','insurance_types'];
  all_roles text := '''admin'', ''manager'', ''agent''';
  mgmt_roles text := '''admin'', ''manager''';
BEGIN
  FOREACH tbl IN ARRAY select_only_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_select_all" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_insert_mgmt" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_update_mgmt" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "op_delete_mgmt" ON public.%I;', tbl);

    EXECUTE format($f$
      CREATE POLICY "op_select_all" ON public.%I
      FOR SELECT TO authenticated
      USING (public.get_current_role() IN (%s))
    $f$, tbl, all_roles);

    EXECUTE format($f$
      CREATE POLICY "op_insert_mgmt" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (public.get_current_role() IN (%s))
    $f$, tbl, mgmt_roles);

    EXECUTE format($f$
      CREATE POLICY "op_update_mgmt" ON public.%I
      FOR UPDATE TO authenticated
      USING (public.get_current_role() IN (%s))
      WITH CHECK (public.get_current_role() IN (%s))
    $f$, tbl, mgmt_roles, mgmt_roles);

    EXECUTE format($f$
      CREATE POLICY "op_delete_mgmt" ON public.%I
      FOR DELETE TO authenticated
      USING (public.get_current_role() IN (%s))
    $f$, tbl, mgmt_roles);

    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM anon;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', tbl);
  END LOOP;
END $$;
