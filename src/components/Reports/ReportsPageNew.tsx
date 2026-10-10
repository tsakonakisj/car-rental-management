import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import PageHero from '../Layout/PageHero';
import {
  CurrencyEuroIcon,
  CalendarDaysIcon,
  TruckIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { format, subDays } from 'date-fns';

interface DailySale {
  date: string;
  reservations: number;
  revenue: number;
  avg_revenue: number;
}

interface ChannelData {
  channel: string;
  reservations: number;
  revenue: number;
  percentage: number;
}

interface OccupancyData {
  category: string;
  total: number;
  occupied: number;
}

interface StationData {
  station: string;
  checkouts: number;
  checkins: number;
}

interface CategoryData {
  category: string;
  rentals: number;
  revenue: number;
  avgRevenue: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  'walk-in': 'Κατάστημα',
  phone: 'Τηλέφωνο',
  instagram: 'Instagram',
  online: 'Online',
  agency: 'Πρακτορείο',
};

const CHANNEL_COLORS: Record<string, string> = {
  'walk-in': 'bg-blue-500',
  phone: 'bg-green-500',
  instagram: 'bg-pink-500',
  online: 'bg-orange-500',
  agency: 'bg-teal-500',
};

const ReportsPageNew: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalRentals: 0,
    activeRentals: 0,
    completedRentals: 0,
  });
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [stationActivity, setStationActivity] = useState<StationData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);

  const fetchReport = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const fromTs = `${dateRange.from}T00:00:00`;
      const toTs = `${dateRange.to}T23:59:59`;

      const [pickupResult, returnResult, vehiclesResult] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            id, pickup_date, total_amount, status, category,
            customer:customers!reservations_customer_id_fkey(source),
            vehicle:vehicles!reservations_vehicle_id_fkey(category),
            pickup_station:stations!reservations_pickup_station_id_fkey(name)
          `)
          .gte('pickup_date', fromTs)
          .lte('pickup_date', toTs)
          .neq('status', 'cancelled'),

        supabase
          .from('reservations')
          .select(`
            id,
            return_station:stations!reservations_return_station_id_fkey(name)
          `)
          .gte('return_date', fromTs)
          .lte('return_date', toTs)
          .eq('status', 'completed'),

        supabase
          .from('vehicles')
          .select('id, category, status')
          .neq('status', 'inactive'),
      ]);

      if (pickupResult.error) throw pickupResult.error;
      if (returnResult.error) throw returnResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;

      const reservations = pickupResult.data || [];
      const returns = returnResult.data || [];
      const vehicles = vehiclesResult.data || [];

      const totalRevenue = reservations.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      setSummary({
        totalRevenue,
        totalRentals: reservations.length,
        activeRentals: reservations.filter(r => r.status === 'active').length,
        completedRentals: reservations.filter(r => r.status === 'completed').length,
      });

      const byDate = new Map<string, { count: number; revenue: number }>();
      for (const r of reservations) {
        const d = (r.pickup_date as string).substring(0, 10);
        const prev = byDate.get(d) ?? { count: 0, revenue: 0 };
        byDate.set(d, { count: prev.count + 1, revenue: prev.revenue + (Number(r.total_amount) || 0) });
      }
      setDailySales(
        Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { count, revenue }]) => ({
            date,
            reservations: count,
            revenue: Math.round(revenue * 100) / 100,
            avg_revenue: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
          }))
      );

      const byChannel = new Map<string, { count: number; revenue: number }>();
      for (const r of reservations) {
        const source = (r.customer as any)?.source || 'walk-in';
        const prev = byChannel.get(source) ?? { count: 0, revenue: 0 };
        byChannel.set(source, { count: prev.count + 1, revenue: prev.revenue + (Number(r.total_amount) || 0) });
      }
      const total = reservations.length || 1;
      setChannelData(
        Array.from(byChannel.entries())
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([channel, { count, revenue }]) => ({
            channel,
            reservations: count,
            revenue: Math.round(revenue * 100) / 100,
            percentage: Math.round((count / total) * 100),
          }))
      );

      const catTotal = new Map<string, number>();
      const catRented = new Map<string, number>();
      for (const v of vehicles) {
        const cat = v.category as string;
        catTotal.set(cat, (catTotal.get(cat) || 0) + 1);
        if (v.status === 'rented') catRented.set(cat, (catRented.get(cat) || 0) + 1);
      }
      setOccupancyData(
        Array.from(catTotal.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, tot]) => ({ category, total: tot, occupied: catRented.get(category) || 0 }))
      );

      const stMap = new Map<string, { checkouts: number; checkins: number }>();
      for (const r of reservations) {
        const name = (r.pickup_station as any)?.name;
        if (!name) continue;
        const prev = stMap.get(name) ?? { checkouts: 0, checkins: 0 };
        stMap.set(name, { ...prev, checkouts: prev.checkouts + 1 });
      }
      for (const r of returns) {
        const name = (r.return_station as any)?.name;
        if (!name) continue;
        const prev = stMap.get(name) ?? { checkouts: 0, checkins: 0 };
        stMap.set(name, { ...prev, checkins: prev.checkins + 1 });
      }
      setStationActivity(
        Array.from(stMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([station, { checkouts, checkins }]) => ({ station, checkouts, checkins }))
      );

      const byCat = new Map<string, { count: number; revenue: number }>();
      for (const r of reservations) {
        const cat = (r.vehicle as any)?.category || r.category || '—';
        const prev = byCat.get(cat) ?? { count: 0, revenue: 0 };
        byCat.set(cat, { count: prev.count + 1, revenue: prev.revenue + (Number(r.total_amount) || 0) });
      }
      setCategoryData(
        Array.from(byCat.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, { count, revenue }]) => ({
            category,
            rentals: count,
            revenue: Math.round(revenue * 100) / 100,
            avgRevenue: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
          }))
      );
    } catch (err) {
      console.error('Report fetch failed:', err);
      setError('Αποτυχία φόρτωσης αναφορών.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportToCSV = (data: object[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Spinner = () => (
    <div className="flex justify-center py-8">
      <ArrowPathIcon className="h-6 w-6 text-blue-100/45 animate-spin" />
    </div>
  );

  const Empty = ({ msg = 'Δεν υπάρχουν δεδομένα για την επιλεγμένη περίοδο.' }) => (
    <p className="text-center text-blue-100/45 py-8 text-sm">{msg}</p>
  );

  return (
    <div className="space-y-8 text-blue-50">
      <PageHero
        title="Αναφορές"
        subtitle="Αναφορές και στατιστικά απόδοσης"
        actions={(
          <>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
            <span className="text-blue-100/45">—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      />

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            { label: 'Συνολικά Έσοδα', value: `€${summary.totalRevenue.toFixed(2)}`, icon: CurrencyEuroIcon, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
            { label: 'Κρατήσεις', value: summary.totalRentals, icon: CalendarDaysIcon, color: 'text-[#55a8ff]', bg: 'bg-blue-500/15' },
            { label: 'Ενεργές', value: summary.activeRentals, icon: ClockIcon, color: 'text-amber-300', bg: 'bg-amber-500/15' },
            { label: 'Ολοκληρωμένες', value: summary.completedRentals, icon: CheckCircleIcon, color: 'text-teal-300', bg: 'bg-teal-500/15' },
          ] as const
        ).map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] p-5 flex items-center gap-4">
            <div className={`${bg} rounded-full p-3 flex-shrink-0`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <div>
              <p className="text-sm text-blue-100/55">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Ημερήσιες Πωλήσεις</h2>
          <button
            onClick={() => exportToCSV(dailySales, 'daily-sales')}
            disabled={!dailySales.length}
            className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Εξαγωγή CSV
          </button>
        </div>
        <div className="p-6">
          {loading ? <Spinner /> : dailySales.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#1e4e7d]/70">
                    <th className="text-left py-3 text-sm font-medium text-blue-100/55">Ημερομηνία</th>
                    <th className="text-center py-3 text-sm font-medium text-blue-100/55">Κρατήσεις</th>
                    <th className="text-right py-3 text-sm font-medium text-blue-100/55">Έσοδα</th>
                    <th className="text-right py-3 text-sm font-medium text-blue-100/55">Μέσο Έσοδο</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e4e7d]/50">
                  {dailySales.map((day) => (
                    <tr key={day.date} className="hover:bg-[#0b2949]/50">
                      <td className="py-3 text-sm font-medium text-white">
                        {format(new Date(`${day.date}T12:00:00`), 'dd/MM/yyyy')}
                      </td>
                      <td className="text-center py-3">
                        <span className="text-sm font-medium text-[#8ec7ff] bg-blue-500/15 px-2 py-0.5 rounded-full ring-1 ring-inset ring-blue-400/40">
                          {day.reservations}
                        </span>
                      </td>
                      <td className="text-right py-3 text-sm font-semibold text-emerald-300">
                        €{day.revenue.toFixed(2)}
                      </td>
                      <td className="text-right py-3 text-sm text-blue-100/55">
                        €{day.avg_revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#1e4e7d]/70 bg-[#0b2949]/50 font-semibold">
                    <td className="py-3 text-sm">Σύνολο</td>
                    <td className="text-center py-3 text-sm">{summary.totalRentals}</td>
                    <td className="text-right py-3 text-sm text-emerald-300">€{summary.totalRevenue.toFixed(2)}</td>
                    <td className="text-right py-3 text-sm text-blue-100/55">
                      {summary.totalRentals > 0
                        ? `€${(summary.totalRevenue / summary.totalRentals).toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Ανάλυση ανά Κατηγορία Οχήματος</h2>
          <button
            onClick={() => exportToCSV(categoryData, 'category-breakdown')}
            disabled={!categoryData.length}
            className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Εξαγωγή CSV
          </button>
        </div>
        <div className="p-6">
          {loading ? <Spinner /> : categoryData.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryData.map((cat) => (
                <div key={cat.category} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-500/15 rounded-full p-2">
                      <TruckIcon className="h-5 w-5 text-[#55a8ff]" />
                    </div>
                    <h3 className="font-semibold text-white">Κατηγορία {cat.category}</h3>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-100/55">Κρατήσεις</span>
                      <span className="font-medium">{cat.rentals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-100/55">Έσοδα</span>
                      <span className="font-semibold text-emerald-300">€{cat.revenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-100/55">Μέσο/κράτηση</span>
                      <span className="text-blue-100/85">€{cat.avgRevenue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Έσοδα ανά Κανάλι</h2>
        </div>
        <div className="p-6">
          {loading ? <Spinner /> : channelData.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {channelData.map((ch) => (
                <div key={ch.channel} className="text-center">
                  <div
                    className={`w-16 h-16 ${CHANNEL_COLORS[ch.channel] || 'bg-[#2b5b85]'} rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold`}
                  >
                    {ch.percentage}%
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1">
                    {CHANNEL_LABELS[ch.channel] || ch.channel}
                  </h3>
                  <p className="text-xs text-blue-100/55">{ch.reservations} κρατήσεις</p>
                  <p className="text-base font-semibold text-emerald-300">€{ch.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Πληρότητα Στόλου — Τρέχουσα Κατάσταση</h2>
        </div>
        <div className="p-6">
          {loading ? <Spinner /> : occupancyData.length === 0 ? <Empty msg="Δεν βρέθηκαν δεδομένα στόλου." /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {occupancyData.map((item) => {
                const pct = item.total > 0 ? (item.occupied / item.total) * 100 : 0;
                return (
                  <div key={item.category} className="text-center">
                    <TruckIcon className="h-7 w-7 text-blue-100/45 mx-auto mb-2" />
                    <h3 className="font-medium text-white mb-3">{item.category}</h3>
                    <div className="text-2xl font-bold text-[#55a8ff] mb-2">{item.occupied}/{item.total}</div>
                    <div className="w-full bg-[#0b2949] rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full transition-all ${pct < 50 ? 'bg-green-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-100/55">{pct.toFixed(0)}% ενοικιάζεται</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Δραστηριότητα Σταθμών</h2>
        </div>
        <div className="p-6">
          {loading ? <Spinner /> : stationActivity.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stationActivity.map((st) => (
                <div key={st.station} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                  <h3 className="font-medium text-white mb-4 text-center">{st.station}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#55a8ff]">{st.checkouts}</div>
                      <p className="text-sm text-blue-100/55">Check-outs</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-300">{st.checkins}</div>
                      <p className="text-sm text-blue-100/55">Check-ins</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPageNew;
