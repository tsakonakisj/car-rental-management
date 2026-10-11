/*
# Add next-service reminder fields to vehicles

1. Changes
- Adds `next_service_date` (date, nullable) — the date the vehicle should next be serviced.
- Adds `next_service_odometer` (integer, nullable) — the odometer reading (km) at which the vehicle should next be serviced.
- Both columns are optional; existing rows get NULL. No data loss, no type changes, no RLS changes.

2. Security
- No policy changes. The new columns inherit the existing vehicles RLS policies.

3. Usage
- The Dashboard alert system checks next_service_date within a configurable day threshold (default 30) and next_service_odometer within a configurable km threshold (default 1000) of the current odometer.
- Both thresholds are read from the settings table; falling back to defaults when unset.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'next_service_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'next_service_odometer'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_odometer integer;
  END IF;
END $$;
