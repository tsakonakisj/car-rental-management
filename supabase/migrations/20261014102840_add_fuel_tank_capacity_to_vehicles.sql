/*
# Add fuel_tank_capacity to vehicles table

1. Changes
- Adds a nullable `fuel_tank_capacity` column (numeric, in liters) to the `vehicles` table.
- Allows decimal values greater than zero (CHECK constraint: value > 0 when not null).
- No existing data is modified — the column defaults to NULL.
2. Security
- No RLS or policy changes. Existing policies on `vehicles` remain unchanged.
3. Notes
- Safe to re-run: uses a DO block with IF NOT EXISTS check.
- No destructive operations.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'fuel_tank_capacity'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN fuel_tank_capacity numeric CHECK (fuel_tank_capacity > 0);
  END IF;
END $$;
