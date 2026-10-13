/*
# Create app-branding storage bucket for application logo

1. New Storage
- Public bucket `app-branding` for the application logo image.
- Public read access (logo must display without authentication).
- Authenticated write/delete access (only admins manage the logo via the app).

2. Security
- SELECT (public read): anyone can read the logo.
- INSERT/UPDATE/DELETE: restricted to authenticated users (the app enforces admin-only in the UI).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-branding', 'app-branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_app_branding" ON storage.objects;
CREATE POLICY "public_read_app_branding"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'app-branding');

DROP POLICY IF EXISTS "auth_insert_app_branding" ON storage.objects;
CREATE POLICY "auth_insert_app_branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-branding');

DROP POLICY IF EXISTS "auth_update_app_branding" ON storage.objects;
CREATE POLICY "auth_update_app_branding"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app-branding')
  WITH CHECK (bucket_id = 'app-branding');

DROP POLICY IF EXISTS "auth_delete_app_branding" ON storage.objects;
CREATE POLICY "auth_delete_app_branding"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app-branding');

NOTIFY pgrst, 'reload_schema';
