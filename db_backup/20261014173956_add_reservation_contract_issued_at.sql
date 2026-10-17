-- Rentovio schema reconstruction: migration recorded in live Supabase,
-- but missing from the connected GitHub repository as of 2026-10-17.
-- Live schema verified: public.reservations.contract_issued_at
-- is timestamp with time zone, nullable YES, default NULL.
-- ARCHIVE / RESTORE REFERENCE ONLY. DO NOT EXECUTE ON THE LIVE DATABASE.
-- Intended only for a clean rebuild at the correct migration step.

ALTER TABLE public.reservations
  ADD COLUMN contract_issued_at timestamp with time zone;
