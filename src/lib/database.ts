import { supabase } from './supabase';
import type {
  Customer,
  Vehicle,
  Reservation,
  Season,
  Pricing,
  Extra,
  Insurance,
  Station,
  ReservationExtra
} from '../types';

// Demo mode fallback when Supabase is not configured
const isDemo = !supabase;

// Mock data for demo mode
const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Γιάννης Παπαδόπουλος',
    phone: '+30 6912345678',
    email: 'giannis@example.com',
    country: 'Ελλάδα',
    license_number: 'ΑΜ123456',
    birth_date: '1985-03-15',
    source: 'walk-in',
    created_at: '2024-01-15T00:00:00Z'
  }
];

const mockVehicles: Vehicle[] = [
  {
    id: '1',
    plate: 'XAN-1234',
    brand: 'Toyota',
    model: 'Corolla',
    category: 'C',
    year: 2023,
    transmission: 'automatic',
    fuel_type: 'petrol',
    status: 'available',
    insurance_expiry: '2025-06-15',
    inspection_expiry: '2025-03-20',
    last_service: '2024-12-01',
    created_at: '2024-01-01T00:00:00Z'
  }
];

// Customers
export const customerService = {
  async getAll(): Promise<Customer[]> {
    if (isDemo) {
      return Promise.resolve(mockCustomers);
    }

    const { data, error } = await supabase!
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async findByPhoneOrEmail(phone: string, email: string): Promise<Customer | null> {
    if (isDemo) {
      const match = mockCustomers.find(
        c => (phone && c.phone === phone) || (email && c.email === email)
      );
      return Promise.resolve(match || null);
    }

    const filters: string[] = [];
    if (phone) filters.push(`phone.eq.${phone}`);
    if (email) filters.push(`email.eq.${email}`);
    if (filters.length === 0) return null;

    const { data, error } = await supabase!
      .from('customers')
      .select('*')
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    if (isDemo) {
      const newCustomer: Customer = {
        ...customer,
        id: Date.now().toString(),
        created_at: new Date().toISOString()
      };
      mockCustomers.push(newCustomer);
      return Promise.resolve(newCustomer);
    }

    const { data, error } = await supabase!
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    if (isDemo) {
      const index = mockCustomers.findIndex(c => c.id === id);
      if (index >= 0) {
        mockCustomers[index] = { ...mockCustomers[index], ...updates };
        return Promise.resolve(mockCustomers[index]);
      }
      throw new Error('Customer not found');
    }

    const { data, error } = await supabase!
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isDemo) {
      const index = mockCustomers.findIndex(c => c.id === id);
      if (index >= 0) mockCustomers.splice(index, 1);
      return Promise.resolve();
    }

    const { error } = await supabase!
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Vehicles
export const vehicleService = {
  async getAll(): Promise<Vehicle[]> {
    if (isDemo) {
      return Promise.resolve(mockVehicles);
    }

    const { data, error } = await supabase!
      .from('vehicles')
      .select('*')
      .order('plate');

    if (error) throw error;
    return data || [];
  },

  async getAvailable(startDate: string, endDate: string, category?: string): Promise<Vehicle[]> {
    if (isDemo) {
      let filtered = mockVehicles.filter(v => v.status === 'available');
      if (category) filtered = filtered.filter(v => v.category === category);
      return Promise.resolve(filtered);
    }

    let query = supabase!
      .from('vehicles')
      .select('*')
      .eq('status', 'available');

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    if (isDemo) {
      const newVehicle: Vehicle = {
        ...vehicle,
        id: Date.now().toString(),
        created_at: new Date().toISOString()
      };
      mockVehicles.push(newVehicle);
      return Promise.resolve(newVehicle);
    }

    const { data, error } = await supabase!
      .from('vehicles')
      .insert(vehicle)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    if (isDemo) {
      const index = mockVehicles.findIndex(v => v.id === id);
      if (index >= 0) {
        mockVehicles[index] = { ...mockVehicles[index], ...updates };
        return Promise.resolve(mockVehicles[index]);
      }
      throw new Error('Vehicle not found');
    }

    const { data, error } = await supabase!
      .from('vehicles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Reservations
export const reservationService = {
  async getAll(): Promise<Reservation[]> {
    if (isDemo) {
      return Promise.resolve([]);
    }

    const { data, error } = await supabase!
      .from('reservations')
      .select(`
        *,
        customer:customers!reservations_customer_id_fkey(*),
        vehicle:vehicles!reservations_vehicle_id_fkey(*),
        pickup_station:stations!pickup_station_id(name),
        return_station:stations!return_station_id(name)
      `)
      .order('pickup_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      customer: row.customer ?? null,
      vehicle: row.vehicle ?? null,
      pickup_station: row.pickup_station ?? null,
      return_station: row.return_station ?? null,
      total_amount: Number(row.total_amount) || 0,
      daily_rate: Number(row.daily_rate) || 0,
      insurance_rate: Number(row.insurance_rate) || 0,
    }));
  },

  async create(reservation: Omit<Reservation, 'id' | 'created_at'>): Promise<Reservation> {
    if (isDemo) {
      const newReservation: Reservation = {
        ...reservation,
        id: Date.now().toString(),
        created_at: new Date().toISOString()
      };
      return Promise.resolve(newReservation);
    }

    const { data, error } = await supabase!
      .from('reservations')
      .insert(reservation)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Reservation>): Promise<Reservation> {
    if (isDemo) {
      return Promise.resolve({} as Reservation);
    }

    const { data, error } = await supabase!
      .from('reservations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isDemo) {
      return Promise.resolve();
    }

    const { error } = await supabase!
      .from('reservations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Stations
export const stationService = {
  async getAll(): Promise<Station[]> {
    if (isDemo) {
      return Promise.resolve([
        { id: '1', name: 'Πλατανιάς', name_en: 'Platanias', address: 'Πλατανιάς, Χανιά', active: true },
        { id: '2', name: 'Αγία Μαρίνα', name_en: 'Agia Marina', address: 'Αγία Μαρίνα, Χανιά', active: true },
        { id: '3', name: 'Αεροδρόμιο', name_en: 'Airport', address: 'Αεροδρόμιο Χανίων', active: true }
      ]);
    }

    const { data, error } = await supabase!
      .from('stations')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }
};

// Shared season-matching + rate resolution logic
function dateMatchesSeason(month: number, day: number, season: Season): boolean {
  const sm = season.start_month;
  const sd = season.start_day;
  const em = season.end_month;
  const ed = season.end_day;
  if (sm == null || sd == null || em == null || ed == null) return false;

  const startMd = sm * 100 + sd;
  const endMd = em * 100 + ed;
  const checkMd = month * 100 + day;

  if (startMd <= endMd) {
    return checkMd >= startMd && checkMd <= endMd;
  }
  // Season crosses year-end
  return checkMd >= startMd || checkMd <= endMd;
}

export function resolveDailyRate(
  pickupDate: string,
  category: string,
  seasons: Season[],
  pricing: Pricing[]
): { rate: number; season: Season | null } {
  if (!pickupDate || !category) return { rate: 0, season: null };

  const parts = pickupDate.split('T')[0].split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!month || !day) return { rate: 0, season: null };

  const matching = seasons.filter(s => dateMatchesSeason(month, day, s));
  if (matching.length === 0) return { rate: 0, season: null };

  const bestSeason = matching.reduce((best, s) =>
    (s.priority ?? 0) > (best.priority ?? 0) ? s : best
  );

  const row = pricing.find(
    p => p.category === category && p.season_id === bestSeason.id
  );

  if (!row) return { rate: 0, season: bestSeason };

  return { rate: Number(row.daily_rate), season: bestSeason };
}

// Seasons & Pricing
export const pricingService = {
  async getSeasons(): Promise<Season[]> {
    if (isDemo) {
      return Promise.resolve([
        { id: '1', name: 'Low Season', start_date: '2024-11-01', end_date: '2025-03-31', multiplier: 1.0 },
        { id: '2', name: 'High Season', start_date: '2025-06-01', end_date: '2025-09-30', multiplier: 1.8 }
      ]);
    }

    const { data, error } = await supabase!
      .from('seasons')
      .select('*')
      .eq('active', true)
      .order('start_date');

    if (error) throw error;
    return data || [];
  },

  async getPricing(): Promise<Pricing[]> {
    if (isDemo) {
      return Promise.resolve([
        { id: '1', category: 'A', daily_rate: 25, season_id: '1' },
        { id: '2', category: 'B', daily_rate: 35, season_id: '1' },
        { id: '3', category: 'C', daily_rate: 45, season_id: '1' }
      ]);
    }

    const { data, error } = await supabase!
      .from('pricing')
      .select('*, season:seasons(*)');

    if (error) throw error;
    return data || [];
  },

  async upsertRate(category: string, seasonId: string, dailyRate: number): Promise<Pricing> {
    if (isDemo) {
      return Promise.resolve({ id: Date.now().toString(), category, daily_rate: dailyRate, season_id: seasonId });
    }

    const { data: existing } = await supabase!
      .from('pricing')
      .select('id')
      .eq('category', category)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase!
        .from('pricing')
        .update({ daily_rate: dailyRate })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase!
      .from('pricing')
      .insert({ category, season_id: seasonId, daily_rate: dailyRate })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getExtras(): Promise<Extra[]> {
    if (isDemo) {
      return Promise.resolve([
        { id: '1', name: 'Παιδικό Κάθισμα', name_en: 'Child Seat', type: 'daily', price: 5 },
        { id: '2', name: 'Δεύτερος Οδηγός', name_en: 'Additional Driver', type: 'one-time', price: 25 }
      ]);
    }

    const { data, error } = await supabase!
      .from('extras')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }
};

// Insurance types
export const insuranceService = {
  async getAll(): Promise<Insurance[]> {
    if (isDemo) {
      return Promise.resolve([
        { id: '1', name: 'Βασική Ασφάλεια', name_en: 'Basic Insurance', daily_rate: 0, category: 'all' },
        { id: '2', name: 'Πλήρης Ασφάλεια', name_en: 'Full Insurance', daily_rate: 15, category: 'all' }
      ]);
    }

    const { data, error } = await supabase!
      .from('insurance_types')
      .select('*')
      .eq('active', true)
      .order('daily_rate');

    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      daily_rate: Number(row.daily_rate) || 0
    }));
  }
};

// Reservation extras
export const reservationExtrasService = {
  async createMany(reservationId: string, extras: Array<{ extra_id: string; quantity: number; daily_rate: number }>): Promise<void> {
    if (isDemo) return Promise.resolve();
    if (extras.length === 0) return;

    const rows = extras.map(e => ({
      reservation_id: reservationId,
      extra_id: e.extra_id,
      quantity: e.quantity,
      daily_rate: e.daily_rate
    }));

    const { error } = await supabase!
      .from('reservation_extras')
      .insert(rows);

    if (error) throw error;
  },

  async getByReservationId(reservationId: string): Promise<ReservationExtra[]> {
    if (isDemo) return Promise.resolve([]);

    const { data, error } = await supabase!
      .from('reservation_extras')
      .select('*')
      .eq('reservation_id', reservationId);

    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      daily_rate: Number(row.daily_rate) || 0
    }));
  }
};

// Photo upload
export const photoService = {
  async upload(file: File, type: 'checkout' | 'checkin' | 'damage' | 'vehicle', referenceId: string): Promise<string> {
    if (isDemo) {
      return Promise.resolve(`https://placehold.co/400x300?text=${type}`);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${type}/${referenceId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase!.storage
      .from('photos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase!.storage
      .from('photos')
      .getPublicUrl(fileName);

    await supabase!
      .from('photos')
      .insert({ url: publicUrl, type, reference_id: referenceId });

    return publicUrl;
  },

  async getPhotos(type: string, referenceId: string): Promise<string[]> {
    if (isDemo) {
      return Promise.resolve([]);
    }

    const { data, error } = await supabase!
      .from('photos')
      .select('url')
      .eq('type', type)
      .eq('reference_id', referenceId);

    if (error) throw error;
    return data?.map(p => p.url) || [];
  }
};

// Checkouts
export const checkoutService = {
  async create(data: {
    reservation_id: string;
    fuel_level: number;
    odometer: number;
    accessories_given: string[];
    damages: Array<{ description: string }>;
    checked_out_by?: string;
  }): Promise<void> {
    if (isDemo) return Promise.resolve();

    // 1. Αποθήκευση ζημιών στον πίνακα damages
    const damageIds: string[] = [];
    for (const damage of data.damages) {
      const { data: dmg, error: dmgErr } = await supabase!
        .from('damages')
        .insert({ description: damage.description })
        .select('id')
        .single();
      if (dmgErr) throw dmgErr;
      damageIds.push(dmg.id);
    }

    // 2. Αποθήκευση checkout
    const { error } = await supabase!
      .from('checkouts')
      .insert({
        reservation_id: data.reservation_id,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        accessories_given: data.accessories_given,
        damage_ids: damageIds,
        checked_out_by: data.checked_out_by || null,
        checked_out_at: new Date().toISOString(),
      });

    if (error) throw error;
  }
};

// Checkins
export const checkinService = {
  async create(data: {
    reservation_id: string;
    fuel_level: number;
    odometer: number;
    new_damages: Array<{ description: string; estimated_cost?: number }>;
    additional_charges: Array<{ type: string; amount: number; description: string }>;
    checked_in_by?: string;
  }): Promise<void> {
    if (isDemo) return Promise.resolve();

    // 1. Αποθήκευση νέων ζημιών
    const damageIds: string[] = [];
    for (const damage of data.new_damages) {
      const { data: dmg, error: dmgErr } = await supabase!
        .from('damages')
        .insert({
          description: damage.description,
          estimated_cost: damage.estimated_cost || null,
        })
        .select('id')
        .single();
      if (dmgErr) throw dmgErr;
      damageIds.push(dmg.id);
    }

    // 2. Αποθήκευση checkin
    const { error } = await supabase!
      .from('checkins')
      .insert({
        reservation_id: data.reservation_id,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        new_damage_ids: damageIds,
        additional_charges: data.additional_charges,
        checked_in_by: data.checked_in_by || null,
        checked_in_at: new Date().toISOString(),
      });

    if (error) throw error;
  }
};

// Dashboard stats
export const dashboardService = {
  async getTodayStats() {
    if (isDemo) {
      return Promise.resolve({ reservations: 12, revenue: 1850, pickups: 8, returns: 6 });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: reservations } = await supabase!
      .from('reservations')
      .select('total_amount, status')
      .gte('pickup_date', `${today}T00:00:00`)
      .lt('pickup_date', `${today}T23:59:59`);

    const { data: checkouts } = await supabase!
      .from('checkouts')
      .select('id')
      .gte('checked_out_at', `${today}T00:00:00`)
      .lt('checked_out_at', `${today}T23:59:59`);

    const { data: checkins } = await supabase!
      .from('checkins')
      .select('id')
      .gte('checked_in_at', `${today}T00:00:00`)
      .lt('checked_in_at', `${today}T23:59:59`);

    return {
      reservations: reservations?.length || 0,
      revenue: reservations?.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0) || 0,
      pickups: checkouts?.length || 0,
      returns: checkins?.length || 0
    };
  },

  async getFleetOccupancy(_days: number = 7) {
    return [];
  }
};
