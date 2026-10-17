# Rentovio — security snapshot (2026-10-17)

**REFERENCE ONLY — do not execute these SQL scripts against the running Supabase project.**

This folder records the *observed current security configuration* as of 2026-10-17, using read-only metadata queries against the live project's PostgreSQL catalog. It is an archive, **not** a tested migration chain or a full disaster-recovery backup. It was created outside `supabase/migrations/` intentionally.

## Contents

- `security_2026-10-17_functions.sql` — definitions of 4 public functions; role-specific EXECUTE rights.
- `security_2026-10-17_policies.sql` — enabled RLS for 17 public tables, 68 public policies and 7 Supabase Storage policies.
- `security_2026-10-17_table_privileges.sql` — effective grants to `anon` and `authenticated` for 17 public tables; `cron_secrets` has no such grants.
- Two previously archived 2026-10-14 schema references are stored alongside these files.

## Other observed configuration, **not restored** by the SQL files

Storage buckets:
- `app-branding`: public
- `rental-photos`: private

Stored file counts at capture time:
- app-branding: 2 objects recorded, CONTENT NOT BACKED UP
- rental-photos: 7 objects recorded, CONTENT NOT BACKED UP

Scheduled job: `cleanup-reservation-photos-daily`, schedule `0 3 * * *`, active=true. **The job command, authorization secret and environment configuration are NOT included.**

## Critical limitations

1. **Not a full backup**: No table row data, Supabase Auth users/passwords, Storage object bytes, Vault/cron secret values, environment variables, SMTP/Auth dashboard settings, API keys or restored/tested environment.
2. **Not a ready-to-run restore script**: Before use, the base table structures, foreign keys, extensions, Auth/Storage infrastructure and migration history must be reconciled. Do not run against the current database.
3. Migrations are currently out of sync: two recorded as applied in Supabase but missing from `main` (archived here separately), while three older files exist in GitHub but are not recorded in Supabase's migration history. Do not apply those blindly.
4. `security_2026-10-17_policies.sql` contains DROP/CREATE POLICY statements for a **new, isolated restoration environment**. These statements would modify access controls if someone mistakenly ran them on the live database.
5. All security policies/functions/roles may need adjustment before reuse for a different rental company. No company-specific dataset is included in these snapshots.

## Recommended future restore order

Create a disposable **isolated** environment first; reconcile base migrations; review missing schema references; recreate functions and their rights; recreate RLS and Storage policies; review table privileges; configure Storage buckets, Auth, secrets and cron independently; test permissions using real separate roles. **No restore test has been performed yet.**
