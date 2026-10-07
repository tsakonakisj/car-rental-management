/*
# Create function to find photos eligible for cleanup

1. Purpose
- Returns photos whose associated reservation's latest Check-In is older than 7 days.
- Only returns photos with type = 'checkout' or 'checkin'.
- Never returns 'damage' or 'vehicle' photos.

2. Function: get_photos_for_cleanup()
- SECURITY DEFINER so the Edge Function can call it via RPC with service role.
- Joins photos to a subquery that computes MAX(checkins.checked_in_at) per reservation.
- Filters: latest_checkin < now() - interval '7 days'
- Returns: id, url (storage path), type, reservation_id

3. Notes
- No changes to existing tables, RLS, or Auth.
- Function is read-only (SELECT only).
- Safe to call repeatedly.
*/

CREATE OR REPLACE FUNCTION public.get_photos_for_cleanup()
RETURNS TABLE (
  id uuid,
  url text,
  type text,
  reservation_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.url, p.type, p.reference_id AS reservation_id
  FROM photos p
  JOIN (
    SELECT reservation_id, MAX(checked_in_at) AS latest_checkin
    FROM checkins
    GROUP BY reservation_id
  ) latest ON latest.reservation_id = p.reference_id
  WHERE p.type IN ('checkout', 'checkin')
    AND latest.latest_checkin < now() - interval '7 days';
$$;