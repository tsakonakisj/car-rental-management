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
  ReservationExtra,
  Payment
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

  async getReservationCount(id: string): Promise<number> {
    if (isDemo) return 0;

    const { count, error } = await supabase!
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id);

    if (error) throw error;
    return count || 0;
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

/**
 * Check if a vehicle has overlapping upcoming/active reservations.
 * Uses full timestamp comparison (date + time) to catch same-day conflicts.
 * Consecutive bookings (return time == next pickup time) are allowed.
 *
 * @param vehicleId - The vehicle to check
 * @param startISO  - Full ISO start timestamp (e.g. "2026-10-12T09:00:00")
 * @param endISO    - Full ISO end timestamp
 * @param reservations - All reservations to check against
 * @param excludeReservationId - Reservation ID to skip (for edits)
 * @returns true if an overlap exists
 */
export function hasVehicleBookingConflict(
  vehicleId: string,
  startISO: string,
  endISO: string,
  reservations: Reservation[],
  excludeReservationId?: string
): boolean {
  if (!vehicleId || !startISO || !endISO) return false;
  const newStart = new Date(startISO).getTime();
  const newEnd = new Date(endISO).getTime();
  if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) return false;

  return reservations.some(r => {
    if (r.vehicle_id !== vehicleId) return false;
    if (r.status !== 'upcoming' && r.status !== 'active') return false;
    if (excludeReservationId && r.id === excludeReservationId) return false;
    const rStart = new Date(r.pickup_date).getTime();
    const rEnd = new Date(r.return_date).getTime();
    if (isNaN(rStart) || isNaN(rEnd)) return false;
    return newStart < rEnd && newEnd > rStart;
  });
}

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

    // 0. Status guard: only upcoming or cancelled reservations can be deleted
    const { data: reservationRow, error: fetchError } = await supabase!
      .from('reservations')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!reservationRow) throw new Error('DELETION_BLOCKED:not_found');
    if (reservationRow.status === 'active' || reservationRow.status === 'completed') {
      throw new Error('DELETION_BLOCKED:status');
    }

    // 1. Pre-check: block deletion if historical/financial records exist
    const { data: checkoutRows } = await supabase!
      .from('checkouts')
      .select('id')
      .eq('reservation_id', id);
    if (checkoutRows && checkoutRows.length > 0) {
      throw new Error('DELETION_BLOCKED:checkouts');
    }

    const { data: checkinRows } = await supabase!
      .from('checkins')
      .select('id')
      .eq('reservation_id', id);
    if (checkinRows && checkinRows.length > 0) {
      throw new Error('DELETION_BLOCKED:checkins');
    }

    const { data: paymentRows } = await supabase!
      .from('payments')
      .select('id')
      .eq('reservation_id', id);
    if (paymentRows && paymentRows.length > 0) {
      throw new Error('DELETION_BLOCKED:payments');
    }

    // 2. Clean up photos from storage + photos table
    const { data: photoRows } = await supabase!
      .from('photos')
      .select('url')
      .eq('reference_id', id);

    if (photoRows && photoRows.length > 0) {
      const photoPaths = photoRows.map(p => p.url);
      const { error: storageError } = await supabase!
        .storage
        .from('rental-photos')
        .remove(photoPaths);

      if (storageError) throw storageError;

      const { error: photoDbError } = await supabase!
        .from('photos')
        .delete()
        .eq('reference_id', id);

      if (photoDbError) throw photoDbError;
    }

    // 3. Delete the reservation row
    //    reservation_extras cascade automatically via FK ON DELETE CASCADE
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
function matchSinglePeriod(month: number, day: number, sm: number | null | undefined, sd: number | null | undefined, em: number | null | undefined, ed: number | null | undefined): boolean {
  if (sm == null || sd == null || em == null || ed == null) return false;

  const startMd = sm * 100 + sd;
  const endMd = em * 100 + ed;
  const checkMd = month * 100 + day;

  if (startMd <= endMd) {
    return checkMd >= startMd && checkMd <= endMd;
  }
  return checkMd >= startMd || checkMd <= endMd;
}

function dateMatchesSeason(month: number, day: number, season: Season): boolean {
  if (matchSinglePeriod(month, day, season.start_month, season.start_day, season.end_month, season.end_day)) return true;
  if (matchSinglePeriod(month, day, season.start_month_2, season.start_day_2, season.end_month_2, season.end_day_2)) return true;
  if (matchSinglePeriod(month, day, season.start_month_3, season.start_day_3, season.end_month_3, season.end_day_3)) return true;
  return false;
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
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createSeason(season: {
    name: string;
    start_date: string;
    end_date: string;
    multiplier?: number;
    priority?: number;
    start_month: number;
    start_day: number;
    end_month: number;
    end_day: number;
    start_month_2?: number | null;
    start_day_2?: number | null;
    end_month_2?: number | null;
    end_day_2?: number | null;
    start_month_3?: number | null;
    start_day_3?: number | null;
    end_month_3?: number | null;
    end_day_3?: number | null;
  }): Promise<Season> {
    if (isDemo) {
      return Promise.resolve({
        id: Date.now().toString(),
        name: season.name,
        start_date: season.start_date,
        end_date: season.end_date,
        multiplier: season.multiplier ?? 1.0,
        priority: season.priority ?? 0,
        start_month: season.start_month,
        start_day: season.start_day,
        end_month: season.end_month,
        end_day: season.end_day,
      });
    }

    const { data, error } = await supabase!
      .from('seasons')
      .insert({
        name: season.name,
        start_date: season.start_date,
        end_date: season.end_date,
        multiplier: season.multiplier ?? 1.0,
        priority: season.priority ?? 0,
        active: true,
        start_month: season.start_month,
        start_day: season.start_day,
        end_month: season.end_month,
        end_day: season.end_day,
        ...(season.start_month_2 != null && { start_month_2: season.start_month_2 }),
        ...(season.start_day_2 != null && { start_day_2: season.start_day_2 }),
        ...(season.end_month_2 != null && { end_month_2: season.end_month_2 }),
        ...(season.end_day_2 != null && { end_day_2: season.end_day_2 }),
        ...(season.start_month_3 != null && { start_month_3: season.start_month_3 }),
        ...(season.start_day_3 != null && { start_day_3: season.start_day_3 }),
        ...(season.end_month_3 != null && { end_month_3: season.end_month_3 }),
        ...(season.end_day_3 != null && { end_day_3: season.end_day_3 }),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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

    const { data, error } = await supabase!
      .from('pricing')
      .upsert({ category, season_id: seasonId, daily_rate: dailyRate }, { onConflict: 'category,season_id' })
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
  },

  async updateExtra(id: string, updates: Partial<Pick<Extra, 'name' | 'name_en' | 'type' | 'price'>>): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { error } = await supabase!
      .from('extras')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.name_en !== undefined && { name_en: updates.name_en }),
        ...(updates.type !== undefined && { type: updates.type }),
        ...(updates.price !== undefined && { price: updates.price }),
      })
      .eq('id', id);

    if (error) throw error;
  },

  async deactivateExtra(id: string): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { data, error } = await supabase!
      .from('extras')
      .update({ active: false })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Δεν επιτρέπεται η διαγραφή έξτρα. Ελέγξτε τα δικαιώματα χρήστη.');
    }
  },

  async createExtra(data: { name: string; name_en: string; type: 'daily' | 'one-time'; price: number }): Promise<Extra> {
    if (isDemo) {
      return Promise.resolve({ id: Date.now().toString(), ...data });
    }

    const { data: row, error } = await supabase!
      .from('extras')
      .insert({ name: data.name, name_en: data.name_en, type: data.type, price: data.price, active: true })
      .select()
      .single();

    if (error) throw error;
    return row;
  },

  async updateSeason(id: string, updates: Partial<Pick<Season, 'name' | 'start_date' | 'end_date' | 'multiplier' | 'start_month' | 'start_day' | 'end_month' | 'end_day' | 'priority' | 'start_month_2' | 'start_day_2' | 'end_month_2' | 'end_day_2' | 'start_month_3' | 'start_day_3' | 'end_month_3' | 'end_day_3'>>): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { data, error } = await supabase!
      .from('seasons')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.start_date !== undefined && { start_date: updates.start_date }),
        ...(updates.end_date !== undefined && { end_date: updates.end_date }),
        ...(updates.multiplier !== undefined && { multiplier: updates.multiplier }),
        ...(updates.start_month !== undefined && { start_month: updates.start_month }),
        ...(updates.start_day !== undefined && { start_day: updates.start_day }),
        ...(updates.end_month !== undefined && { end_month: updates.end_month }),
        ...(updates.end_day !== undefined && { end_day: updates.end_day }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.start_month_2 !== undefined && { start_month_2: updates.start_month_2 }),
        ...(updates.start_day_2 !== undefined && { start_day_2: updates.start_day_2 }),
        ...(updates.end_month_2 !== undefined && { end_month_2: updates.end_month_2 }),
        ...(updates.end_day_2 !== undefined && { end_day_2: updates.end_day_2 }),
        ...(updates.start_month_3 !== undefined && { start_month_3: updates.start_month_3 }),
        ...(updates.start_day_3 !== undefined && { start_day_3: updates.start_day_3 }),
        ...(updates.end_month_3 !== undefined && { end_month_3: updates.end_month_3 }),
        ...(updates.end_day_3 !== undefined && { end_day_3: updates.end_day_3 }),
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Δεν επιτρέπεται η επεξεργασία σεζόν. Ελέγξτε τα δικαιώματα χρήστη.');
    }
  },

  async deactivateSeason(id: string): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { data, error } = await supabase!
      .from('seasons')
      .update({ active: false })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Δεν επιτρέπεται η διαγραφή σεζόν. Ελέγξτε τα δικαιώματα χρήστη.');
    }
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
  },

  async updateInsurance(id: string, updates: Partial<Pick<Insurance, 'name' | 'name_en' | 'daily_rate'>>): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { error } = await supabase!
      .from('insurance_types')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.name_en !== undefined && { name_en: updates.name_en }),
        ...(updates.daily_rate !== undefined && { daily_rate: updates.daily_rate }),
      })
      .eq('id', id);

    if (error) throw error;
  },

  async deactivateInsurance(id: string): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { data, error } = await supabase!
      .from('insurance_types')
      .update({ active: false })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Δεν επιτρέπεται η διαγραφή ασφάλειας. Ελέγξτε τα δικαιώματα χρήστη.');
    }
  },

  async createInsurance(data: { name: string; name_en: string; daily_rate: number }): Promise<Insurance> {
    if (isDemo) {
      return Promise.resolve({ id: Date.now().toString(), category: 'all', ...data });
    }

    const { data: row, error } = await supabase!
      .from('insurance_types')
      .insert({ name: data.name, name_en: data.name_en, daily_rate: data.daily_rate, category: 'all', active: true })
      .select()
      .single();

    if (error) throw error;
    return { ...row, daily_rate: Number(row.daily_rate) || 0 };
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
  },

  async getDetailedByReservationId(reservationId: string): Promise<Array<{ extra_id: string; name: string; quantity: number; daily_rate: number; type: string }>> {
    if (isDemo) return Promise.resolve([]);

    const { data, error } = await supabase!
      .from('reservation_extras')
      .select('extra_id, quantity, daily_rate, extras!inner(name, type)')
      .eq('reservation_id', reservationId);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      extra_id: row.extra_id,
      name: row.extras?.name || 'Unknown',
      quantity: row.quantity,
      daily_rate: Number(row.daily_rate) || 0,
      type: row.extras?.type || 'daily'
    }));
  },

  async deleteByReservationId(reservationId: string): Promise<void> {
    if (isDemo) return Promise.resolve();

    const { error } = await supabase!
      .from('reservation_extras')
      .delete()
      .eq('reservation_id', reservationId);

    if (error) throw error;
  },

  async replaceForReservation(reservationId: string, extras: Array<{ extra_id: string; quantity: number; daily_rate: number }>): Promise<void> {
    await this.deleteByReservationId(reservationId);
    if (extras.length > 0) {
      await this.createMany(reservationId, extras);
    }
  }
};

// Refunds are separate, immutable financial records; they never erase receipts.
export interface PaymentRefund {
  id: string;
  payment_id: string;
  reservation_id: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  reason: string;
  created_at: string;
  created_by: string;
}

export const paymentRefundService = {
  async getByReservationId(reservationId: string): Promise<PaymentRefund[]> {
    if (isDemo) return [];
    const { data, error } = await supabase!
      .from('payment_refunds')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({ ...row, amount: Number(row.amount) || 0 }));
  },
  async create(input: { payment_id: string; amount: number; method: string; reason: string }): Promise<void> {
    if (isDemo) return;
    const { error } = await supabase!.rpc('record_payment_refund', {
      p_payment_id: input.payment_id,
      p_amount: input.amount,
      p_method: input.method,
      p_reason: input.reason.trim(),
    });
    if (error) throw error;
  },
};

// Payments
export const paymentService = {
  async getByReservationId(reservationId: string): Promise<Payment[]> {
    if (isDemo) return Promise.resolve([]);

    const { data, error } = await supabase!
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      amount: Number(row.amount) || 0,
    }));
  },

  async create(payment: { reservation_id: string; amount: number; method: string; notes?: string }): Promise<Payment> {
    if (isDemo) {
      return Promise.resolve({
        id: Date.now().toString(),
        reservation_id: payment.reservation_id,
        amount: payment.amount,
        method: payment.method as Payment['method'],
        notes: payment.notes || null,
        created_at: new Date().toISOString(),
        created_by: '',
      });
    }

    const { data, error } = await supabase!
      .from('payments')
      .insert({
        reservation_id: payment.reservation_id,
        amount: payment.amount,
        method: payment.method,
        notes: payment.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      amount: Number(data.amount) || 0,
    };
  },

  async void(id: string, reason: string): Promise<void> {
    if (isDemo) return Promise.resolve();
    const { error } = await supabase!.rpc('void_reservation_payment', {
      p_payment_id: id,
      p_reason: reason.trim(),
    });
    if (error) throw error;
  }
};

// Photo upload
export const photoService = {
  async upload(
    blob: Blob,
    type: 'checkout' | 'checkin' | 'damage' | 'vehicle',
    referenceId: string
  ): Promise<string> {
    if (isDemo) {
      return Promise.resolve(`https://placehold.co/400x300?text=${type}`);
    }

    const filePath = `reservations/${referenceId}/${type}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase!.storage
      .from('rental-photos')
      .upload(filePath, blob, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase!
      .from('photos')
      .insert({ url: filePath, type, reference_id: referenceId });

    if (dbError) {
      await supabase!.storage
        .from('rental-photos')
        .remove([filePath]);
      throw dbError;
    }

    return filePath;
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
  },

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    if (isDemo) {
      return Promise.resolve(path);
    }

    const { data, error } = await supabase!.storage
      .from('rental-photos')
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data?.signedUrl || '';
  },

  async getSignedUrls(paths: string[], expiresIn: number = 3600): Promise<Map<string, string>> {
    if (isDemo || paths.length === 0) {
      return Promise.resolve(new Map());
    }

    const { data, error } = await supabase!.storage
      .from('rental-photos')
      .createSignedUrls(paths, expiresIn);

    if (error) throw error;

    const map = new Map<string, string>();
    for (const item of data || []) {
      if (item.signedUrl) {
        map.set(item.path, item.signedUrl);
      }
    }
    return map;
  },

  async deletePhoto(path: string): Promise<void> {
    if (isDemo) return Promise.resolve();

    await supabase!.storage
      .from('rental-photos')
      .remove([path]);

    await supabase!
      .from('photos')
      .delete()
      .eq('url', path);
  }
};

// Checkouts
export interface CheckoutDetails {
  fuel_level: number;
  odometer: number;
  accessories_given: string[];
  damages: Array<{ id: string; description: string; estimated_cost: number | null }>;
  checked_out_at: string;
}

export const checkoutService = {
  async complete(data: {
    reservation_id: string;
    fuel_level: number;
    odometer: number;
    accessories_given: string[];
    damages: Array<{ description: string }>;
  }): Promise<void> {
    if (isDemo) return Promise.resolve();
    const { error } = await supabase!.rpc('complete_vehicle_checkout', {
      p_reservation_id: data.reservation_id,
      p_fuel_level: data.fuel_level,
      p_odometer: data.odometer,
      p_accessories: data.accessories_given,
      p_damages: data.damages.map(d => ({ description: d.description })),
    });
    if (error) throw error;
  },
  async getByReservationId(reservationId: string): Promise<CheckoutDetails | null> {
    if (isDemo) return Promise.resolve(null);

    const { data, error } = await supabase!
      .from('checkouts')
      .select('fuel_level, odometer, accessories_given, damage_ids, checked_out_at')
      .eq('reservation_id', reservationId)
      .order('checked_out_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    let damages: CheckoutDetails['damages'] = [];
    const damageIds: string[] = data.damage_ids || [];
    if (damageIds.length > 0) {
      const { data: dmgData, error: dmgErr } = await supabase!
        .from('damages')
        .select('id, description, estimated_cost')
        .in('id', damageIds);
      if (dmgErr) throw dmgErr;
      damages = (dmgData || []).map((d: any) => ({
        id: d.id,
        description: d.description,
        estimated_cost: d.estimated_cost != null ? Number(d.estimated_cost) : null,
      }));
    }

    return {
      fuel_level: data.fuel_level,
      odometer: data.odometer,
      accessories_given: data.accessories_given || [],
      damages,
      checked_out_at: data.checked_out_at,
    };
  },


};

export interface CheckinDetails {
  fuel_level: number;
  odometer: number;
  unpaid_reason?: string | null;
  unpaid_amount?: number | null;
  additional_charges: Array<{ type: string; amount: number; description: string }>;
  new_damages: Array<{ id: string; description: string; estimated_cost: number | null }>;
  checked_in_at: string;
}

export interface FuelWaiverRequest {
  id: string;
  reservation_id: string;
  requested_at: string;
  reason: string;
  fuel_liters: number;
  proposed_charge: number;
  status: 'pending' | 'approved' | 'rejected';
}
export const fuelWaiverService = {
  async listPending(): Promise<FuelWaiverRequest[]> {
    if (isDemo) return [];
    const { data, error } = await supabase!.from('fuel_waiver_requests')
      .select('id,reservation_id,requested_at,reason,fuel_liters,proposed_charge,status')
      .is('voided_at', null)
      .eq('status','pending').order('requested_at',{ascending:true});
    if (error) throw error;
    return (data || []).map(x => ({...x,fuel_liters:Number(x.fuel_liters),proposed_charge:Number(x.proposed_charge)}));
  },
  async review(id: string, approve: boolean, note: string): Promise<void> {
    if (isDemo) return;
    const { error } = await supabase!.rpc('review_fuel_waiver',{
      p_request_id:id,p_approve:approve,p_admin_note:note.trim()
    });
    if (error) throw error;
  }
};

// Checkins
export interface ReturnContext {
  checkin: { id: string; fuel_level: number; odometer: number; correction_revision: number;
    additional_charges: Array<{ type: string; amount: number; description: string }> };
  checkout_fuel: number; checkout_odometer: number; tank_capacity: number | null;
  waiver: { status: string; reason: string; fuel_price_per_liter: number } | null;
  damages: Array<{ id: string; description: string; estimated_cost: number | null }>;
  history: Array<{ id: string; actor_name: string; reason: string; corrected_at: string }>;
  status_history: Array<{ id: string; actor_name: string; reason: string; created_at: string }>;
}
export function rentalActionError(error: unknown): string {
  const message = (error as { message?: string })?.message || '';
  if (message.includes('ADMIN_ONLY')) return 'Αυτή η ενέργεια επιτρέπεται μόνο σε Admin.';
  if (message.includes('STALE')) return 'Τα στοιχεία άλλαξαν. Κλείστε και ανοίξτε ξανά την κράτηση.';
  if (message.includes('LATER_MOVEMENT')) return 'Το όχημα έχει μεταγενέστερη κίνηση. Δεν επιτρέπεται αναίρεση ή αλλαγή παλιών χιλιομέτρων.';
  if (message.includes('CONFLICT') || message.includes('reservations_no_vehicle_time_overlap') || (error as { code?: string })?.code === '23P01') return 'Υπάρχει άλλη κράτηση για το όχημα σε αυτές τις ημερομηνίες. Η αλλαγή δεν αποθηκεύτηκε.';
  if (message.includes('HAS_CHECKOUT')) return 'Έχει γίνει παράδοση του οχήματος. Δεν επιτρέπεται απλή επαναφορά σε Επερχόμενη ή ακύρωση.';
  if (message.includes('VEHICLE')) return 'Το όχημα δεν είναι διαθέσιμο για επαναφορά σε Νοικιασμένο. Ελέγξτε τον Στόλο και τις επόμενες παραδόσεις.';
  if (message.includes('FUEL')) return 'Ελέγξτε την τιμή καυσίμου και τη χρέωση ή την αιτιολογία εξαίρεσης.';
  if (message.includes('REASON')) return 'Απαιτείται αιτιολογία από 5 έως 2000 χαρακτήρες.';
  if (message.includes('HANDOVER_REQUIRED')) return 'Η κατάσταση αλλάζει μέσω κανονικού Check-Out ή Check-In.';
  return 'Η αλλαγή δεν αποθηκεύτηκε. Ελέγξτε τα στοιχεία και τα δικαιώματά σας.';
}
export const returnLifecycleService = {
  async load(reservationId: string): Promise<ReturnContext> {
    if (isDemo) throw new Error('Απαιτείται σύνδεση βάσης.');
    const { data, error } = await supabase!.rpc('get_checkin_correction_context', { p_reservation_id: reservationId });
    if (error) throw error;
    return data as ReturnContext;
  },
  async reopen(reservationId: string, context: ReturnContext, reason: string): Promise<void> {
    if (isDemo) throw new Error('Απαιτείται σύνδεση βάσης.');
    const { error } = await supabase!.rpc('reopen_vehicle_return', { p_reservation_id: reservationId,
      p_checkin_id: context.checkin.id, p_revision: context.checkin.correction_revision, p_reason: reason.trim() });
    if (error) throw error;
  },
  async changeUnstarted(reservationId: string, status: 'upcoming' | 'cancelled'): Promise<void> {
    if (isDemo) throw new Error('Απαιτείται σύνδεση βάσης.');
    const { error } = await supabase!.rpc('change_unstarted_reservation_status', { p_reservation_id: reservationId, p_status: status });
    if (error) throw error;
  },
  async edit(reservationId: string, context: ReturnContext, data: { fuel_level: number; odometer: number;
    fuel_price: number | null; fuel_waiver_reason: string | null;
    additional_charges: Array<{ type: string; amount: number; description: string }>;
    new_damages: Array<{ description: string; estimated_cost?: number }> }, reason: string): Promise<void> {
    if (isDemo) throw new Error('Απαιτείται σύνδεση βάσης.');
    const { error } = await supabase!.rpc('edit_vehicle_return', { p_reservation_id: reservationId,
      p_checkin_id: context.checkin.id, p_revision: context.checkin.correction_revision,
      p_fuel_level: data.fuel_level, p_odometer: data.odometer, p_fuel_price: data.fuel_price,
      p_charges: data.additional_charges.map(c => ({ type: c.type, amount: c.amount, description: c.description })),
      p_damages: data.new_damages.map(d => ({ description: d.description, estimated_cost: d.estimated_cost ?? null })),
      p_waiver_reason: data.fuel_waiver_reason, p_reason: reason.trim() });
    if (error) throw error;
  },
};
export const checkinService = {
  async complete(data: {
    reservation_id: string;
    fuel_level: number;
    odometer: number;
    new_damages: Array<{ description: string; estimated_cost?: number }>;
    additional_charges: Array<{ type: string; amount: number; description: string }>;
    fuel_price: number | null;
    fuel_waiver_reason: string | null;
    unpaid_reason?: string | null;
  }): Promise<void> {
    if (isDemo) return Promise.resolve();
    const { error } = await supabase!.rpc('complete_vehicle_checkin_v3', {
      p_reservation_id: data.reservation_id,
      p_fuel_level: data.fuel_level,
      p_odometer: data.odometer,
      p_new_damages: data.new_damages.map(d => ({
        description: d.description,
        estimated_cost: d.estimated_cost ?? null,
      })),
      p_additional_charges: data.additional_charges.map(c => ({
        type: c.type, amount: c.amount, description: c.description,
      })),
      p_fuel_price: data.fuel_price,
      p_fuel_waiver_reason: data.fuel_waiver_reason,
      p_unpaid_reason: data.unpaid_reason || null,
    });
    if (error) throw error;
  },
  async getByReservationId(reservationId: string): Promise<CheckinDetails | null> {
    if (isDemo) return Promise.resolve(null);

    const { data, error } = await supabase!
      .from('checkins')
      .select('fuel_level, odometer, additional_charges, new_damage_ids, checked_in_at, unpaid_reason, unpaid_amount')
      .is('voided_at', null)
      .eq('reservation_id', reservationId)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    let new_damages: CheckinDetails['new_damages'] = [];
    const damageIds: string[] = data.new_damage_ids || [];
    if (damageIds.length > 0) {
      const { data: dmgData, error: dmgErr } = await supabase!
        .from('damages')
        .select('id, description, estimated_cost')
        .in('id', damageIds);
      if (dmgErr) throw dmgErr;
      new_damages = (dmgData || []).map((d: any) => ({
        id: d.id,
        description: d.description,
        estimated_cost: d.estimated_cost != null ? Number(d.estimated_cost) : null,
      }));
    }

    return {
      fuel_level: data.fuel_level,
      odometer: data.odometer,
      unpaid_reason: data.unpaid_reason,
      unpaid_amount: data.unpaid_amount == null ? null : Number(data.unpaid_amount),
      additional_charges: (data.additional_charges || []).map((c: any) => ({
        type: c.type,
        amount: Number(c.amount) || 0,
        description: c.description || '',
      })),
      new_damages,
      checked_in_at: data.checked_in_at,
    };
  },

  async getAdditionalChargesByReservationIds(reservationIds: string[]): Promise<Map<string, number>> {
    if (isDemo || reservationIds.length === 0) return Promise.resolve(new Map());

    const { data, error } = await supabase!
      .from('checkins')
      .select('reservation_id, additional_charges')
      .is('voided_at', null)
      .in('reservation_id', reservationIds);

    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data || []) {
      const charges = row.additional_charges || [];
      const total = charges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
      if (total > 0) {
        map.set(row.reservation_id, (map.get(row.reservation_id) || 0) + total);
      }
    }
    return map;
  },


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
      .select('id, total_amount, status')
      .gte('pickup_date', `${today}T00:00:00`)
      .lt('pickup_date', `${today}T23:59:59`);

    const reservationIds = (reservations || []).map((r: any) => r.id).filter(Boolean);
    let chargesMap = new Map<string, number>();
    if (reservationIds.length > 0) {
      try {
        chargesMap = await checkinService.getAdditionalChargesByReservationIds(reservationIds);
      } catch {
        // Non-critical — continue with base revenue only
      }
    }

    const { data: checkouts } = await supabase!
      .from('checkouts')
      .select('id')
      .gte('checked_out_at', `${today}T00:00:00`)
      .lt('checked_out_at', `${today}T23:59:59`);

    const { data: checkins } = await supabase!
      .from('checkins')
      .select('id')
      .is('voided_at', null)
      .gte('checked_in_at', `${today}T00:00:00`)
      .lt('checked_in_at', `${today}T23:59:59`);

    return {
      reservations: reservations?.length || 0,
      revenue: reservations?.reduce((sum, r) => sum + (Number(r.total_amount) || 0) + (chargesMap.get(r.id) || 0), 0) || 0,
      pickups: checkouts?.length || 0,
      returns: checkins?.length || 0
    };
  },

  async getFleetOccupancy(_days: number = 7) {
    return [];
  }
};
