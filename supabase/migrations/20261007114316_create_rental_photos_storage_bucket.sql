/*
# Create private Storage bucket "rental-photos" for vehicle photos

1. Storage
- Creates a PRIVATE bucket named "rental-photos" (public = false).
- Used for Check-Out and Check-In vehicle photos.
- File path structure: reservations/{reservationId}/checkout/{filename}.jpg
                       reservations/{reservationId}/checkin/{filename}.jpg

2. Storage Policies (on storage.objects)
- INSERT: authenticated users can upload files under "rental-photos/".
- SELECT: authenticated users can read/list files under "rental-photos/".
- DELETE: authenticated users can delete files under "rental-photos/".
- Anonymous (anon) users have NO access — no policies target the anon role.
- All policies scope to bucket_id = 'rental-photos'.

3. Notes
- The bucket is private, so public URLs are not used. Signed URLs are generated client-side.
- No changes to existing tables, RLS, or Auth.
- No FK added on photos.reference_id (table supports multiple photo types).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-photos', 'rental-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Remove existing policies if re-running (idempotent)
DROP POLICY IF EXISTS "rental_photos_authed_upload" ON storage.objects;
DROP POLICY IF EXISTS "rental_photos_authed_read" ON storage.objects;
DROP POLICY IF EXISTS "rental_photos_authed_delete" ON storage.objects;

-- Authenticated users can upload to rental-photos bucket
CREATE POLICY "rental_photos_authed_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rental-photos');

-- Authenticated users can read/list from rental-photos bucket
CREATE POLICY "rental_photos_authed_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rental-photos');

-- Authenticated users can delete from rental-photos bucket
CREATE POLICY "rental_photos_authed_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rental-photos');