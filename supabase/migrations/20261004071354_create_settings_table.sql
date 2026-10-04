CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('company', '{
    "name": "Demo Rent a Car",
    "phone": "+30 28210 00000",
    "email": "info@demo-rentacar.gr",
    "address": "Χανιά, Κρήτη",
    "website": "www.demo-rentacar.gr",
    "taxNumber": "000000000",
    "registrationNumber": "ΑΕ 00000",
    "contractHeader": "DEMO RENT A CAR",
    "contractSubheader": "Chania, Crete"
  }'::jsonb),
  ('financial', '{
    "currency": "EUR",
    "vat_rate": 24,
    "late_return_fee": 10,
    "cleaning_fee": 25,
    "fuel_charge_per_liter": 1.5
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;