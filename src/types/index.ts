export interface User {
  id: string;
  email: string;
  role: 'agent' | 'manager' | 'admin';
  name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  license_number: string;
  birth_date: string;
  notes?: string;
  source: 'store' | 'phone' | 'instagram' | 'whatsapp' | 'website' | 'repeat' | 'other' | 'walk-in';
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  category: 'A' | 'B' | 'C' | 'SUV' | '7-seater';
  year: number;
  transmission: 'manual' | 'automatic';
  fuel_type: 'petrol' | 'diesel';
  status: 'available' | 'reserved' | 'rented' | 'service' | 'inactive';
  insurance_expiry?: string;
  inspection_expiry?: string;
  last_service?: string;
  created_at: string;
}

export interface Station {
  id: string;
  name: string;
  name_en: string;
  address: string;
  active: boolean;
}

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multiplier: number;
  start_month?: number | null;
  start_day?: number | null;
  end_month?: number | null;
  end_day?: number | null;
  priority?: number | null;
}

export interface Pricing {
  id: string;
  category: string;
  daily_rate: number;
  season_id: string;
}

export interface Extra {
  id: string;
  name: string;
  name_en: string;
  type: 'daily' | 'one-time';
  price: number;
}

export interface Insurance {
  id: string;
  name: string;
  name_en: string;
  daily_rate: number;
  category: string;
}

export interface Reservation {
  id: string;
  customer_id: string;
  vehicle_id?: string;
  category: string;
  pickup_date: string;
  return_date: string;
  pickup_station_id: string;
  return_station_id: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  daily_rate: number;
  insurance_type: string;
  insurance_rate: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface ReservationExtra {
  id: string;
  extra_id: string;
  quantity: number;
  daily_rate: number;
}

export interface CheckOut {
  id: string;
  reservation_id: string;
  fuel_level: number;
  odometer: number;
  photos: string[];
  damages: Damage[];
  accessories_given: string[];
  checked_out_by: string;
  checked_out_at: string;
}

export interface CheckIn {
  id: string;
  reservation_id: string;
  fuel_level: number;
  odometer: number;
  photos: string[];
  new_damages: Damage[];
  additional_charges: AdditionalCharge[];
  checked_in_by: string;
  checked_in_at: string;
}

export interface Damage {
  id: string;
  description: string;
  photo?: string;
  estimated_cost?: number;
}

export interface AdditionalCharge {
  id: string;
  type: string;
  amount: number;
  description: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  notes?: string;
  created_at: string;
  created_by: string;
}