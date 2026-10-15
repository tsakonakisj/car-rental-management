-- Record successful booking confirmation PDF issuance; existing reservations stay unmarked.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS booking_confirmation_issued_at timestamptz;
