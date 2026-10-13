-- Restrict reservation DELETE to admin AND only for upcoming/cancelled statuses.
-- This is the server-side enforcement layer: even a direct API call by an admin
-- cannot delete an active or completed reservation.

DROP POLICY IF EXISTS op_delete_reservations_admin ON reservations;
CREATE POLICY op_delete_reservations_admin
  ON reservations FOR DELETE
  TO authenticated
  USING (
    get_current_role() = 'admin'
    AND status IN ('upcoming', 'cancelled')
  );

NOTIFY pgrst, 'reload_schema';
