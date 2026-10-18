ALTER TABLE public.reservations ADD COLUMN total_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN voided_at timestamptz;
