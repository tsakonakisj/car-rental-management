import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isDemoMode } from '../../lib/supabase';
import { reservationFinancialSummaryService, fuelWaiverService } from '../../lib/database';
import type { FuelWaiverRequest } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import PageHero from '../Layout/PageHero';
import {
  CalendarDaysIcon,
  CurrencyEuroIcon,
  TruckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface DashboardReservation {
  id: string;
  status: string;
  created_at: string;
  total_amount?: number;
  pickup_date: string | null;
  return_date: string | null;
  customer: { name: string; source: string } | null;
  vehicle: { plate: string; brand: string; model: string } | null;
  pickup_station: { name: string } | null;
  return_station: { name: string } | null;
}

interface FinancialOverview {
  userId: string;
  netReceived: number;
  bookingValue: number;
  outstanding: number;
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
  rented: number;
  inactive: number;
  other: number;
}

interface TodayEntry {
  id: string;
  customerName: string;
  vehicleLabel: string;
  time: string;
  station: string;
}

interface VehicleAlert {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  level: 'expired' | 'critical' | 'warning' | 'soon' | 'ok';
  alertReason?: string;
  serviceReasons?: string[];
}

const DEFAULT_SERVICE_WARNING_DAYS = 30;
const DEFAULT_SERVICE_WARNING_KM = 1000;

function getServiceLevelFromDays(days: number): ExpiryLevel {
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 15) return 'warning';
  if (days <= 30) return 'soon';
  return 'ok';
}

function getServiceLevelFromKm(kmRemaining: number, warningKm: number): ExpiryLevel {
  if (kmRemaining < 0) return 'expired';
  if (kmRemaining <= Math.round(warningKm * 0.1)) return 'critical';
  if (kmRemaining <= Math.round(warningKm * 0.3)) return 'warning';
  if (kmRemaining <= warningKm) return 'soon';
  return 'ok';
}

type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'soon' | 'ok';

function getExpiryLevel(date: string): ExpiryLevel {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date + 'T00:00:00');
  const days = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 15) return 'warning';
  if (days <= 30) return 'soon';
  return 'ok';
}

function daysUntilExpiry(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date + 'T00:00:00');
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const ALERT_STYLES: Record<ExpiryLevel, string> = {
  expired: 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40',
  critical: 'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-400/40',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40',
  soon: 'bg-yellow-500/15 text-yellow-200 ring-1 ring-inset ring-yellow-400/40',
  ok: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40',
};

function expiryDaysLabel(days: number): string {
  if (days < 0) return 'Έληξε';
  if (days === 0) return 'Σήμερα';
  return `${days} ημέρες`;
}

const SEVERITY_RANK: Record<ExpiryLevel, number> = {
  expired: 0,
  critical: 1,
  warning: 2,
  soon: 3,
  ok: 4,
};

interface ServiceTrigger {
  level: ExpiryLevel;
  daysRemaining: number;
  reason: string;
  expiryDate: string;
}

interface VehicleAlertGroup {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  alerts: VehicleAlert[];
  highestLevel: ExpiryLevel;
}

type RecentReservation = Pick<DashboardReservation, 'id' | 'customer' | 'vehicle' | 'pickup_date' | 'return_date' | 'status'>;

const RESERVATION_STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: 'Επερχόμενη', className: 'bg-blue-500/15 text-blue-200 ring-blue-400/25' },
  active: { label: 'Ενεργή', className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/25' },
  completed: { label: 'Ολοκληρωμένη', className: 'bg-slate-500/20 text-slate-200 ring-slate-400/25' },
  cancelled: { label: 'Ακυρωμένη', className: 'bg-rose-500/15 text-rose-200 ring-rose-400/25' },
};

const ReservationDate: React.FC<{ value: string | null }> = ({ value }) => {
  if (!value) return <span className="text-blue-100/45">—</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="text-blue-100/45">—</span>;
  return (
    <time dateTime={value} className="whitespace-nowrap">
      <span className="block text-blue-100/85">{date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
      <span className="mt-0.5 block text-blue-100/45">{date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}</span>
    </time>
  );
};

type DashboardCardTheme = {
  icon: string;
  iconBackground: string;
};

const KPI_THEMES: Record<string, DashboardCardTheme> = {
  upcoming: { icon: 'text-blue-200', iconBackground: 'bg-blue-500/25 ring-blue-400/20' },
  active: { icon: 'text-emerald-200', iconBackground: 'bg-emerald-500/25 ring-emerald-400/20' },
  available: { icon: 'text-slate-200', iconBackground: 'bg-slate-500/30 ring-slate-400/20' },
  pending: { icon: 'text-amber-200', iconBackground: 'bg-amber-500/25 ring-amber-400/20' },
};

const currency = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' });

interface DashboardMetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  theme: DashboardCardTheme;
  onClick?: () => void;
}

const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({ title, value, description, icon: Icon, theme, onClick }) => {
  const content = (
    <div className="flex items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${theme.iconBackground}`}>
        <Icon className={`h-6 w-6 ${theme.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-4 text-slate-300">{title}</p>
        <p className="mt-1 text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight text-white">{value}</p>
        <p className="mt-1.5 text-xs leading-4 text-slate-400">{description}</p>
      </div>
    </div>
  );
  const className = `min-h-[100px] rounded-xl border border-slate-400/15 bg-[#0b223b] p-4 shadow-sm transition-colors ${onClick ? 'cursor-pointer hover:border-slate-400/30 hover:bg-[#102b47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#061a35]' : ''}`;
  return onClick ? <button type="button" onClick={onClick} className={`${className} w-full text-left`}>{content}</button> : <div className={className}>{content}</div>;
};

interface FleetSegment {
  label: string;
  count: number;
  color: string;
}

// Each vehicle contributes to exactly one segment, including inactive vehicles.
const FleetDonut: React.FC<{ segments: FleetSegment[]; total: number }> = ({ segments, total }) => {
  let offset = 0;
  return (
    <div className="relative mx-auto h-44 w-44 shrink-0">
      <svg viewBox="0 0 160 160" role="img" aria-label={`Κατάσταση ${total} οχημάτων: ${segments.map(segment => `${segment.label} ${segment.count}`).join(', ')}`} className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r="64" fill="none" stroke="#1e344e" strokeWidth="14" />
        {total > 0 && segments.map(segment => {
          const percentage = segment.count / total * 100;
          const start = offset;
          offset += percentage;
          return segment.count > 0 ? <circle key={segment.label} cx="80" cy="80" r="64" fill="none" stroke={segment.color} strokeWidth="14" pathLength="100" strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={-start} /> : null;
        })}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-white">{total}</span>
        <span className="mt-1 text-xs text-slate-400">Οχήματα</span>
      </div>
    </div>
  );
};

interface DashboardPageProps {
  onNavigateReservations?: (filter: string) => void;
  onNavigateFleet?: () => void;
  onNavigateVehicle?: (vehicleId: string) => void;
  onNewBooking?: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateReservations, onNavigateFleet, onNavigateVehicle, onNewBooking }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userId = user?.id;
  const requestVersion = useRef(0);
  const pendingTasksRef = useRef<HTMLDivElement>(null);
  const [financials, setFinancials] = useState<FinancialOverview | null>(null);
  const [financialError, setFinancialError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pendingFuelWaivers, setPendingFuelWaivers] = useState<FuelWaiverRequest[]>([]);
  const [reviewTarget, setReviewTarget] = useState<FuelWaiverRequest | null>(null);
  const [reviewApprove, setReviewApprove] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStat[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStat>({ available: 0, reserved: 0, active: 0, service: 0, total: 0, rented: 0, inactive: 0, other: 0 });
  const [todayPickups, setTodayPickups] = useState<TodayEntry[]>([]);
  const [todayReturns, setTodayReturns] = useState<TodayEntry[]>([]);
  const [vehicleAlertGroups, setVehicleAlertGroups] = useState<VehicleAlertGroup[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (isDemoMode || !supabase) {
      setLoading(false);
      return;
    }

    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(false);
    setFinancials(null);
    setFinancialError(false);
    try {
      if (isAdmin) {
        const pending = await fuelWaiverService.listPending();
        setPendingFuelWaivers(pending);
      } else {
        setPendingFuelWaivers([]);
      }
      const today = new Date().toISOString().split('T')[0];

      // Reuse the reservation data for the latest five rows and existing dashboard totals.
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id, status, created_at, ${isAdmin ? 'total_amount,' : ''} pickup_date, return_date,
          customer:customers!reservations_customer_id_fkey(name, source),
          vehicle:vehicles!reservations_vehicle_id_fkey(plate, brand, model),
          pickup_station:stations!reservations_pickup_station_id_fkey(name),
          return_station:stations!reservations_return_station_id_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (resError) throw resError;
      const reservationRows = (reservations || []) as unknown as DashboardReservation[];

      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, brand, model, status, insurance_expiry, inspection_expiry, odometer, next_service_date, next_service_odometer');
      if (vehiclesError) throw vehiclesError;

      // Fetch service-reminder thresholds from settings (default 30 days / 1000 km)
      let serviceWarningDays = DEFAULT_SERVICE_WARNING_DAYS;
      let serviceWarningKm = DEFAULT_SERVICE_WARNING_KM;
      const { data: serviceSettings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'service_reminders')
        .maybeSingle();
      if (serviceSettings?.value && typeof serviceSettings.value === 'object') {
        const v = serviceSettings.value as Record<string, unknown>;
        if (typeof v.warning_days === 'number' && v.warning_days > 0) serviceWarningDays = v.warning_days;
        if (typeof v.warning_km === 'number' && v.warning_km > 0) serviceWarningKm = v.warning_km;
      }

      if (version !== requestVersion.current) return;
      // Keep financial fields out of the recent-reservations table state.
      setRecentReservations(reservationRows.slice(0, 5).map(({ id, customer, vehicle, pickup_date, return_date, status }) => ({
        id, customer, vehicle, pickup_date, return_date, status,
      })));

      // Process status stats
      const statusMap = new Map<string, number>();
      reservationRows.forEach((r) => {
        statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
      });
      const statusData: StatusStat[] = ['upcoming', 'active', 'completed', 'cancelled'].map(status => ({
        status,
        count: statusMap.get(status) || 0
      }));
      setStatusStats(statusData);

      // Process fleet stats
      const fleet: FleetStat = { available: 0, reserved: 0, active: 0, service: 0, total: 0, rented: 0, inactive: 0, other: 0 };
      const alerts: VehicleAlert[] = [];
      (vehicles || []).forEach((v) => {
        fleet.total += 1;
        if (v.status === 'available') fleet.available += 1;
        else if (v.status === 'reserved') fleet.reserved += 1;
        else if (v.status === 'service') fleet.service += 1;
        else if (v.status === 'rented') fleet.rented += 1;
        else if (v.status === 'inactive') fleet.inactive += 1;
        else fleet.other += 1;

        if (v.status === 'inactive') return;
        if (v.insurance_expiry) {
          const level = getExpiryLevel(v.insurance_expiry);
          if (level !== 'ok') {
            alerts.push({
              vehicleId: v.id,
              plate: v.plate,
              brand: v.brand,
              model: v.model,
              documentType: 'Ασφάλεια',
              expiryDate: v.insurance_expiry,
              daysRemaining: daysUntilExpiry(v.insurance_expiry),
              level,
            });
          }
        }
        if (v.inspection_expiry) {
          const level = getExpiryLevel(v.inspection_expiry);
          if (level !== 'ok') {
            alerts.push({
              vehicleId: v.id,
              plate: v.plate,
              brand: v.brand,
              model: v.model,
              documentType: 'ΚΤΕΟ',
              expiryDate: v.inspection_expiry,
              daysRemaining: daysUntilExpiry(v.inspection_expiry),
              level,
            });
          }
        }
        // Service reminders — collect date and km triggers, then group into one alert
        const serviceTriggers: ServiceTrigger[] = [];
        if (v.next_service_date) {
          const days = daysUntilExpiry(v.next_service_date);
          const level = getServiceLevelFromDays(days);
          if (days <= serviceWarningDays) {
            serviceTriggers.push({
              level,
              daysRemaining: days,
              reason: days < 0 ? `Έχει περάσει (${Math.abs(days)} ημέρες)` : `${days} ημέρες`,
              expiryDate: v.next_service_date,
            });
          }
        }
        if (v.next_service_odometer != null && v.odometer != null) {
          const kmRemaining = v.next_service_odometer - v.odometer;
          if (kmRemaining <= serviceWarningKm) {
            const level = getServiceLevelFromKm(kmRemaining, serviceWarningKm);
            serviceTriggers.push({
              level,
              daysRemaining: kmRemaining,
              reason: kmRemaining < 0 ? `Έχει ξεπεραστεί ${Math.abs(kmRemaining)} km` : `${kmRemaining} km απομένουν`,
              expiryDate: '',
            });
          }
        }
        if (serviceTriggers.length > 0) {
          serviceTriggers.sort((a, b) => SEVERITY_RANK[a.level] - SEVERITY_RANK[b.level] || a.daysRemaining - b.daysRemaining);
          const top = serviceTriggers[0];
          alerts.push({
            vehicleId: v.id,
            plate: v.plate,
            brand: v.brand,
            model: v.model,
            documentType: 'Service',
            expiryDate: top.expiryDate,
            daysRemaining: top.daysRemaining,
            level: top.level,
            alertReason: top.reason,
            serviceReasons: serviceTriggers.map(t => t.reason),
          });
        }
      });

      // Group ALL alerts by vehicleId — each vehicle appears once with all its alerts
      const alertsByVehicle = new Map<string, VehicleAlert[]>();
      for (const a of alerts) {
        const list = alertsByVehicle.get(a.vehicleId) || [];
        list.push(a);
        alertsByVehicle.set(a.vehicleId, list);
      }
      const alertGroups: VehicleAlertGroup[] = Array.from(alertsByVehicle.entries()).map(([vehicleId, list]) => {
        const highestLevel = list.reduce<ExpiryLevel>(
          (best, a) => SEVERITY_RANK[a.level] < SEVERITY_RANK[best] ? a.level : best,
          list[0].level
        );
        list.sort((a, b) => SEVERITY_RANK[a.level] - SEVERITY_RANK[b.level] || a.daysRemaining - b.daysRemaining);
        return {
          vehicleId,
          plate: list[0].plate,
          brand: list[0].brand,
          model: list[0].model,
          alerts: list,
          highestLevel,
        };
      });
      alertGroups.sort((a, b) => SEVERITY_RANK[a.highestLevel] - SEVERITY_RANK[b.highestLevel]);
      setVehicleAlertGroups(alertGroups);
      // Count active rentals from reservations
      fleet.active = statusMap.get('active') || 0;
      setFleetStats(fleet);

      // Today's pickups
      const pickups: TodayEntry[] = reservationRows
        .filter((r) => r.pickup_date && r.pickup_date.startsWith(today) && r.status !== 'cancelled')
        .map((r) => ({
          id: r.id,
          customerName: r.customer?.name || '-',
          vehicleLabel: r.vehicle ? `${r.vehicle.plate} ${r.vehicle.brand} ${r.vehicle.model}` : '-',
          time: r.pickup_date ? new Date(r.pickup_date).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '-',
          station: r.pickup_station?.name || '-'
        }));
      setTodayPickups(pickups);

      // Today's returns
      const returns: TodayEntry[] = reservationRows
        .filter((r) => r.return_date && r.return_date.startsWith(today) && r.status !== 'cancelled')
        .map((r) => ({
          id: r.id,
          customerName: r.customer?.name || '-',
          vehicleLabel: r.vehicle ? `${r.vehicle.plate} ${r.vehicle.brand} ${r.vehicle.model}` : '-',
          time: r.return_date ? new Date(r.return_date).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '-',
          station: r.return_station?.name || '-'
        }));
      setTodayReturns(returns);

      if (isAdmin && userId) {
        try {
          // Reuse receipt/refund/void handling and the latest valid check-in charges.
          // Batch IDs to keep the existing service queries within URL-size limits.
          let netReceivedCents = 0;
          let bookingValueCents = 0;
          let outstandingCents = 0;
          for (let start = 0; start < reservationRows.length; start += 100) {
            const batch = reservationRows.slice(start, start + 100);
            const summaries = await reservationFinancialSummaryService.getMany(
              batch.map(row => row.id),
              Object.fromEntries(batch.map(row => [row.id, Number(row.total_amount) || 0])),
            );
            if (version !== requestVersion.current) return;
            for (const row of batch) {
              const summary = summaries[row.id];
              netReceivedCents += Math.round(summary.received * 100);
              if (row.status !== 'cancelled') {
                bookingValueCents += Math.round(summary.total * 100);
                outstandingCents += Math.round(summary.balance * 100);
              }
            }
          }
          if (version === requestVersion.current) setFinancials({
            userId, netReceived: netReceivedCents / 100,
            bookingValue: bookingValueCents / 100, outstanding: outstandingCents / 100,
          });
        } catch (err) {
          console.error('Dashboard financial summary failed:', err);
          if (version === requestVersion.current) setFinancialError(true);
        }
      }
    } catch (err) {
      console.error('Dashboard load failed:', err);
      if (version === requestVersion.current) setLoadError(true);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isAdmin, userId]);

  const completeFuelReview = async () => {
    if (!isAdmin || !reviewTarget || reviewNote.trim().length < 5 || reviewSaving) return;
    setReviewSaving(true);
    setReviewError('');
    try {
      await fuelWaiverService.review(reviewTarget.id, reviewApprove, reviewNote);
      setPendingFuelWaivers(current => current.filter(request => request.id !== reviewTarget.id));
      setReviewTarget(null);
      setReviewNote('');
      await fetchDashboard();
    } catch (err) {
      console.error('Fuel approval failed:', err);
      setReviewError('Δεν αποθηκεύτηκε η απόφαση. Δοκιμάστε ξανά.');
    } finally {
      setReviewSaving(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    return () => { requestVersion.current += 1; };
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
        <PageHero
          title="Κεντρικό Ταμπλό"
          subtitle="Επισκόπηση κρατήσεων και στόλου"
        />
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/85 py-12 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <p className="text-blue-100/45">Το ταμπλό χρειάζεται σύνδεση βάσης δεδομένων.</p>
        </div>
      </div>
    );
  }

  const totalReservations = statusStats.reduce((s, st) => s + st.count, 0);
  const statusCount = (status: string) => statusStats.find(stat => stat.status === status)?.count || 0;
  const pendingCount = vehicleAlertGroups.length + (isAdmin ? pendingFuelWaivers.length : 0);
  const visibleFinancials = isAdmin && financials?.userId === user?.id ? financials : null;
  const fleetSegments: FleetSegment[] = [
    { label: 'Διαθέσιμα', count: fleetStats.available, color: '#34d399' },
    { label: 'Νοικιασμένα', count: fleetStats.rented, color: '#6380ff' },
    { label: 'Κρατημένα', count: fleetStats.reserved, color: '#fbbf24' },
    { label: 'Συντήρηση', count: fleetStats.service, color: '#fb7185' },
    { label: 'Ανενεργά', count: fleetStats.inactive, color: '#64748b' },
    { label: 'Λοιπά', count: fleetStats.other, color: '#94a3b8' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-[#2b5b85]/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Κεντρικό Ταμπλό</h1>
          <p className="mt-1 text-sm text-blue-100/70">Επισκόπηση κρατήσεων και στόλου</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              onClick={fetchDashboard}
              className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3.5 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
            >
              <ArrowPathIcon className="mr-1.5 h-4 w-4 text-[#72b9ff]" />
              Ανανέωση
            </button>
            {onNewBooking && (
              <button
                onClick={onNewBooking}
                className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
              >
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Νέα Κράτηση
              </button>
            )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Δεν φορτώθηκαν τα στοιχεία του ταμπλό. Πατήστε Ανανέωση για να δοκιμάσετε ξανά.
        </div>
      )}

      {!loadError && <>
      {/* Four compact operational KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard title="Επερχόμενες Κρατήσεις" value={statusCount('upcoming')} description="Προγραμματισμένες" icon={CalendarDaysIcon} theme={KPI_THEMES.upcoming} onClick={onNavigateReservations ? () => onNavigateReservations('upcoming') : undefined} />
        <DashboardMetricCard title="Ενεργές Ενοικιάσεις" value={fleetStats.active} description="Σε εξέλιξη τώρα" icon={CheckCircleIcon} theme={KPI_THEMES.active} onClick={onNavigateReservations ? () => onNavigateReservations('active') : undefined} />
        <DashboardMetricCard title="Διαθέσιμα Οχήματα" value={fleetStats.available} description={`Από ${fleetStats.total} οχήματα στόλου`} icon={TruckIcon} theme={KPI_THEMES.available} onClick={onNavigateFleet} />
        <DashboardMetricCard title="Εκκρεμότητες" value={pendingCount} description={isAdmin ? `${vehicleAlertGroups.length} οχήματα · ${pendingFuelWaivers.length} αιτήματα` : 'Οχήματα με ειδοποιήσεις'} icon={ExclamationTriangleIcon} theme={KPI_THEMES.pending} onClick={pendingCount > 0 ? () => { setAlertsOpen(true); setShowAllAlerts(false); pendingTasksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } : undefined} />
      </div>

      <div className={`grid grid-cols-1 gap-5 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        {isAdmin && (
          <section aria-labelledby="dashboard-financial-title" className="min-w-0 rounded-2xl border border-slate-400/15 bg-[#0b223b] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="dashboard-financial-title" className="text-base font-semibold text-white">Οικονομική Επισκόπηση</h2>
              <CurrencyEuroIcon className="h-5 w-5 shrink-0 text-blue-300" />
            </div>
            <p className="mt-1 text-xs text-slate-400">Σύνολο καταχωρισμένων συναλλαγών · Μόνο Admin</p>
            {financialError ? (
              <p role="alert" className="mt-6 text-sm text-amber-200">Τα οικονομικά στοιχεία δεν είναι διαθέσιμα. Πατήστε Ανανέωση.</p>
            ) : visibleFinancials ? (
              <>
                <p className="mt-6 text-sm text-slate-300">Καθαρές εισπράξεις</p>
                <p className="mt-2 break-words text-3xl font-semibold tabular-nums tracking-tight text-white">{currency.format(visibleFinancials.netReceived)}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Έγκυρες πληρωμές μείον επιστροφές χρημάτων.</p>
                <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-400/15 pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-400">Αξία κρατήσεων</dt>
                    <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-blue-100">{currency.format(visibleFinancials.bookingValue)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Ανεξόφλητα υπόλοιπα</dt>
                    <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-amber-200">{currency.format(visibleFinancials.outstanding)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-slate-400">Αξία και υπόλοιπα χωρίς ακυρωμένες κρατήσεις, με τις ισχύουσες πρόσθετες χρεώσεις.</p>
              </>
            ) : <p role="status" className="mt-6 text-sm text-slate-400">Φόρτωση οικονομικών στοιχείων...</p>}
          </section>
        )}
        <section aria-labelledby="dashboard-fleet-title" className="min-w-0 rounded-2xl border border-slate-400/15 bg-[#0b223b] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="dashboard-fleet-title" className="text-base font-semibold text-white">Κατάσταση Στόλου</h2>
            {onNavigateFleet && <button type="button" onClick={onNavigateFleet} className="text-xs font-medium text-blue-300 hover:text-blue-100">Προβολή στόλου →</button>}
          </div>
          <p className="mt-1 text-xs text-slate-400">Τρέχουσα κατάσταση όλων των οχημάτων</p>
          <div className="mt-5 flex flex-col items-stretch gap-5 sm:flex-row sm:items-center">
            <FleetDonut segments={fleetSegments} total={fleetStats.total} />
            <dl className="min-w-0 flex-1 space-y-2.5">
              {fleetSegments.filter(segment => segment.label !== 'Λοιπά' || segment.count > 0).map(segment => (
                <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="flex min-w-0 items-center gap-2 text-slate-300"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}</dt>
                  <dd className="font-semibold tabular-nums text-white">{segment.count}</dd>
                </div>
              ))}
            </dl>
          </div>
          {fleetStats.total === 0 && <p className="mt-4 text-center text-xs text-slate-400">Δεν υπάρχουν καταχωρισμένα οχήματα.</p>}
        </section>
      </div>

      <div ref={pendingTasksRef} className="scroll-mt-4 space-y-4">
      {/* Vehicle Alerts — accordion */}
      {vehicleAlertGroups.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          {/* Header — always visible, toggles accordion */}
          <button
            type="button"
            onClick={() => { setAlertsOpen(o => !o); setShowAllAlerts(false); }}
            className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#0b2949]/40"
          >
            <div className="flex items-center">
              <ExclamationTriangleIcon className="mr-2 h-5 w-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Ειδοποιήσεις Οχημάτων</h3>
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/40">
                {vehicleAlertGroups.length}
              </span>
            </div>
            <ChevronDownIcon
              className={`h-4 w-4 text-blue-100/45 transition-transform duration-200 ${alertsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Collapsible body */}
          {alertsOpen && (() => {
            const visible = showAllAlerts ? vehicleAlertGroups : vehicleAlertGroups.slice(0, 5);
            return (
              <div className="border-t border-[#1e4e7d]/70">
                <div
                  className="divide-y divide-[#1e4e7d]/50 overflow-y-auto"
                  style={{ maxHeight: '350px' }}
                >
                  {visible.map((group, idx) => (
                    <button
                      key={`${group.vehicleId}-${idx}`}
                      type="button"
                      onClick={() => onNavigateVehicle ? onNavigateVehicle(group.vehicleId) : onNavigateFleet?.()}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-[#0b2949]/40"
                    >
                      <div className="flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 flex-shrink-0 text-blue-100/45" />
                        <p className="text-sm font-medium text-white">{group.plate}</p>
                        <span className="text-xs text-blue-100/45">{group.brand} {group.model}</span>
                      </div>
                      <div className="ml-6 space-y-1.5">
                        {group.alerts.map((alert, aIdx) => (
                          <div key={aIdx} className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs text-blue-100/55">{alert.documentType}</span>
                              {alert.serviceReasons && alert.serviceReasons.length > 0
                                ? <div className="space-y-0.5">
                                    {alert.serviceReasons.map((reason, i) => (
                                      <p key={i} className="truncate text-xs text-blue-100/40">{reason}</p>
                                    ))}
                                  </div>
                                : alert.expiryDate
                                  ? <p className="truncate text-xs text-blue-100/40">{new Date(alert.expiryDate + 'T00:00:00').toLocaleDateString('el-GR')}</p>
                                  : alert.alertReason
                                    ? <p className="truncate text-xs text-blue-100/40">{alert.alertReason}</p>
                                    : null
                              }
                            </div>
                            <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${ALERT_STYLES[alert.level]}`}>
                              {alert.serviceReasons
                                ? alert.alertReason
                                : alert.alertReason && !alert.expiryDate
                                  ? alert.alertReason
                                  : expiryDaysLabel(alert.daysRemaining)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
                {vehicleAlertGroups.length > 5 && (
                  <div className="border-t border-[#1e4e7d]/70 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setShowAllAlerts(s => !s)}
                      className="text-xs font-medium text-[#55a8ff] transition-colors hover:text-[#7bc0ff]"
                    >
                      {showAllAlerts ? 'Λιγότερα' : `Προβολή όλων (${vehicleAlertGroups.length})`}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {isAdmin && (
        <section className="rounded-2xl border border-amber-400/35 bg-[#071d38]/90 p-5 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-300" />
            <h2 className="text-base font-semibold text-white">Εγκρίσεις εξαιρέσεων καυσίμου</h2>
            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">{pendingFuelWaivers.length}</span>
          </div>
          {pendingFuelWaivers.length === 0 ? (
            <p className="text-sm text-blue-100/60">Δεν υπάρχουν εκκρεμή αιτήματα.</p>
          ) : (
            <div className="space-y-3">
              {pendingFuelWaivers.map(request => (
                <div key={request.id} className="rounded-xl border border-[#2b5b85]/70 bg-[#0b2949]/75 p-4">
                  <p className="text-sm font-semibold text-white">Κράτηση #{request.reservation_id.slice(0,8).toUpperCase()} · Προτεινόμενη χρέωση €{request.proposed_charge.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-blue-100/70">Έλλειμμα {request.fuel_liters.toFixed(1)} λίτρα · Αίτημα {new Date(request.requested_at).toLocaleString('el-GR')}</p>
                  <p className="mt-2 text-sm text-amber-100">Αιτιολογία: {request.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => {setReviewTarget(request);setReviewApprove(true);setReviewNote('');setReviewError('');}}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200">Έγκριση εξαίρεσης</button>
                    <button type="button" onClick={() => {setReviewTarget(request);setReviewApprove(false);setReviewNote('');setReviewError('');}}
                      className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200">Απόρριψη — Χρέωση €{request.proposed_charge.toFixed(2)}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>

      {/* Recent reservations and existing daily operations */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent-reservations-title" className="min-w-0 overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#1e4e7d]/70 px-6 py-4">
            <h3 id="recent-reservations-title" className="text-base font-semibold text-white">Πρόσφατες Κρατήσεις</h3>
            <p className="mt-1 text-xs text-blue-100/45">Οι 5 τελευταίες καταχωρίσεις</p>
          </div>
          {recentReservations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-blue-100/45">Δεν υπάρχουν κρατήσεις.</p>
          ) : (
            <div role="region" aria-label="Πίνακας πρόσφατων κρατήσεων" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400">
              <table className="w-full min-w-[520px] text-left text-xs">
                <caption className="sr-only">Οι πέντε πιο πρόσφατες κρατήσεις κατά ημερομηνία δημιουργίας</caption>
                <thead className="border-b border-[#1e4e7d]/50 bg-[#0b2949]/35 text-blue-100/55">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-medium">Πελάτης</th>
                    <th scope="col" className="px-3 py-3 font-medium">Όχημα</th>
                    <th scope="col" className="px-3 py-3 font-medium">Παραλαβή</th>
                    <th scope="col" className="px-3 py-3 font-medium">Επιστροφή</th>
                    <th scope="col" className="px-3 py-3 font-medium">Κατάσταση</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e4e7d]/40">
                  {recentReservations.map(reservation => {
                    const status = RESERVATION_STATUS[reservation.status] || { label: 'Άγνωστη', className: 'bg-slate-500/20 text-slate-200 ring-slate-400/25' };
                    return (
                      <tr key={reservation.id} className="transition-colors hover:bg-[#0b2949]/30">
                        <td className="px-3 py-3 align-top"><span className="block max-w-[140px] break-words font-medium text-white">{reservation.customer?.name || '—'}</span></td>
                        <td className="px-3 py-3 align-top">
                          <span className="block whitespace-nowrap font-medium text-blue-100/85">{reservation.vehicle?.plate || '—'}</span>
                          {reservation.vehicle && <span className="mt-0.5 block max-w-[120px] break-words text-blue-100/45">{reservation.vehicle.brand} {reservation.vehicle.model}</span>}
                        </td>
                        <td className="px-3 py-3 align-top"><ReservationDate value={reservation.pickup_date} /></td>
                        <td className="px-3 py-3 align-top"><ReservationDate value={reservation.return_date} /></td>
                        <td className="px-3 py-3 align-top"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${status.className}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Today\'s Pickups & Returns — compact right column */}
        <div className="grid min-w-0 grid-cols-1 gap-5">
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
      </div>

      {isAdmin && reviewTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={e => {if(e.target===e.currentTarget && !reviewSaving)setReviewTarget(null);}}>
          <section role="dialog" aria-modal="true" aria-labelledby="fuel-review-title"
            className="w-full max-w-lg rounded-2xl border border-amber-400/35 bg-[#0b2949] p-6 text-white shadow-2xl">
            <h2 id="fuel-review-title" className="text-lg font-semibold">{reviewApprove ? 'Έγκριση εξαίρεσης καυσίμου' : 'Απόρριψη εξαίρεσης καυσίμου'}</h2>
            <p className="mt-3 text-sm text-blue-100/80">Κράτηση #{reviewTarget.reservation_id.slice(0,8).toUpperCase()} · €{reviewTarget.proposed_charge.toFixed(2)}</p>
            <p className="mt-2 text-sm text-amber-100">{reviewApprove ? 'Δεν θα καταχωριστεί χρέωση καυσίμου.' : 'Θα καταχωριστεί η χρέωση καυσίμου στο ολοκληρωμένο Check-In και στην οφειλή του πελάτη.'}</p>
            <label className="mt-4 block text-sm text-blue-100/80">Αιτιολογία απόφασης (υποχρεωτική)
              <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} rows={3} disabled={reviewSaving}
                className="mt-2 w-full rounded-lg border border-[#2b5b85] bg-[#071d38] p-3 text-white" />
            </label>
            {reviewError && <p role="alert" className="mt-2 text-sm text-red-300">{reviewError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={reviewSaving} onClick={()=>setReviewTarget(null)}
                className="rounded-lg border border-[#2b5b85] px-4 py-2 text-sm">Ακύρωση</button>
              <button type="button" disabled={reviewSaving||reviewNote.trim().length<5} onClick={completeFuelReview}
                className="rounded-lg bg-[#1268f3] px-4 py-2 text-sm font-semibold disabled:opacity-40">
                {reviewSaving?'Αποθήκευση...':'Επιβεβαίωση απόφασης'}</button>
            </div>
          </section>
        </div>
      )}

      {/* Summary footer */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-3">
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Σύνολο Κρατήσεων</p>
            <p className="text-2xl font-bold tabular-nums text-white">{totalReservations}</p>
          </div>
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Κατάσταση Κρατήσεων</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <button type="button" onClick={() => onNavigateReservations?.('completed')} className="text-blue-100/80 hover:text-white">Ολοκληρωμένες: {statusCount('completed')}</button>
              <button type="button" onClick={() => onNavigateReservations?.('cancelled')} className="text-blue-100/80 hover:text-white">Ακυρωμένες: {statusCount('cancelled')}</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm text-blue-100/55">Οχήματα Στόλου</p>
            <p className="text-2xl font-bold tabular-nums text-white">{fleetStats.total}</p>
          </div>
        </div>
      </div>
      </>}
    </div>
  );
};

export default DashboardPage;
