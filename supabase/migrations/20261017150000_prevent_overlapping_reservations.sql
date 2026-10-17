-- Prevent two upcoming/active reservations assigning the same physical car
-- during overlapping time intervals. Adjacent windows [start,end) are allowed.
-- Cancelled and completed reservations remain historical and do not block reuse.
-- Database constraint handles concurrent client requests atomically.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- btree_gist UUID GiST operator class lives in the Supabase extensions schema.
SET search_path TO public, extensions;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_valid_rental_window
  CHECK (return_date > pickup_date);

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_vehicle_time_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tsrange(pickup_date, return_date, '[)') WITH &&
  )
  WHERE (vehicle_id IS NOT NULL AND status IN ('upcoming', 'active'));

RESET search_path;
