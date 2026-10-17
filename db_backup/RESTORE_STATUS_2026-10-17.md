# Rentovio — backup status and restoration checklist (2026-10-17)

> This is a **development-project source and schema-reference archive**, **NOT a tested full-disaster-recovery backup**.
> **Do not run archived SQL on the active Supabase project.**

## Confirmed captured

- Source-code snapshot from GitHub `main`, commit `f9d5f0fcaf4441257387fa666bbdff0414e5cf50` (2026-10-15).
- Existing 53 migration source files under `supabase/migrations/` (as in the captured commit).
- The matching deployed source of the Edge Function `cleanup-reservation-photos` is present in GitHub.
- Two separately reconstructed schema references: `20261014173539_unique_checkout_per_reservation.sql` and `20261014173956_add_reservation_contract_issued_at.sql`.
- Live RLS: 17/17 public tables enabled; 68 public policies and 7 Storage policies.
- Live definition of 4 public SQL functions, their EXECUTE permissions, and table privileges archived in dedicated security snapshots.
- Live schema-catalog reference `schema_catalog_2026-10-17.json`: 155 public-table columns, 55 constraints, 24 indexes, 7 installed extensions, Storage bucket settings, and migration history (52 records).
- Active cron job name and schedule archived **without** secret values or request headers.

## Still NOT captured or verified

1. **Most recent code inside Bolt:** cannot prove from GitHub that the app has no source changes newer than the 2026-10-15 `main` commit. A final Bolt↔GitHub sync check is required if code changed in Bolt afterward.
2. **Executable, tested database restore:** not completed. The catalog JSON and SQL references are **not a pg_dump** and must not be mistaken for one.
3. **Migration history discrepancy:** Supabase records 52 migrations; GitHub has 53 source files. Two migrations recorded as applied in live DB are archived in `db_backup`, not in `supabase/migrations`. Three older GitHub files are not present in the live migration history:
   - `20260625091814_create_settings_table.sql`
   - `20260625100859_force_postgrest_schema_reload_settings.sql`
   - `20260625100923_create_settings_functions.sql`

   **Do not replay all 53 source migrations blindly.** In particular, `create_settings_functions.sql` defines additional SECURITY DEFINER functions that were not present among the 4 live public functions during this review. Reconcile these only in an isolated test environment.
4. **Database records / Auth users / passwords:** excluded. The application is in development and test reservations/customer records were deliberately not archived.
5. **Storage file contents:** excluded. At last check there were 2 objects in `app-branding` and 7 in `rental-photos`. Bucket metadata and policies are archived, **not image/file bytes**.
6. **Secrets and external configuration:** Supabase Auth dashboard settings, SMTP credentials, service-role keys, Vault/cron secret values, environment variables, and external automation settings are not archived.
7. **Independent off-platform copy:** this branch is in the same GitHub repository as `main`. A separate archive download or trusted offline copy is recommended.

## Safe remaining procedure to certify restoration

1. Verify whether any Bolt-only source changes after 2026-10-15 remain unsynced.
2. For a future *isolated test project only*, reconcile migrations with the observed live schema; never execute reconciliation directly on the current project.
3. Recreate non-secret Storage bucket definitions, SQL functions, RLS, and privileges from reviewed references.
4. Supply fresh environment-specific secrets and Auth/SMTP configuration through secure settings, not through public GitHub.
5. Test application startup, sign-in, reservation, Check-In/Out, PDF creation, authorization rules, and cron/photo cleanup in isolation.
6. Confirm whether Storage file bytes need preserving before real customer use; use a protected nonpublic backup for private rental photos.

## Explicit exclusions and safety

- No changes to `main`, production application code, the active Supabase project, or live customer data were made when producing this reference archive.
- These archives include metadata and definitions only, not customer rows or secret values.
- This archive is appropriate as a **development checkpoint**; it does **not** by itself prove that all functionality can be restored.
