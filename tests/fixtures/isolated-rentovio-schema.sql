
-- Test-only synthetic schema, NO production database connection or real user data.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT '11111111-1111-4111-8111-111111111111'::uuid $$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  auth_user_id uuid,
  role text,
  active boolean NOT NULL DEFAULT true
);
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$ SELECT role FROM public.users WHERE auth_user_id=auth.uid() AND active=true LIMIT 1 $$;

CREATE TABLE public.vehicles (
 id uuid PRIMARY KEY, status text NOT NULL, insurance_expiry date,
 inspection_expiry date, odometer integer, updated_at timestamptz
);
CREATE TABLE public.reservations (
 id uuid PRIMARY KEY, vehicle_id uuid REFERENCES public.vehicles(id),
 status text NOT NULL, pickup_date timestamp NOT NULL,
 return_date timestamp NOT NULL, updated_at timestamptz
);
CREATE TABLE public.damages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), description text NOT NULL,
 estimated_cost numeric
);
CREATE TABLE public.checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL REFERENCES public.reservations(id),
 fuel_level integer NOT NULL, odometer integer NOT NULL, accessories_given text[],
 damage_ids uuid[], checked_out_by uuid REFERENCES public.users(id),
 checked_out_at timestamptz,
 CONSTRAINT checkouts_reservation_id_unique UNIQUE(reservation_id)
);
CREATE TABLE public.checkins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL REFERENCES public.reservations(id),
 fuel_level integer NOT NULL, odometer integer NOT NULL, new_damage_ids uuid[],
 additional_charges jsonb, checked_in_by uuid REFERENCES public.users(id),
 checked_in_at timestamptz
);
INSERT INTO public.users (id,auth_user_id,role,active) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','agent',true);
INSERT INTO public.vehicles(id,status,insurance_expiry,inspection_expiry,odometer) VALUES
('33333333-3333-4333-8333-333333333333','available',CURRENT_DATE+30,CURRENT_DATE+30,10000),
('44444444-4444-4444-8444-444444444444','available',CURRENT_DATE-1,CURRENT_DATE+30,10000),
('55555555-5555-4555-8555-555555555555','available',CURRENT_DATE+30,CURRENT_DATE+30,10000);
INSERT INTO public.reservations(id,vehicle_id,status,pickup_date,return_date) VALUES
('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','upcoming',CURRENT_DATE,CURRENT_DATE+4),
('77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444','upcoming',CURRENT_DATE,CURRENT_DATE+4),
('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555','upcoming',CURRENT_DATE,CURRENT_DATE+4);
