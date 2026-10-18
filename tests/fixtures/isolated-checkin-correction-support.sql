-- Synthetic CI schema additions only; no live project connection.
ALTER TABLE public.users ADD COLUMN name text DEFAULT 'Test Admin';
ALTER TABLE public.vehicles ADD COLUMN fuel_tank_capacity numeric DEFAULT 50;
ALTER TABLE public.vehicles ADD COLUMN current_station_id uuid;
ALTER TABLE public.reservations ADD COLUMN return_station_id uuid;
