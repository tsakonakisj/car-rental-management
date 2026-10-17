-- Rentovio schema reconstruction: migration recorded in live Supabase,
-- but missing from the connected GitHub repository as of 2026-10-17.
-- Live schema verified: public.checkouts has constraint
-- checkouts_reservation_id_unique UNIQUE (reservation_id).
-- ARCHIVE / RESTORE REFERENCE ONLY. DO NOT EXECUTE ON THE LIVE DATABASE.
-- Intended only for a clean rebuild at the correct migration step.

ALTER TABLE public.checkouts
  ADD CONSTRAINT checkouts_reservation_id_unique UNIQUE (reservation_id);
