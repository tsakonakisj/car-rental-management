/*
# Add SELECT-only agent access to pricing and seasons

1. Purpose
- Agents need to read pricing and seasons to calculate daily rates in BookingStep2.
- Currently SELECT on both tables is restricted to admin/manager only, which blocks
  agents from completing bookings (all rates show as 0, vehicle selection fails).
- This adds a SELECT-only policy for the agent role. No INSERT/UPDATE/DELETE.

2. Security
- New policies are SELECT-only — agent can read rates but cannot modify them.
- Existing INSERT/UPDATE/DELETE policies on pricing and seasons remain admin/manager only.
- The Pricing management UI remains hidden from agents (Sidebar ROLE_TAB_ACCESS).
- extras and insurance_types already have agent SELECT access — no changes needed there.
*/

DROP POLICY IF EXISTS "pricing_select_agent" ON pricing;
CREATE POLICY "pricing_select_agent"
ON pricing FOR SELECT
TO authenticated
USING (get_current_role() = 'agent');

DROP POLICY IF EXISTS "seasons_select_agent" ON seasons;
CREATE POLICY "seasons_select_agent"
ON seasons FOR SELECT
TO authenticated
USING (get_current_role() = 'agent');