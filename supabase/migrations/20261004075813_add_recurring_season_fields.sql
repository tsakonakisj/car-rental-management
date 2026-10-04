/*
# Add recurring season date fields to seasons table

1. Purpose
   Converts seasons from fixed calendar dates to annually recurring periods
   so the same season definition works every year without manual updates.

2. New Columns (all nullable, additive — no existing columns touched)
   - start_month int  — month (1-12) the season starts each year
   - start_day   int  — day-of-month (1-31) the season starts
   - end_month   int  — month (1-12) the season ends each year
   - end_day     int  — day-of-month (1-31) the season ends
   - priority    int  DEFAULT 0 — higher value wins when seasons overlap

3. Backfill
   - start_month / start_day / end_month / end_day populated from existing
     start_date / end_date via EXTRACT().
   - priority backfilled from multiplier * 100 so the current intended
     ordering (Peak > High > Mid > Low) is preserved. priority is a
     standalone column going forward and does not depend on multiplier.

4. CHECK Constraints
   - start_month, end_month: BETWEEN 1 AND 12
   - start_day, end_day:     BETWEEN 1 AND 31

5. No existing columns dropped, renamed, or modified.
   No booking or pricing logic changed.
   No unrelated tables touched.
*/

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS start_month int,
  ADD COLUMN IF NOT EXISTS start_day   int,
  ADD COLUMN IF NOT EXISTS end_month   int,
  ADD COLUMN IF NOT EXISTS end_day     int,
  ADD COLUMN IF NOT EXISTS priority    int DEFAULT 0;

UPDATE seasons SET
  start_month = EXTRACT(MONTH FROM start_date)::int,
  start_day   = EXTRACT(DAY   FROM start_date)::int,
  end_month   = EXTRACT(MONTH FROM end_date)::int,
  end_day     = EXTRACT(DAY   FROM end_date)::int,
  priority    = (multiplier * 100)::int
WHERE start_month IS NULL;

ALTER TABLE seasons
  ADD CONSTRAINT seasons_start_month_chk CHECK (start_month IS NULL OR start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT seasons_end_month_chk   CHECK (end_month   IS NULL OR end_month   BETWEEN 1 AND 12),
  ADD CONSTRAINT seasons_start_day_chk   CHECK (start_day   IS NULL OR start_day   BETWEEN 1 AND 31),
  ADD CONSTRAINT seasons_end_day_chk     CHECK (end_day     IS NULL OR end_day     BETWEEN 1 AND 31);
