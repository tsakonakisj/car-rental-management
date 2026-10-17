-- Rentovio / Car Rental Management: RLS policy definitions and enabled flags
-- Snapshot date: 2026-10-17 (read directly from live Supabase)
-- BACKUP REFERENCE ONLY. NEVER EXECUTE DIRECTLY AGAINST THE LIVE DATABASE.
-- NOT a tracked migration. Needs expert reconciliation and isolated restore test.
-- No customer data or secret values are included.

-- 17 application tables had RLS enabled at capture time.
ALTER TABLE "public"."checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cron_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."damages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."insurance_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservation_extras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;

-- Policies below are recreations of the observed definitions (not original migrations).
-- Requires base schema, functions, roles and Supabase Storage schema to exist first.

DROP POLICY IF EXISTS "op_delete_all" ON "public"."checkins";
CREATE POLICY "op_delete_all" ON "public"."checkins" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."checkins";
CREATE POLICY "op_insert_all" ON "public"."checkins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."checkins";
CREATE POLICY "op_select_all" ON "public"."checkins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."checkins";
CREATE POLICY "op_update_all" ON "public"."checkins" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_all" ON "public"."checkouts";
CREATE POLICY "op_delete_all" ON "public"."checkouts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."checkouts";
CREATE POLICY "op_insert_all" ON "public"."checkouts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."checkouts";
CREATE POLICY "op_select_all" ON "public"."checkouts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."checkouts";
CREATE POLICY "op_update_all" ON "public"."checkouts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_all" ON "public"."customers";
CREATE POLICY "op_delete_all" ON "public"."customers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."customers";
CREATE POLICY "op_insert_all" ON "public"."customers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."customers";
CREATE POLICY "op_select_all" ON "public"."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."customers";
CREATE POLICY "op_update_all" ON "public"."customers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_damages_admin" ON "public"."damages";
CREATE POLICY "op_delete_damages_admin" ON "public"."damages" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."damages";
CREATE POLICY "op_insert_all" ON "public"."damages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."damages";
CREATE POLICY "op_select_all" ON "public"."damages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."damages";
CREATE POLICY "op_update_all" ON "public"."damages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_mgmt" ON "public"."extras";
CREATE POLICY "op_delete_mgmt" ON "public"."extras" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_insert_mgmt" ON "public"."extras";
CREATE POLICY "op_insert_mgmt" ON "public"."extras" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."extras";
CREATE POLICY "op_select_all" ON "public"."extras" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_mgmt" ON "public"."extras";
CREATE POLICY "op_update_mgmt" ON "public"."extras" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_delete_mgmt" ON "public"."insurance_types";
CREATE POLICY "op_delete_mgmt" ON "public"."insurance_types" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_insert_mgmt" ON "public"."insurance_types";
CREATE POLICY "op_insert_mgmt" ON "public"."insurance_types" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."insurance_types";
CREATE POLICY "op_select_all" ON "public"."insurance_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_mgmt" ON "public"."insurance_types";
CREATE POLICY "op_update_mgmt" ON "public"."insurance_types" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_delete_all" ON "public"."payments";
CREATE POLICY "op_delete_all" ON "public"."payments" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."payments";
CREATE POLICY "op_insert_all" ON "public"."payments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."payments";
CREATE POLICY "op_select_all" ON "public"."payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."payments";
CREATE POLICY "op_update_all" ON "public"."payments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_photos_admin" ON "public"."photos";
CREATE POLICY "op_delete_photos_admin" ON "public"."photos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."photos";
CREATE POLICY "op_insert_all" ON "public"."photos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."photos";
CREATE POLICY "op_select_all" ON "public"."photos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."photos";
CREATE POLICY "op_update_all" ON "public"."photos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "pricing_delete_mgmt" ON "public"."pricing";
CREATE POLICY "pricing_delete_mgmt" ON "public"."pricing" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "pricing_insert_mgmt" ON "public"."pricing";
CREATE POLICY "pricing_insert_mgmt" ON "public"."pricing" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "pricing_select_agent" ON "public"."pricing";
CREATE POLICY "pricing_select_agent" ON "public"."pricing" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = 'agent'::text));

DROP POLICY IF EXISTS "pricing_select_mgmt" ON "public"."pricing";
CREATE POLICY "pricing_select_mgmt" ON "public"."pricing" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "pricing_update_mgmt" ON "public"."pricing";
CREATE POLICY "pricing_update_mgmt" ON "public"."pricing" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_delete_all" ON "public"."reservation_extras";
CREATE POLICY "op_delete_all" ON "public"."reservation_extras" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."reservation_extras";
CREATE POLICY "op_insert_all" ON "public"."reservation_extras" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."reservation_extras";
CREATE POLICY "op_select_all" ON "public"."reservation_extras" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."reservation_extras";
CREATE POLICY "op_update_all" ON "public"."reservation_extras" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_delete_reservations_admin" ON "public"."reservations";
CREATE POLICY "op_delete_reservations_admin" ON "public"."reservations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((get_current_role() = 'admin'::text) AND (status = ANY (ARRAY['upcoming'::text, 'cancelled'::text]))));

DROP POLICY IF EXISTS "op_insert_all" ON "public"."reservations";
CREATE POLICY "op_insert_all" ON "public"."reservations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."reservations";
CREATE POLICY "op_select_all" ON "public"."reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_all" ON "public"."reservations";
CREATE POLICY "op_update_all" ON "public"."reservations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "seasons_delete_mgmt" ON "public"."seasons";
CREATE POLICY "seasons_delete_mgmt" ON "public"."seasons" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "seasons_insert_mgmt" ON "public"."seasons";
CREATE POLICY "seasons_insert_mgmt" ON "public"."seasons" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "seasons_select_agent" ON "public"."seasons";
CREATE POLICY "seasons_select_agent" ON "public"."seasons" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = 'agent'::text));

DROP POLICY IF EXISTS "seasons_select_mgmt" ON "public"."seasons";
CREATE POLICY "seasons_select_mgmt" ON "public"."seasons" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "seasons_update_mgmt" ON "public"."seasons";
CREATE POLICY "seasons_update_mgmt" ON "public"."seasons" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "settings_delete_admin" ON "public"."settings";
CREATE POLICY "settings_delete_admin" ON "public"."settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "settings_insert_admin" ON "public"."settings";
CREATE POLICY "settings_insert_admin" ON "public"."settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "settings_select_admin" ON "public"."settings";
CREATE POLICY "settings_select_admin" ON "public"."settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "settings_select_anon" ON "public"."settings";
CREATE POLICY "settings_select_anon" ON "public"."settings" AS PERMISSIVE FOR SELECT TO "anon" USING ((key = ANY (ARRAY['company'::text, 'app_logo'::text, 'app_logo_light'::text])));

DROP POLICY IF EXISTS "settings_update_admin" ON "public"."settings";
CREATE POLICY "settings_update_admin" ON "public"."settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = 'admin'::text)) WITH CHECK ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_delete_mgmt" ON "public"."stations";
CREATE POLICY "op_delete_mgmt" ON "public"."stations" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_insert_mgmt" ON "public"."stations";
CREATE POLICY "op_insert_mgmt" ON "public"."stations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."stations";
CREATE POLICY "op_select_all" ON "public"."stations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_mgmt" ON "public"."stations";
CREATE POLICY "op_update_mgmt" ON "public"."stations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "users_delete_admin" ON "public"."users";
CREATE POLICY "users_delete_admin" ON "public"."users" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "users_insert_admin" ON "public"."users";
CREATE POLICY "users_insert_admin" ON "public"."users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "users_select_admin" ON "public"."users";
CREATE POLICY "users_select_admin" ON "public"."users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "users_select_own_profile" ON "public"."users";
CREATE POLICY "users_select_own_profile" ON "public"."users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth_user_id = auth.uid()) AND (get_current_role() = ANY (ARRAY['manager'::text, 'agent'::text]))));

DROP POLICY IF EXISTS "users_update_admin" ON "public"."users";
CREATE POLICY "users_update_admin" ON "public"."users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = 'admin'::text)) WITH CHECK ((get_current_role() = 'admin'::text));

DROP POLICY IF EXISTS "op_delete_mgmt" ON "public"."vehicles";
CREATE POLICY "op_delete_mgmt" ON "public"."vehicles" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_insert_mgmt" ON "public"."vehicles";
CREATE POLICY "op_insert_mgmt" ON "public"."vehicles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "op_select_all" ON "public"."vehicles";
CREATE POLICY "op_select_all" ON "public"."vehicles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text])));

DROP POLICY IF EXISTS "op_update_mgmt" ON "public"."vehicles";
CREATE POLICY "op_update_mgmt" ON "public"."vehicles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

DROP POLICY IF EXISTS "auth_delete_app_branding" ON "storage"."objects";
CREATE POLICY "auth_delete_app_branding" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'app-branding'::text) AND (get_current_role() = 'admin'::text)));

DROP POLICY IF EXISTS "auth_insert_app_branding" ON "storage"."objects";
CREATE POLICY "auth_insert_app_branding" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'app-branding'::text) AND (get_current_role() = 'admin'::text)));

DROP POLICY IF EXISTS "auth_update_app_branding" ON "storage"."objects";
CREATE POLICY "auth_update_app_branding" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'app-branding'::text) AND (get_current_role() = 'admin'::text))) WITH CHECK (((bucket_id = 'app-branding'::text) AND (get_current_role() = 'admin'::text)));

DROP POLICY IF EXISTS "public_read_app_branding" ON "storage"."objects";
CREATE POLICY "public_read_app_branding" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((bucket_id = 'app-branding'::text) AND storage.allow_only_operation('storage.object.get'::text)));

DROP POLICY IF EXISTS "rental_photos_authed_delete" ON "storage"."objects";
CREATE POLICY "rental_photos_authed_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'rental-photos'::text) AND (get_current_role() = 'admin'::text)));

DROP POLICY IF EXISTS "rental_photos_authed_read" ON "storage"."objects";
CREATE POLICY "rental_photos_authed_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'rental-photos'::text) AND (get_current_role() IS NOT NULL)));

DROP POLICY IF EXISTS "rental_photos_authed_upload" ON "storage"."objects";
CREATE POLICY "rental_photos_authed_upload" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'rental-photos'::text) AND (get_current_role() IS NOT NULL)));

