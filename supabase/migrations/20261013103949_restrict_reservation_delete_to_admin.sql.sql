-- Restrict permanent reservation deletion to admin role only.
-- SELECT, INSERT, UPDATE remain unchanged for all authenticated roles.
-- reservation_extras uses ON DELETE CASCADE so it is cleaned up automatically
-- by Postgres when a reservation row is deleted — no policy change needed there.

-- 1) Reservations: replace DELETE policy to admin-only
DROP POLICY IF EXISTS op_delete_all ON reservations;
CREATE POLICY op_delete_reservations_admin
  ON reservations FOR DELETE
  TO authenticated
  USING (get_current_role() = 'admin');

-- 2) Photos: allow admin to delete photo rows during reservation cleanup
--    (other roles keep their existing INSERT/SELECT/UPDATE; DELETE now admin-only)
DROP POLICY IF EXISTS op_delete_all ON photos;
CREATE POLICY op_delete_photos_admin
  ON photos FOR DELETE
  TO authenticated
  USING (get_current_role() = 'admin');

-- 3) Damages: admin-only DELETE (damages are historical financial records)
DROP POLICY IF EXISTS op_delete_all ON damages;
CREATE POLICY op_delete_damages_admin
  ON damages FOR DELETE
  TO authenticated
  USING (get_current_role() = 'admin');

-- Force PostgREST schema reload so the new policies take effect immediately
NOTIFY pgrst, 'reload_schema';
