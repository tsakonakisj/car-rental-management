import React, { useState, useEffect, useCallback } from 'react';
import { reservationService, customerService, stationService, vehicleService, pricingService, resolveDailyRate, insuranceService, reservationExtrasService, photoService } from '../../lib/database';
import {
  EyeIcon,
  TruckIcon,
  CheckIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import ContractGenerator from '../PDF/ContractGenerator';
import type { Station, Vehicle, Pricing, Season, Reservation, Insurance, Extra } from '../../types';

interface ReservationRow {
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
  excel_updated?: boolean;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    country?: string;
    license_number?: string;
    birth_date?: string;
  } | null;
  vehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
    category: string;
  } | null;
  pickup_station: {
    name: string;
    name_en: string;
  } | null;
  return_station: {
    name: string;
    name_en: string;
  } | null;
}

interface EditFormData {
  customerName: string;
  phone: string;
  email: string;
  country: string;
  licenseNumber: string;
  birthDate: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  pickupStationId: string;
  returnStationId: string;
  insuranceType: string;
  insuranceId: string;
  insuranceRate: number;
  vehicleId: string;
  dailyRate: number;
  category: string;
  notes: string;
  extras: { [extraId: string]: number };
  originalPickupDate: string;
  originalVehicleId: string;
  originalCategory: string;
  originalDailyRate: number;
}

interface ReservationsListProps {
  onCheckOut?: (reservationId: string) => void;
  onCheckIn?: (reservationId: string) => void;
  refreshTrigger?: number;
}

const statusOptions: { value: string; labelEl: string }[] = [
  { value: 'upcoming', labelEl: 'Επερχόμενη' },
  { value: 'active', labelEl: 'Ενεργή' },
  { value: 'completed', labelEl: 'Ολοκληρωμένη' },
  { value: 'cancelled', labelEl: 'Ακυρωμένη' }
];

function splitDateTime(isoStr: string): { date: string; time: string } {
  if (!isoStr) return { date: '', time: '09:00' };
  const [datePart, timePart] = isoStr.split('T');
  const date = datePart || '';
  const time = timePart ? timePart.substring(0, 5) : '09:00';
  return { date, time };
}

function calcDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((e - s) / 86400000));
}


const ReservationsList: React.FC<ReservationsListProps> = ({ onCheckOut, onCheckIn, refreshTrigger }) => {
  const loginBackgroundImage = '/assets/login_background_car_left.jpg';
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [excelFilter, setExcelFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewReservation, setViewReservation] = useState<ReservationRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [checkoutPhotoPaths, setCheckoutPhotoPaths] = useState<string[]>([]);
  const [checkinPhotoPaths, setCheckinPhotoPaths] = useState<string[]>([]);
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Map<string, string>>(new Map());
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [editVehicles, setEditVehicles] = useState<Vehicle[]>([]);
  const [editPricing, setEditPricing] = useState<Pricing[]>([]);
  const [editSeasons, setEditSeasons] = useState<Season[]>([]);
  const [editInsurances, setEditInsurances] = useState<Insurance[]>([]);
  const [editExtras, setEditExtras] = useState<Extra[]>([]);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await reservationService.getAll();
      setReservations((data as ReservationRow[]) || []);
    } catch (err) {
      console.error('Failed to load reservations:', err);
      setError('Αποτυχία φόρτωσης κρατήσεων.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations, refreshTrigger]);

  useEffect(() => {
    stationService.getAll().then(setStations).catch(() => {});
  }, []);

  useEffect(() => {
    if (!viewReservation) {
      setCheckoutPhotoPaths([]);
      setCheckinPhotoPaths([]);
      setPhotoSignedUrls(new Map());
      return;
    }
    setPhotosLoading(true);
    Promise.all([
      photoService.getPhotos('checkout', viewReservation.id),
      photoService.getPhotos('checkin', viewReservation.id),
    ]).then(async ([coPaths, ciPaths]) => {
      setCheckoutPhotoPaths(coPaths);
      setCheckinPhotoPaths(ciPaths);
      const allPaths = [...coPaths, ...ciPaths];
      if (allPaths.length > 0) {
        try {
          const urls = await photoService.getSignedUrls(allPaths, 3600);
          setPhotoSignedUrls(urls);
        } catch (err) {
          console.error('Failed to load signed URLs:', err);
        }
      }
    }).catch((err) => {
      console.error('Failed to load photos:', err);
    }).finally(() => setPhotosLoading(false));
  }, [viewReservation]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setChangingStatus(id);
    setActionError('');
    try {
      await reservationService.update(id, { status: newStatus as ReservationRow['status'] });

      if (newStatus === 'cancelled') {
        const reservation = reservations.find(r => r.id === id);
        if (reservation?.vehicle_id) {
          await vehicleService.update(reservation.vehicle_id, { status: 'available' });
        }
      }

      setReservations(prev =>
        prev.map(r => (r.id === id ? { ...r, status: newStatus as ReservationRow['status'] } : r))
      );
      if (viewReservation?.id === id) {
        setViewReservation(prev => prev ? { ...prev, status: newStatus as ReservationRow['status'] } : null);
      }
    } catch (err) {
      console.error('Status change failed:', err);
      setActionError('Αποτυχία αλλαγής κατάστασης.');
    } finally {
      setChangingStatus(null);
    }
  };

  const handleCheckInClick = (reservation: ReservationRow) => {
    onCheckIn?.(reservation.id);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setActionError('');
    try {
      await reservationService.delete(id);
      setReservations(prev => prev.filter(r => r.id !== id));
      if (viewReservation?.id === id) {
        setViewReservation(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setActionError('Αποτυχία διαγραφής κράτησης.');
    } finally {
      setDeleting(null);
    }
  };

  const startEditing = async (reservation: ReservationRow) => {
    const pickup = splitDateTime(reservation.pickup_date);
    const ret = splitDateTime(reservation.return_date);
    try {
      const [v, p, s, ins, ext, existingExtras] = await Promise.all([
        vehicleService.getAll(),
        pricingService.getPricing(),
        pricingService.getSeasons(),
        insuranceService.getAll(),
        pricingService.getExtras(),
        reservationExtrasService.getByReservationId(reservation.id)
      ]);
      setEditVehicles(v);
      setEditPricing(p);
      setEditSeasons(s);
      setEditInsurances(ins);
      setEditExtras(ext);

      // Match current insurance to DB product by name
      const matchedIns = ins.find(i => i.name === reservation.insurance_type);
      const extrasMap: { [key: string]: number } = {};
      existingExtras.forEach(re => {
        extrasMap[re.extra_id] = re.quantity;
      });

      setEditForm({
        customerName: reservation.customer?.name || '',
        phone: reservation.customer?.phone || '',
        email: reservation.customer?.email || '',
        country: reservation.customer?.country || '',
        licenseNumber: reservation.customer?.license_number || '',
        birthDate: reservation.customer?.birth_date || '',
        pickupDate: pickup.date,
        pickupTime: pickup.time,
        returnDate: ret.date,
        returnTime: ret.time,
        pickupStationId: reservation.pickup_station_id || '',
        returnStationId: reservation.return_station_id || '',
        insuranceType: matchedIns ? matchedIns.name : (ins[0]?.name || ''),
        insuranceId: matchedIns ? matchedIns.id : (ins[0]?.id || ''),
        insuranceRate: matchedIns ? Number(matchedIns.daily_rate) : (ins[0] ? Number(ins[0].daily_rate) : 0),
        vehicleId: reservation.vehicle_id || '',
        dailyRate: reservation.daily_rate || 0,
        category: reservation.category || '',
        notes: reservation.notes || '',
        extras: extrasMap,
        originalPickupDate: pickup.date,
        originalVehicleId: reservation.vehicle_id || '',
        originalCategory: reservation.category || '',
        originalDailyRate: reservation.daily_rate || 0
      });
    } catch (err) {
      console.error('Failed to load edit data:', err);
    }
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm(null);
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!viewReservation || !editForm) return;
    setSaving(true);
    setSaveError('');
    try {
      // Update customer
      if (viewReservation.customer?.id) {
        await customerService.update(viewReservation.customer.id, {
          name: editForm.customerName,
          phone: editForm.phone,
          email: editForm.email,
          country: editForm.country,
          license_number: editForm.licenseNumber,
          birth_date: editForm.birthDate
        });
      }

      // Determine if pricing-relevant fields changed
      const pickupDateChanged = editForm.pickupDate !== editForm.originalPickupDate;
      const vehicleChanged = editForm.vehicleId !== editForm.originalVehicleId;
      const categoryChanged = editForm.category !== editForm.originalCategory;
      const needsRateRecalc = pickupDateChanged || vehicleChanged || categoryChanged;

      const days = calcDaysBetween(editForm.pickupDate, editForm.returnDate);

      // Only recalculate vehicle daily rate from pricing table when relevant fields changed
      let dailyRate: number;
      if (needsRateRecalc) {
        const { rate: resolvedRate } = resolveDailyRate(
          editForm.pickupDate || '',
          editForm.category || '',
          editSeasons,
          editPricing
        );
        if (resolvedRate <= 0) {
          setSaveError('Δεν έχει οριστεί τιμή για αυτή την κατηγορία και σεζόν. Ορίστε την τιμή στη σελίδα Τιμολόγηση.');
          setSaving(false);
          return;
        }
        dailyRate = resolvedRate;
      } else {
        dailyRate = editForm.originalDailyRate || 0;
      }

      const insuranceRate = editForm.insuranceRate || 0;

      // Calculate extras total from DB extras
      const extrasMap = new Map(editExtras.map(e => [e.id, e]));
      let extrasTotal = 0;
      Object.entries(editForm.extras || {}).forEach(([extraId, quantity]) => {
        const def = extrasMap.get(extraId);
        if (!def || !quantity) return;
        const price = Number(def.price) || 0;
        extrasTotal += def.type === 'daily'
          ? price * quantity * days
          : price * quantity;
      });

      const totalAmount = (dailyRate * days) + (insuranceRate * days) + extrasTotal;

      // Update reservation
      await reservationService.update(viewReservation.id, {
        pickup_date: `${editForm.pickupDate}T${editForm.pickupTime}:00`,
        return_date: `${editForm.returnDate}T${editForm.returnTime}:00`,
        pickup_station_id: editForm.pickupStationId,
        return_station_id: editForm.returnStationId,
        vehicle_id: editForm.vehicleId || undefined,
        category: editForm.category,
        daily_rate: dailyRate,
        insurance_type: editForm.insuranceType,
        insurance_rate: insuranceRate,
        total_amount: totalAmount,
        notes: editForm.notes
      });

      // Sync reservation_extras: delete old, insert new
      const extrasToSave: Array<{ extra_id: string; quantity: number; daily_rate: number }> = [];
      Object.entries(editForm.extras || {}).forEach(([extraId, quantity]) => {
        const def = extrasMap.get(extraId);
        if (!def || !quantity) return;
        extrasToSave.push({
          extra_id: extraId,
          quantity: quantity,
          daily_rate: Number(def.price) || 0
        });
      });
      await reservationExtrasService.replaceForReservation(viewReservation.id, extrasToSave);

      setEditing(false);
      setEditForm(null);
      setViewReservation(null);
      await fetchReservations();
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError('Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcelToggle = async (id: string, currentValue: boolean) => {
    const newValue = !currentValue;
    try {
      await reservationService.update(id, { excel_updated: newValue });
      setReservations(prev =>
        prev.map(r => (r.id === id ? { ...r, excel_updated: newValue } : r))
      );
      if (viewReservation?.id === id) {
        setViewReservation(prev => prev ? { ...prev, excel_updated: newValue } : null);
      }
    } catch {
      setActionError('Αποτυχία ενημέρωσης.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
      case 'active': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40';
      case 'completed': return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
      case 'cancelled': return 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40';
      default: return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
    }
  };

  const getStatusLabel = (status: string) => {
    const found = statusOptions.find(s => s.value === status);
    return found ? found.labelEl : status;
  };

  const filteredReservations = reservations.filter(reservation => {
    if (filter !== 'all' && reservation.status !== filter) return false;
    if (excelFilter === 'pending' && reservation.excel_updated !== false) return false;
    if (excelFilter === 'done' && reservation.excel_updated !== true) return false;
    if (dateFilter && !reservation.pickup_date.startsWith(dateFilter)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = reservation.customer?.name?.toLowerCase() || '';
      const phone = reservation.customer?.phone || '';
      const cat = reservation.category?.toLowerCase() || '';
      if (!name.includes(term) && !phone.includes(term) && !cat.includes(term)) return false;
    }
    return true;
  });

  const getContractData = (reservation: ReservationRow) => ({
    reservation: {
      id: reservation.id,
      customer: {
        name: reservation.customer?.name || '',
        phone: reservation.customer?.phone || '',
        email: reservation.customer?.email || '',
        country: reservation.customer?.country || '',
        license_number: reservation.customer?.license_number || '',
        birth_date: reservation.customer?.birth_date || ''
      },
      vehicle: {
        plate: reservation.vehicle?.plate || '',
        brand: reservation.vehicle?.brand || '',
        model: reservation.vehicle?.model || reservation.category,
        category: reservation.category
      },
      pickup_date: reservation.pickup_date,
      return_date: reservation.return_date,
      pickup_station: reservation.pickup_station?.name_en || reservation.pickup_station?.name || '',
      return_station: reservation.return_station?.name_en || reservation.return_station?.name || '',
      daily_rate: Number(reservation.daily_rate) || 0,
      insurance_type: reservation.insurance_type || 'basic',
      insurance_rate: Number(reservation.insurance_rate) || 0,
      total_amount: Number(reservation.total_amount) || 0,
      extras: []
    }
  });

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '-';
    const { date, time } = splitDateTime(dateStr);
    if (!date) return dateStr;
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y} ${time}`;
  };

  if (loading && reservations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-6 w-6 text-[#55a8ff] animate-spin mr-3" />
        <span className="text-blue-100/65">Φόρτωση κρατήσεων...</span>
      </div>
    );
  }

  if (error && reservations.length === 0) {
    return (
      <div className="text-center py-12">
        <XMarkIcon className="h-12 w-12 text-red-300 mx-auto mb-4" />
        <p className="text-red-100 mb-4">{error}</p>
        <button
          onClick={fetchReservations}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-[#1268f3] hover:bg-[#2478ff]"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Δοκιμή ξανά
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-blue-50">
      <div className="relative isolate overflow-hidden rounded-2xl border border-[#285b88]/70 bg-[#071d38] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <img src={loginBackgroundImage} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_58%]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,18,39,0.96)_0%,rgba(5,27,54,0.78)_44%,rgba(5,27,54,0.38)_100%)]" />
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6ab3ff]">Reservation desk</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Κρατήσεις</h1>
          <p className="mt-1 text-sm text-blue-100/75 sm:text-base">Διαχείριση κρατήσεων ανά σταθμό και ημερομηνία</p>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-400/30 bg-red-950/45 p-3 text-sm text-red-100 shadow-lg">
          {actionError}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/65">
              Αναζήτηση
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72b9ff]" />
              <input
                type="text"
                placeholder="Όνομα, τηλέφωνο, κατηγορία..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-blue-100/45 focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/65">
              Κατάσταση
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            >
              <option value="all">Όλες</option>
              {statusOptions.map(s => (
                <option key={s.value} value={s.value}>{s.labelEl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/65">
              Excel
            </label>
            <select
              value={excelFilter}
              onChange={(e) => setExcelFilter(e.target.value)}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            >
              <option value="all">Όλες</option>
              <option value="pending">Εκκρεμεί ενημέρωση</option>
              <option value="done">Ενημερώθηκε</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/65">
              Ημ. Παραλαβής
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilter('all'); setExcelFilter('all'); setDateFilter(''); setSearchTerm(''); }}
              className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm font-medium text-blue-100/75 transition-colors hover:border-[#4b8fc7] hover:bg-[#12375d] hover:text-white"
            >
              Καθαρισμός
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredReservations.length === 0 && (
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/85 py-14 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <CalendarDaysIcon className="h-12 w-12 text-blue-100/45 mx-auto mb-4" />
          <p className="text-blue-100/55">
            {reservations.length === 0
              ? 'Δεν υπάρχουν κρατήσεις ακόμα.'
              : 'Δεν βρέθηκαν κρατήσεις με τα επιλεγμένα φίλτρα.'}
          </p>
        </div>
      )}

      {/* Reservations Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filteredReservations.map((reservation) => (
          <div key={reservation.id} className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)]">
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
                    {reservation.customer?.name || 'Άγνωστος πελάτης'}
                  </h3>
                  <p className="text-sm text-blue-100/65">{reservation.customer?.phone || '-'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                      reservation.excel_updated
                        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40'
                        : 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40'
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleExcelToggle(reservation.id, !!reservation.excel_updated); }}
                  >
                    {reservation.excel_updated ? '\u{1F7E2} Excel ενημερώθηκε' : '\u{1F7E0} Excel εκκρεμεί'}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                    {getStatusLabel(reservation.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">Όχημα</p>
                  <p className="text-sm text-blue-50">
                    {reservation.vehicle
                      ? `${reservation.vehicle.plate} ${reservation.vehicle.brand} ${reservation.vehicle.model}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">Κατηγορία</p>
                  <p className="text-sm text-blue-50">{reservation.vehicle?.category || reservation.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">Σύνολο</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {'\u20AC'}{Number(reservation.total_amount || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">Παραλαβή</p>
                  <p className="text-sm text-blue-50">{formatDateStr(reservation.pickup_date)}</p>
                  <p className="text-xs text-blue-100/55">{reservation.pickup_station?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">Παράδοση</p>
                  <p className="text-sm text-blue-50">{formatDateStr(reservation.return_date)}</p>
                  <p className="text-xs text-blue-100/55">{reservation.return_station?.name || '-'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1e4e7d]/70 pt-4">
                <div className="flex flex-wrap space-x-2 gap-y-2">
                  <button
                    onClick={() => setViewReservation(reservation)}
                    className="inline-flex min-h-10 items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Προβολή
                  </button>
                  <ContractGenerator data={getContractData(reservation)} />
                  {reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
                    <button
                      className="inline-flex min-h-10 items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                      onClick={() => handleStatusChange(reservation.id, 'cancelled')}
                      disabled={changingStatus === reservation.id}
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      {changingStatus === reservation.id ? '...' : 'Ακύρωση'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap space-x-2 gap-y-2 justify-end">
                  {reservation.status === 'upcoming' && (() => {
                    const pickupTime = new Date(reservation.pickup_date).getTime();
                    const now = Date.now();
                    const canCheckOut = pickupTime <= now;
                    return canCheckOut ? (
                      <button
                        onClick={() => onCheckOut?.(reservation.id)}
                        className="inline-flex min-h-10 items-center rounded-xl border border-transparent bg-[#1268f3] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
                      >
                        <TruckIcon className="h-4 w-4 mr-1" />
                        Check-out
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 text-xs text-blue-100/55">
                        Checkout μετά την ώρα παραλαβής
                      </span>
                    );
                  })()}
                  {reservation.status === 'active' && (
                    <button
                      onClick={() => handleCheckInClick(reservation)}
                      className="inline-flex min-h-10 items-center rounded-xl border border-transparent bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition-colors hover:bg-emerald-500"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Check-in
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View/Edit Reservation Modal */}
      {viewReservation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-[#020b18]/80 backdrop-blur-sm transition-opacity" onClick={() => { setViewReservation(null); cancelEditing(); }} />
            <div className="relative bg-[#071d38] rounded-xl shadow-xl border border-[#1e4e7d]/70 max-w-2xl w-full mx-auto z-10">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#1e4e7d]/70 flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-medium text-white">
                  {editing ? 'Επεξεργασία Κράτησης' : 'Λεπτομέρειες Κράτησης'}
                </h2>
                <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                  {!editing && (
                    <button
                      onClick={() => startEditing(viewReservation)}
                      className="inline-flex items-center px-3 py-1.5 border border-[#3475aa] text-sm font-medium rounded-lg text-[#8ec7ff] bg-blue-500/15 hover:bg-blue-500/25 transition-colors"
                    >
                      <PencilSquareIcon className="h-4 w-4 mr-1.5" />
                      Επεξεργασία Κράτησης
                    </button>
                  )}
                  <button onClick={() => { setViewReservation(null); cancelEditing(); }} className="text-blue-100/45 hover:text-blue-100/65">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {!editing ? (
                  <>
                    {/* View Mode */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(viewReservation.status)}`}>
                        {getStatusLabel(viewReservation.status)}
                      </span>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-blue-100/65">Αλλαγή κατάστασης:</label>
                        <select
                          value={viewReservation.status}
                          onChange={(e) => handleStatusChange(viewReservation.id, e.target.value)}
                          disabled={changingStatus === viewReservation.id}
                          className="border border-[#2b5b85]/80 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        >
                          {statusOptions.map(s => (
                            <option key={s.value} value={s.value}>{s.labelEl}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Πελάτης</h3>
                      <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-1">
                        <p className="text-sm text-white font-medium">{viewReservation.customer?.name || '-'}</p>
                        <p className="text-sm text-blue-100/65">{viewReservation.customer?.phone || '-'}</p>
                        <p className="text-sm text-blue-100/65">{viewReservation.customer?.email || '-'}</p>
                        <p className="text-sm text-blue-100/65">{viewReservation.customer?.country || '-'}</p>
                        {viewReservation.customer?.license_number && (
                          <p className="text-sm text-blue-100/65">Άδεια: {viewReservation.customer.license_number}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Όχημα</h3>
                        <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-1">
                          <p className="text-sm text-white font-medium">
                            {viewReservation.vehicle
                              ? `${viewReservation.vehicle.brand} ${viewReservation.vehicle.model} (${viewReservation.vehicle.plate})`
                              : `Κατηγορία ${viewReservation.category}`}
                          </p>
                        </div>
                      </div>
                      <div className="sm:ml-4 mt-3 sm:mt-0 flex-shrink-0">
                        <label className="flex items-center cursor-pointer select-none bg-[#0b2949]/70 border border-[#1e4e7d]/70 rounded-lg px-3 py-3">
                          <input
                            type="checkbox"
                            checked={!!viewReservation.excel_updated}
                            onChange={() => handleExcelToggle(viewReservation.id, !!viewReservation.excel_updated)}
                            className="mr-2 rounded-md border-[#2b5b85]/80 bg-[#0b2949] text-[#55a8ff] focus:ring-[#2f8cff]/50"
                          />
                          <span className="text-sm text-blue-100/85 whitespace-nowrap">Excel ενημερώθηκε</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Παραλαβή</h3>
                        <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-1">
                          <p className="text-sm text-blue-50">{formatDateStr(viewReservation.pickup_date)}</p>
                          <p className="text-sm text-blue-100/65">{viewReservation.pickup_station?.name || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Παράδοση</h3>
                        <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-1">
                          <p className="text-sm text-blue-50">{formatDateStr(viewReservation.return_date)}</p>
                          <p className="text-sm text-blue-100/65">{viewReservation.return_station?.name || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Τιμολόγηση</h3>
                      <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-100/65">Ημερήσιο τέλος</span>
                          <span className="text-white">{'\u20AC'}{Number(viewReservation.daily_rate || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-100/65">Ασφάλεια ({viewReservation.insurance_type})</span>
                          <span className="text-white">{'\u20AC'}{Number(viewReservation.insurance_rate || 0).toFixed(2)}/ημέρα</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t pt-2">
                          <span>Σύνολο</span>
                          <span className="text-emerald-300">{'\u20AC'}{Number(viewReservation.total_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {viewReservation.notes && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Σημειώσεις</h3>
                        <div className="bg-[#0b2949]/70 rounded-lg p-4">
                          <p className="text-sm text-blue-100/85">{viewReservation.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Checkout Photos */}
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Φωτογραφίες Παράδοσης</h3>
                      {photosLoading ? (
                        <p className="text-sm text-blue-100/45">Φόρτωση φωτογραφιών...</p>
                      ) : checkoutPhotoPaths.length === 0 ? (
                        <p className="text-sm text-blue-100/45">Δεν υπάρχουν φωτογραφίες παράδοσης.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {checkoutPhotoPaths.map((path) => (
                            <img
                              key={path}
                              src={photoSignedUrls.get(path) || ''}
                              alt="Checkout"
                              onClick={() => setLightboxPhoto(photoSignedUrls.get(path) || '')}
                              className="w-full h-24 object-cover rounded-lg border border-[#1e4e7d]/70 cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checkin Photos */}
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Φωτογραφίες Επιστροφής</h3>
                      {photosLoading ? (
                        <p className="text-sm text-blue-100/45">Φόρτωση φωτογραφιών...</p>
                      ) : checkinPhotoPaths.length === 0 ? (
                        <p className="text-sm text-blue-100/45">Δεν υπάρχουν φωτογραφίες επιστροφής.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {checkinPhotoPaths.map((path) => (
                            <img
                              key={path}
                              src={photoSignedUrls.get(path) || ''}
                              alt="Checkin"
                              onClick={() => setLightboxPhoto(photoSignedUrls.get(path) || '')}
                              className="w-full h-24 object-cover rounded-lg border border-[#1e4e7d]/70 cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                  </>
                ) : (
                  <>
                    {/* Edit Mode */}
                    {editForm && (
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-sm font-medium text-blue-100/85 mb-3">Στοιχεία Πελάτη</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                              <input
                                type="text"
                                value={editForm.customerName}
                                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Τηλέφωνο</label>
                              <input
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Email</label>
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Χώρα</label>
                              <input
                                type="text"
                                value={editForm.country}
                                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Αρ. Άδειας</label>
                              <input
                                type="text"
                                value={editForm.licenseNumber}
                                onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ημ. Γέννησης</label>
                              <input
                                type="date"
                                value={editForm.birthDate}
                                onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-blue-100/85 mb-3">Ημερομηνίες & Σταθμοί</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ημ. Παραλαβής</label>
                              <input
                                type="date"
                                value={editForm.pickupDate}
                                onChange={(e) => setEditForm({ ...editForm, pickupDate: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ώρα Παραλαβής</label>
                              <input
                                type="time"
                                value={editForm.pickupTime}
                                onChange={(e) => setEditForm({ ...editForm, pickupTime: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ημ. Παράδοσης</label>
                              <input
                                type="date"
                                value={editForm.returnDate}
                                onChange={(e) => setEditForm({ ...editForm, returnDate: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ώρα Παράδοσης</label>
                              <input
                                type="time"
                                value={editForm.returnTime}
                                onChange={(e) => setEditForm({ ...editForm, returnTime: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Σταθμός Παραλαβής</label>
                              <select
                                value={editForm.pickupStationId}
                                onChange={(e) => setEditForm({ ...editForm, pickupStationId: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              >
                                <option value="">-- Επιλέξτε --</option>
                                {stations.map(st => (
                                  <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Σταθμός Παράδοσης</label>
                              <select
                                value={editForm.returnStationId}
                                onChange={(e) => setEditForm({ ...editForm, returnStationId: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              >
                                <option value="">-- Επιλέξτε --</option>
                                {stations.map(st => (
                                  <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-blue-100/85 mb-3">Όχημα</h3>
                          <select
                            value={editForm.vehicleId}
                            onChange={(e) => {
                              const selectedVehicle = editVehicles.find(v => v.id === e.target.value);
                              if (selectedVehicle) {
                                const { rate, season } = resolveDailyRate(
                                  editForm.pickupDate || '',
                                  selectedVehicle.category,
                                  editSeasons,
                                  editPricing
                                );
                                if (rate <= 0) {
                                  setSaveError(
                                    `Δεν έχει οριστεί τιμή για την κατηγορία ${selectedVehicle.category}${season ? ` (${season.name})` : ''}. `
                                  );
                                } else {
                                  setSaveError('');
                                }
                                setEditForm({
                                  ...editForm,
                                  vehicleId: selectedVehicle.id,
                                  category: selectedVehicle.category,
                                  dailyRate: rate
                                });
                              } else {
                                setEditForm({ ...editForm, vehicleId: '', category: '', dailyRate: 0 });
                              }
                            }}
                            className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                          >
                            <option value="">-- Επιλέξτε όχημα --</option>
                            {editVehicles.map(v => {
                              const isCurrentVehicle = v.id === viewReservation.vehicle_id;
                              const hasOverlap = !isCurrentVehicle && (() => {
                                if (!editForm.pickupDate || !editForm.returnDate) return false;
                                const newStart = new Date(editForm.pickupDate).getTime();
                                const newEnd = new Date(editForm.returnDate).getTime();
                                return reservations.some(r => {
                                  if (r.vehicle_id !== v.id) return false;
                                  if (r.id === viewReservation.id) return false;
                                  if (r.status !== 'upcoming' && r.status !== 'active') return false;
                                  const rStart = new Date(r.pickup_date).getTime();
                                  const rEnd = new Date(r.return_date).getTime();
                                  return newStart < rEnd && newEnd > rStart;
                                });
                              })();
                              const isUnavailable = (v.status !== 'available' && !isCurrentVehicle) || hasOverlap;
                              const { rate: vRate } = resolveDailyRate(
                                editForm.pickupDate || '',
                                v.category,
                                editSeasons,
                                editPricing
                              );
                              return (
                                <option key={v.id} value={v.id} disabled={isUnavailable}>
                                  {v.plate} - {v.brand} {v.model} ({v.category}) - {vRate > 0 ? `\u20AC${vRate}/\u03b7\u03bc.` : '\u0391\u03c0\u03cc\u03c1\u03b9\u03c3\u03c4\u03b7 \u03c4\u03b9\u03bc\u03ae'}{isUnavailable ? ' [\u039c\u03b7 \u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03bf]' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-blue-100/85 mb-3">Ασφάλεια</h3>
                          {editInsurances.length === 0 ? (
                            <p className="text-sm text-blue-100/55">Φόρτωση ασφαλίσεων...</p>
                          ) : (
                            <div className="space-y-2">
                              {editInsurances.map(ins => (
                                <label key={ins.id} className="flex items-center cursor-pointer">
                                  <input
                                    type="radio"
                                    name="editInsurance"
                                    checked={editForm.insuranceId === ins.id}
                                    onChange={() => setEditForm({
                                      ...editForm,
                                      insuranceType: ins.name,
                                      insuranceId: ins.id,
                                      insuranceRate: Number(ins.daily_rate) || 0
                                    })}
                                    className="mr-2"
                                  />
                                  <span className="flex-1 text-sm">{ins.name}</span>
                                  <span className="text-sm text-blue-100/65">
                                    {'\u20AC'}{Number(ins.daily_rate).toFixed(2)}/{'\u03b7\u03bc.'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-blue-100/85 mb-3">Έξτρα</h3>
                          {editExtras.length === 0 ? (
                            <p className="text-sm text-blue-100/55">Φόρτωση έξτρα...</p>
                          ) : (
                            editExtras.map(extra => (
                              <div key={extra.id} className="flex items-center justify-between mb-2">
                                <span className="text-sm">{extra.name}</span>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={editForm.extras?.[extra.id] || 0}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 0;
                                      const next = { ...editForm.extras };
                                      if (qty <= 0) {
                                        delete next[extra.id];
                                      } else {
                                        next[extra.id] = qty;
                                      }
                                      setEditForm({ ...editForm, extras: next });
                                    }}
                                    className="w-16 border border-[#2b5b85]/80 rounded-md px-2 py-1 text-sm"
                                  />
                                  <span className="text-sm text-blue-100/65">
                                    {'\u20AC'}{Number(extra.price).toFixed(2)}/{extra.type === 'daily' ? '\u03b7\u03bc.' : '\u03b5\u03c6\u03ac\u03c0\u03b1\u03be'}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Pricing summary */}
                        {(() => {
                          const days = calcDaysBetween(editForm.pickupDate, editForm.returnDate);
                          const dailyRate = editForm.dailyRate || 0;
                          const insuranceRate = editForm.insuranceRate || 0;
                          const dailyTotal = dailyRate * days;
                          const insuranceTotal = insuranceRate * days;

                          const extrasMap = new Map(editExtras.map(e => [e.id, e]));
                          let extrasTotal = 0;
                          Object.entries(editForm.extras || {}).forEach(([extraId, quantity]) => {
                            const def = extrasMap.get(extraId);
                            if (!def || !quantity) return;
                            const price = Number(def.price) || 0;
                            extrasTotal += def.type === 'daily'
                              ? price * quantity * days
                              : price * quantity;
                          });

                          const grandTotal = dailyTotal + insuranceTotal + extrasTotal;
                          return (
                            <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-2">
                              <h3 className="text-sm font-medium text-blue-100/85 mb-2">Κοστολόγηση</h3>
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-100/65">Ημέρες</span>
                                <span className="text-white">{days}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-100/65">Ημερήσιο ({'\u20AC'}{dailyRate.toFixed(2)} x {days})</span>
                                <span className="text-white">{'\u20AC'}{dailyTotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-100/65">Ασφάλεια ({'\u20AC'}{insuranceRate.toFixed(2)} x {days})</span>
                                <span className="text-white">{'\u20AC'}{insuranceTotal.toFixed(2)}</span>
                              </div>
                              {extrasTotal > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-blue-100/65">Έξτρα</span>
                                  <span className="text-white">{'\u20AC'}{extrasTotal.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm font-bold border-t pt-2">
                                <span>Σύνολο</span>
                                <span className="text-emerald-300">{'\u20AC'}{grandTotal.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div>
                          <label className="block text-xs text-blue-100/55 mb-1">Σημειώσεις</label>
                          <textarea
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            rows={3}
                            className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                          />
                        </div>

                        {saveError && (
                          <div className="p-3 bg-red-950/45 border border-red-400/30 rounded-lg text-sm text-red-100">
                            {saveError}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-[#1e4e7d]/70 flex flex-wrap justify-between gap-2">
                {!editing ? (
                  <>
                    <div className="flex flex-wrap space-x-2 gap-y-2">
                      <ContractGenerator data={getContractData(viewReservation)} />
                      <button
                        onClick={() => startEditing(viewReservation)}
                        className="inline-flex items-center px-4 py-2 border border-[#3475aa] text-sm font-medium rounded-lg text-[#8ec7ff] bg-[#071d38] hover:bg-blue-500/15 transition-colors"
                      >
                        <PencilSquareIcon className="h-4 w-4 mr-2" />
                        Επεξεργασία
                      </button>
                      {viewReservation.status !== 'cancelled' && viewReservation.status !== 'completed' && (
                        <button
                          onClick={() => {
                            if (window.confirm('Θέλετε σίγουρα να ακυρώσετε αυτή την κράτηση;')) {
                              handleDelete(viewReservation.id);
                            }
                          }}
                          disabled={deleting === viewReservation.id}
                          className="inline-flex items-center px-4 py-2 border border-red-400/50 text-sm font-medium rounded-lg text-red-100 bg-[#071d38] hover:bg-red-900/60 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          {deleting === viewReservation.id ? 'Διαγραφή...' : 'Διαγραφή'}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setViewReservation(null)}
                      className="px-4 py-2 border border-[#2b5b85]/80 text-sm font-medium rounded-lg text-blue-100/85 bg-[#071d38] hover:bg-[#0b2949]/70"
                    >
                      Κλείσιμο
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="px-4 py-2 border border-[#2b5b85]/80 text-sm font-medium rounded-lg text-blue-100/85 bg-[#071d38] hover:bg-[#0b2949]/70"
                    >
                      Ακύρωση
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-[#1268f3] hover:bg-[#2478ff] disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020b18]/90"
          onClick={() => setLightboxPhoto(null)}
        >
          <img
            src={lightboxPhoto}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-blue-100/60"
          >
            <XMarkIcon className="h-8 w-8" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ReservationsList;
