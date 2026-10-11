/*
# Add nullable columns for season periods 2 and 3

## Purpose
Each season previously supported only one recurring date period (start_month/start_day/end_month/end_day).
This migration adds 8 nullable columns to the seasons table so a single season can represent
up to 3 recurring date periods that share the same category prices, priority, and multiplier.

## Changes
- Adds to `seasons` table:
  - start_month_2, start_day_2, end_month_2, end_day_2 (all INT, nullable) — period 2
  - start_month_3, start_day_3, end_month_3, end_day_3 (all INT, nullable) — period 3
- Existing seasons keep using period 1 (start_month/start_day/end_month/end_day).
  Periods 2 and 3 default to NULL and are only populated when a user adds them.

## Security
- No RLS policy changes. The new columns are on the existing `seasons` table,
  so all current policies (admin/manager CRUD, agent SELECT) automatically apply.
- No data migration needed — existing rows have NULL for the new columns.

## Notes
1. Period 1 columns (start_month, start_day, end_month, end_day) are NOT removed or altered.
2. The frontend will check all 3 periods when matching a booking date to a season.
3. Pricing is keyed by season_id, so all periods of a season share the same price matrix.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'start_month_2') THEN
    ALTER TABLE public.seasons ADD COLUMN start_month_2 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'start_day_2') THEN
    ALTER TABLE public.seasons ADD COLUMN start_day_2 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'end_month_2') THEN
    ALTER TABLE public.seasons ADD COLUMN end_month_2 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'end_day_2') THEN
    ALTER TABLE public.seasons ADD COLUMN end_day_2 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'start_month_3') THEN
    ALTER TABLE public.seasons ADD COLUMN start_month_3 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'start_day_3') THEN
    ALTER TABLE public.seasons ADD COLUMN start_day_3 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'end_month_3') THEN
    ALTER TABLE public.seasons ADD COLUMN end_month_3 INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND table_schema = 'public' AND column_name = 'end_day_3') THEN
    ALTER TABLE public.seasons ADD COLUMN end_day_3 INT;
  END IF;
END $$;