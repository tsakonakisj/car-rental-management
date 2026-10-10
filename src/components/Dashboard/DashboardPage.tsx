import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isDemoMode } from '../../lib/supabase';
import {
  CalendarDaysIcon,
  CurrencyEuroIcon,
  TruckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SourceStat {
  source: string;
  count: number;
  revenue: number;
}

interface StatusStat {
  status: string;
  count: number;
}

interface FleetStat {
  available: number;
  reserved: number;
  active: number;
  service: number;
  total: number;
}

interface TodayEntry {
  id: string;
  customerName: string;
  vehicleLabel: string;
  time: string;
  station: string;
}

const SOURCE_LABELS: Record<string, string> = {
  'store': 'Κατάστημα',
  'walk-in': 'Κατάστημα',
  'phone': 'Τηλέφωνο',
  'instagram': 'Instagram',
  'whatsapp': 'WhatsApp',
  'website': 'Ιστοσελίδα',
  'repeat': 'Επαναλαμβανόμενος Πελάτης',
  'other': 'Άλλο'
};

const STATUS_LABELS: Record<string, string> = {
  'upcoming': 'Επερχόμενες',
  'active': 'Ενεργές',
  'completed': 'Ολοκληρωμένες',
  'cancelled': 'Ακυρωμένες'
};

const STATUS_COLORS: Record<string, string> = {
  'upcoming': 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40',
  'active': 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40',
  'completed': 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35',
  'cancelled': 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40'
};

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStat[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStat>({ available: 0, reserved: 0, active: 0, service: 0, total: 0 });
  const [todayPickups, setTodayPickups] = useState<TodayEntry[]>([]);
  const [todayReturns, setTodayReturns] = useState<TodayEntry[]>([]);

  const fetchDashboard = useCallback(async () => {
    if (isDemoMode || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch reservations with customer source
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id, status, total_amount, pickup_date, return_date,
          customer:customers!reservations_customer_id_fkey(name, source),
          vehicle:vehicles!reservations_vehicle_id_fkey(plate, brand, model),
          pickup_station:stations!reservations_pickup_station_id_fkey(name),
          return_station:stations!reservations_return_station_id_fkey(name)
        `);

      if (resError) {
        console.error('Reservations query error:', resError);
      }

      // Fetch vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, status');

      // Process source stats
      const sourceMap = new Map<string, { count: number; revenue: number }>();
      (reservations || []).forEach((r: any) => {
        const source = r.customer?.source || 'other';
        const existing = sourceMap.get(source) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += Number(r.total_amount) || 0;
        sourceMap.set(source, existing);
      });
      const sourceData: SourceStat[] = Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        ...data
      }));
      setSourceStats(sourceData);

      // Process status stats
      const statusMap = new Map<string, number>();
      (reservations || []).forEach((r: any) => {
        statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
      });
      const statusData: StatusStat[] = ['upcoming', 'active', 'completed', 'cancelled'].map(status => ({
        status,
        count: statusMap.get(status) || 0
      }));
      setStatusStats(statusData);

      // Process fleet stats
      const fleet: FleetStat = { available: 0, reserved: 0, active: 0, service: 0, total: 0 };
      (vehicles || []).forEach((v: any) => {
        fleet.total += 1;
        if (v.status === 'available') fleet.available += 1;
        else if (v.status === 'reserved') fleet.reserved += 1;
        else if (v.status === 'service') fleet.service += 1;
      });
      // Count active rentals from reservations
      fleet.active = statusMap.get('active') || 0;
      setFleetStats(fleet);

      // Today's pickups
      const pickups: TodayEntry[] = (reservations || [])
        .filter((r: any) => r.pickup_date && r.pickup_date.startsWith(today) && r.status !== 'cancelled')
        .map((r: any) => ({
          id: r.id,
          customerName: r.customer?.name || '-',
          vehicleLabel: r.vehicle ? `${r.vehicle.plate} ${r.vehicle.brand} ${r.vehicle.model}` : '-',
          time: r.pickup_date ? new Date(r.pickup_date).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '-',
          station: r.pickup_station?.name || '-'
        }));
      setTodayPickups(pickups);

      // Today's returns
      const returns: TodayEntry[] = (reservations || [])
        .filter((r: any) => r.return_date && r.return_date.startsWith(today) && r.status !== 'cancelled')
        .map((r: any) => ({
          id: r.id,
          customerName: r.customer?.name || '-',
          vehicleLabel: r.vehicle ? `${r.vehicle.plate} ${r.vehicle.brand} ${r.vehicle.model}` : '-',
          time: r.return_date ? new Date(r.return_date).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '-',
          station: r.return_station?.name || '-'
        }));
      setTodayReturns(returns);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <ArrowPathIcon className="mr-3 h-5 w-5 animate-spin text-[#55a8ff]" />
        <span className="text-blue-100/65">Φόρτωση ταμπλό...</span>
      </div>
    );
  }

  if (isDemoMode) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Κεντρικό Ταμπλό</h1>
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/85 py-12 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <p className="text-blue-100/45">Το ταμπλό χρειάζεται σύνδεση βάσης δεδομένων.</p>
        </div>
      </div>
    );
  }

  const totalReservations = statusStats.reduce((s, st) => s + st.count, 0);
  const totalRevenue = sourceStats.reduce((s, st) => s + st.revenue, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Κεντρικό Ταμπλό</h1>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3.5 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
        >
          <ArrowPathIcon className="mr-1.5 h-4 w-4 text-[#72b9ff]" />
          Ανανέωση
        </button>
      </div>

      {/* Reservation Status Overview */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.02em] text-white">Κατάσταση Κρατήσεων</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statusStats.map((st) => (
            <div key={st.status} className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)]">
              <div className="flex items-center justify-between mb-3">
                {st.status === 'upcoming' && <ClockIcon className="h-5 w-5 text-[#55a8ff]" />}
                {st.status === 'active' && <CheckCircleIcon className="h-5 w-5 text-emerald-400" />}
                {st.status === 'completed' && <CalendarDaysIcon className="h-5 w-5 text-blue-100/45" />}
                {st.status === 'cancelled' && <XMarkIcon className="h-5 w-5 text-red-400" />}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[st.status] || 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35'}`}>
                  {STATUS_LABELS[st.status] || st.status}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-white">{st.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Availability */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.02em] text-white">Στόλος</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center">
              <TruckIcon className="mr-2 h-5 w-5 text-blue-100/45" />
              <span className="text-sm text-blue-100/55">Σύνολο</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-white">{fleetStats.total}</p>
          </div>
          <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center">
              <CheckCircleIcon className="mr-2 h-5 w-5 text-emerald-400" />
              <span className="text-sm text-blue-100/55">Διαθέσιμα</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-300">{fleetStats.available}</p>
          </div>
          <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center">
              <ClockIcon className="mr-2 h-5 w-5 text-amber-400" />
              <span className="text-sm text-blue-100/55">Κρατημένα</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-amber-300">{fleetStats.reserved}</p>
          </div>
          <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center">
              <TruckIcon className="mr-2 h-5 w-5 text-[#55a8ff]" />
              <span className="text-sm text-blue-100/55">Ενεργά</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-[#55a8ff]">{fleetStats.active}</p>
          </div>
          <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center">
              <ExclamationTriangleIcon className="mr-2 h-5 w-5 text-red-400" />
              <span className="text-sm text-blue-100/55">Συντήρηση</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-red-300">{fleetStats.service}</p>
          </div>
        </div>
      </div>

      {/* Reservations by Source + Revenue by Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
            <h3 className="text-base font-semibold text-white">Κρατήσεις ανά Πηγή</h3>
          </div>
          <div className="p-6">
            {sourceStats.length === 0 ? (
              <p className="py-4 text-center text-sm text-blue-100/45">Δεν υπάρχουν δεδομένα</p>
            ) : (
              <div className="space-y-3">
                {sourceStats.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <span className="text-sm text-blue-100/85">{SOURCE_LABELS[s.source] || s.source}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-24 overflow-hidden rounded-full bg-[#0b2949]/80 h-2">
                        <div
                          className="h-full rounded-full bg-[#2f8cff] transition-all duration-300"
                          style={{ width: `${totalReservations > 0 ? (s.count / totalReservations) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold tabular-nums text-white">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
            <h3 className="text-base font-semibold text-white">Έσοδα ανά Πηγή</h3>
          </div>
          <div className="p-6">
            {sourceStats.length === 0 ? (
              <p className="py-4 text-center text-sm text-blue-100/45">Δεν υπάρχουν δεδομένα</p>
            ) : (
              <div className="space-y-3">
                {sourceStats.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <span className="text-sm text-blue-100/85">{SOURCE_LABELS[s.source] || s.source}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-24 overflow-hidden rounded-full bg-[#0b2949]/80 h-2">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm font-semibold tabular-nums text-emerald-300">
                        {'\u20AC'}{s.revenue.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Pickups & Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
            <div className="flex items-center">
              <TruckIcon className="mr-2 h-5 w-5 text-[#55a8ff]" />
              <h3 className="text-base font-semibold text-white">Παραλαβές Σήμερα</h3>
              <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40">
                {todayPickups.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            {todayPickups.length === 0 ? (
              <p className="py-6 text-center text-sm text-blue-100/45">Δεν υπάρχουν παραλαβές σήμερα</p>
            ) : (
              <div className="divide-y divide-[#1e4e7d]/50">
                {todayPickups.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{entry.customerName}</p>
                      <p className="text-xs text-blue-100/45">{entry.vehicleLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-white">{entry.time}</p>
                      <p className="text-xs text-blue-100/45">{entry.station}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
            <div className="flex items-center">
              <CheckCircleIcon className="mr-2 h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Επιστροφές Σήμερα</h3>
              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/40">
                {todayReturns.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            {todayReturns.length === 0 ? (
              <p className="py-6 text-center text-sm text-blue-100/45">Δεν υπάρχουν επιστροφές σήμερα</p>
            ) : (
              <div className="divide-y divide-[#1e4e7d]/50">
                {todayReturns.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{entry.customerName}</p>
                      <p className="text-xs text-blue-100/45">{entry.vehicleLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-white">{entry.time}</p>
                      <p className="text-xs text-blue-100/45">{entry.station}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-3">
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Σύνολο Κρατήσεων</p>
            <p className="text-2xl font-bold tabular-nums text-white">{totalReservations}</p>
          </div>
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Συνολικά Έσοδα</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-300">{'\u20AC'}{totalRevenue.toFixed(2)}</p>
          </div>
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Οχήματα Στόλου</p>
            <p className="text-2xl font-bold tabular-nums text-white">{fleetStats.total}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
