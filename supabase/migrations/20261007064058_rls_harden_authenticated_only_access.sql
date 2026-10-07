/*
# RLS Hardening: Block Anonymous Access, Allow Authenticated

## Purpose
Replace the fully open `open_access` policies (TO public, USING true, WITH CHECK true)
on all operational tables with authenticated-only policies. Anonymous users lose
all access to operational data. The login screen continues to work because it
only uses Supabase Auth (not table data) and `settings` retains anon SELECT.

## Changes per operational table (15 tables)
Tables: checkins, checkouts, customers, damages, extras, insurance_types,
payments, photos, pricing, reservation_extras, reservations, seasons,
stations, users, vehicles

1. RLS stays enabled.
2. Drop existing `open_access` policy.
3. Create `authenticated_access` policy: FOR ALL, TO authenticated,
   USING (true), WITH CHECK (true).
4. Revoke SELECT, INSERT, UPDATE, DELETE from anon.
5. Grant SELECT, INSERT, UPDATE, DELETE to authenticated (ensures grants exist).

## Changes for settings table
1. Enable RLS.
2. Drop any existing open policy.
3. Create `authenticated_all_settings`: FOR ALL, TO authenticated,
   USING (true), WITH CHECK (true).
4. Create `anon_read_settings`: FOR SELECT, TO anon, USING (true).
5. Revoke INSERT, UPDATE, DELETE from anon.
6. Keep anon SELECT grant. Grant authenticated full CRUD.

## No role-based restrictions yet
All authenticated users get full CRUD on all tables. Role-based restrictions
will be added in a follow-up migration.

## No schema, data, auth-user, or storage changes
*/

-- =============================================================
-- Operational tables: replace open_access with authenticated_only
-- =============================================================

DO $$
DECLARE
    tbl text;
    op_tables text[] := ARRAY[
        'checkins','checkouts','customers','damages','extras',
        'insurance_types','payments','photos','pricing',
        'reservation_extras','reservations','seasons','stations',
        'users','vehicles'
    ];
BEGIN
    FOREACH tbl IN ARRAY op_tables LOOP
        -- Drop old open policy
        EXECUTE format('DROP POLICY IF EXISTS "open_access" ON %I;', tbl);

        -- Create authenticated-only policy (drop first for idempotency)
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_access" ON %I;', tbl);
        EXECUTE format(
            'CREATE POLICY "authenticated_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
            tbl
        );

        -- Revoke anon CRUD
        EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON %I FROM anon;', tbl);

        -- Ensure authenticated retains CRUD
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated;', tbl);
    END LOOP;
END $$;

-- =============================================================
-- Settings table: enable RLS, anon SELECT only, authenticated full
-- =============================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "open_access" ON settings;
DROP POLICY IF EXISTS "authenticated_all_settings" ON settings;
DROP POLICY IF EXISTS "anon_read_settings" ON settings;

-- Authenticated: full CRUD
CREATE POLICY "authenticated_all_settings"
ON settings FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

-- Anon: SELECT only (needed for login page / branding)
CREATE POLICY "anon_read_settings"
ON settings FOR SELECT
TO anon
USING (true);

-- Revoke anon writes, keep anon SELECT
REVOKE INSERT, UPDATE, DELETE ON settings FROM anon;
GRANT SELECT ON settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO authenticated;
