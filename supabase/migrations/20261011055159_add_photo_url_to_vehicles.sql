/*
# Add photo_url column to vehicles table

1. Changes
- Adds `photo_url` (text, nullable) to the `vehicles` table.
- Stores the storage path of the main vehicle photo in the private `rental-photos` bucket.
- No new tables, no RLS changes, no data loss — existing rows get NULL.

2. Security
- No policy changes. The column is accessible under the existing vehicles RLS policies.
- The photo itself stays in the private `rental-photos` bucket and is served via signed URLs.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN photo_url text;
  END IF;
END $$;
