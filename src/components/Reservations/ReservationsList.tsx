import React, { useState, useEffect, useCallback, useRef } from 'react';
import { reservationService, customerService, stationService, vehicleService, pricingService, resolveDailyRate, insuranceService, reservationExtrasService, photoService, checkoutService, checkinService, hasVehicleBookingConflict } from '../../lib/database';
import type { CheckoutDetails, CheckinDetails } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import {
  EyeIcon,
  TruckIcon,
  CheckIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  CurrencyEuroIcon
} from '@heroicons/react/24/outline';
import ContractGenerator, { type ContractGeneratorRef } from '../PDF/ContractGenerator';
import BookingConfirmation from '../PDF/BookingConfirmation';
import PaymentPanel from '../Payments/PaymentPanel';
import PageHero from '../Layout/PageHero';
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
  contract_issued_at?: string | null;
  booking_confirmation_issued_at?: string | null;
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
    photo_url?: string | null;
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
  finalPriceOverride: number | null;
  originalPickupDate: string;
  originalVehicleId: string;
  originalCategory: string;
  originalDailyRate: number;
}

interface ReservationsListProps {
  onCheckOut?: (reservationId: string) => void;
  onCheckIn?: (reservationId: string) => void;
  refreshTrigger?: number;
  initialFilter?: string;
  initialViewReservationId?: string | null;
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
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}


const ReservationsList: React.FC<ReservationsListProps> = ({ onCheckOut, onCheckIn, refreshTrigger, initialFilter, initialViewReservationId }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>(initialFilter || 'all');
  const [excelFilter, setExcelFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewReservation, setViewReservation] = useState<ReservationRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ReservationRow | null>(null);
  const [checkoutPhotoPaths, setCheckoutPhotoPaths] = useState<string[]>([]);
  const [checkinPhotoPaths, setCheckinPhotoPaths] = useState<string[]>([]);
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Map<string, string>>(new Map());
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetails | null>(null);
  const [checkinDetails, setCheckinDetails] = useState<CheckinDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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
  const [contractMode, setContractMode] = useState(false);
  const [contractGenReservation, setContractGenReservation] = useState<ReservationRow | null>(null);
  const contractGenRef = useRef<ContractGeneratorRef>(null);
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const [cardPhotoUrls, setCardPhotoUrls] = useState<Map<string, string>>(new Map());

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
    if (!initialViewReservationId) return;
    const match = reservations.find(r => r.id === initialViewReservationId);
    if (match) {
      setViewReservation(match);
    }
  }, [initialViewReservationId, reservations]);

  useEffect(() => {
    const paths = reservations
      .map((reservation) => reservation.vehicle?.photo_url)
      .filter((path): path is string => !!path);
    if (paths.length === 0) {
      setCardPhotoUrls(new Map());
      return;
    }

    let cancelled = false;
    photoService.getSignedUrls(paths, 3600).then((urls) => {
      if (!cancelled) setCardPhotoUrls(urls);
    }).catch((err) => {
      console.error('Failed to load reservation vehicle photos:', err);
      if (!cancelled) setCardPhotoUrls(new Map());
    });

    return () => { cancelled = true; };
  }, [reservations]);

  useEffect(() => {
    if (!contractGenReservation || !contractGenRef.current) return;
    const reservationId = contractGenReservation.id;
    const generator = contractGenRef.current;
    // Clear first to avoid duplicate generation on rerenders.
    setContractGenReservation(null);
    void (async () => {
      const generated = await generator.generate();
      if (!generated) {
        setActionError('Δεν δημιουργήθηκε το PDF συμβολαίου. Δεν καταγράφηκε έκδοση.');
        return;
      }
      try {
        await reservationService.update(reservationId, { contract_issued_at: new Date().toISOString() });
        await fetchReservations();
      } catch (err) {
        console.error('Failed to record contract issuance:', err);
        setActionError('Το PDF δημιουργήθηκε, αλλά δεν καταγράφηκε η έκδοση στη βάση.');
      }
    })();
  }, [contractGenReservation, fetchReservations]);

  useEffect(() => {
    if (!viewReservation) {
      setCheckoutPhotoPaths([]);
      setCheckinPhotoPaths([]);
      setPhotoSignedUrls(new Map());
      setCheckoutDetails(null);
      setCheckinDetails(null);
      return;
    }
    setPhotosLoading(true);
    setDetailsLoading(true);

    Promise.all([
      photoService.getPhotos('checkout', viewReservation.id),
      photoService.getPhotos('checkin', viewReservation.id),
      checkoutService.getByReservationId(viewReservation.id),
      checkinService.getByReservationId(viewReservation.id),
    ]).then(async ([coPaths, ciPaths, coDetails, ciDetails]) => {
      setCheckoutPhotoPaths(coPaths);
      setCheckinPhotoPaths(ciPaths);
      setCheckoutDetails(coDetails);
      setCheckinDetails(ciDetails);
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
      console.error('Failed to load photos/details:', err);
    }).finally(() => {
      setPhotosLoading(false);
      setDetailsLoading(false);
    });
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

  const openDeleteConfirm = (reservation: ReservationRow) => {
    setDeleteTarget(reservation);
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
    setActionError('');
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
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      setActionError('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      let greekMsg = 'Αποτυχία διαγραφής κράτησης.';
      if (errMsg.includes('DELETION_BLOCKED:status')) {
        greekMsg = 'Δεν είναι δυνατή η διαγραφή: μόνο επερχόμενες ή ακυρωμένες κρατήσεις μπορούν να διαγραφούν.';
      } else if (errMsg.includes('DELETION_BLOCKED:not_found')) {
        greekMsg = 'Η κράτηση δεν βρέθηκε.';
      } else if (errMsg.includes('DELETION_BLOCKED:checkouts')) {
        greekMsg = 'Δεν είναι δυνατή η διαγραφή: υπάρχουν εγγραφές Check-Out για αυτή την κράτηση.';
      } else if (errMsg.includes('DELETION_BLOCKED:checkins')) {
        greekMsg = 'Δεν είναι δυνατή η διαγραφή: υπάρχουν εγγραφές Check-In για αυτή την κράτηση.';
      } else if (errMsg.includes('DELETION_BLOCKED:payments')) {
        greekMsg = 'Δεν είναι δυνατή η διαγραφή: υπάρχουν πληρωμές για αυτή την κράτηση.';
      }
      setActionError(greekMsg);
      setDeleteConfirmOpen(false);
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
        finalPriceOverride: null,
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
    setContractMode(false);
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

      const calculatedTotal = (dailyRate * days) + (insuranceRate * days) + extrasTotal;
      const totalAmount = editForm.finalPriceOverride != null ? editForm.finalPriceOverride : calculatedTotal;

      // Overlap check: prevent double-booking when editing
      if (editForm.vehicleId) {
        const startISO = `${editForm.pickupDate}T${editForm.pickupTime || '00:00'}:00`;
        const endISO = `${editForm.returnDate}T${editForm.returnTime || '00:00'}:00`;
        const allReservations = await reservationService.getAll();
        const conflict = hasVehicleBookingConflict(editForm.vehicleId, startISO, endISO, allReservations, viewReservation.id);
        if (conflict) {
          setSaveError('Το όχημα έχει άλλη κράτηση για αυτές τις ημερομηνίες και ώρες.');
          setSaving(false);
          return;
        }
      }

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
      if (contractMode) {
        const allRes = await reservationService.getAll();
        const fresh = (allRes as ReservationRow[]).find(r => r.id === viewReservation.id);
        if (fresh) {
          setContractGenReservation(fresh);
        }
        setContractMode(false);
      }
    } catch (err) {
      console.error('Save failed:', err);
      const bookingConflict = (err as { code?: string; message?: string })?.code === '23P01'
        || (err instanceof Error && err.message.includes('reservations_no_vehicle_time_overlap'));
      setSaveError(bookingConflict
        ? 'Το όχημα έχει ήδη κράτηση για αυτές τις ημερομηνίες και ώρες.'
        : 'Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.');
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

  // A missed pickup remains 'upcoming' in the database until the real checkout/cancellation.
  const isOverduePickup = (reservation: ReservationRow): boolean => {
    if (reservation.status !== 'upcoming' || !reservation.pickup_date) return false;
    const pickup = new Date(reservation.pickup_date.replace(' ', 'T'));
    return !Number.isNaN(pickup.getTime()) && pickup.getTime() < Date.now();
  };

  const isOverdueReturn = (reservation: ReservationRow): boolean => {
    if (reservation.status !== 'active' || !reservation.return_date) return false;
    const returned = new Date(reservation.return_date.replace(' ', 'T'));
    return !Number.isNaN(returned.getTime()) && returned.getTime() < Date.now();
  };

  const getDisplayStatus = (reservation: ReservationRow) => {
    if (isOverduePickup(reservation)) return 'Εκκρεμεί Check-Out';
    if (isOverdueReturn(reservation)) return 'Εκκρεμεί Check-In';
    return getStatusLabel(reservation.status);
  };

  const overduePickupsCount = reservations.filter(isOverduePickup).length;
  const overdueReturnsCount = reservations.filter(isOverdueReturn).length;

  const filteredReservations = reservations.filter(reservation => {
    if (filter === 'overdue' || filter === 'overdue_pickup') {
      if (!isOverduePickup(reservation)) return false;
    } else if (filter === 'overdue_return') {
      if (!isOverdueReturn(reservation)) return false;
    } else if (filter === 'upcoming') {
      if (reservation.status !== 'upcoming' || isOverduePickup(reservation)) return false;
    } else if (filter === 'active') {
      if (reservation.status !== 'active' || isOverdueReturn(reservation)) return false;
    } else if (filter !== 'all' && reservation.status !== filter) return false;
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
    return `${d}/${m}/${y}\u00A0${time}`;
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
      <PageHero
        eyebrow="Reservation desk"
        title="Κρατήσεις"
        subtitle="Διαχείριση κρατήσεων ανά σταθμό και ημερομηνία"
      />

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
              <option value="overdue_pickup">Εκπρόθεσμες παραλαβές ({overduePickupsCount})</option>
              <option value="overdue_return">Εκπρόθεσμες επιστροφές ({overdueReturnsCount})</option>
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
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#2b5b85]/60 pt-4">
          <button type="button" onClick={() => { setFilter('overdue_pickup'); setDateFilter(''); }}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${filter === 'overdue_pickup' || filter === 'overdue' ? 'border-amber-400/70 bg-amber-500/20 text-amber-100' : 'border-[#2b5b85]/80 bg-[#0b2949]/75 text-blue-100/85 hover:border-amber-400/50'}`}>
            Εκπρόθεσμες παραλαβές ({overduePickupsCount})
          </button>
          <button type="button" onClick={() => { setFilter('overdue_return'); setDateFilter(''); }}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${filter === 'overdue_return' ? 'border-amber-400/70 bg-amber-500/20 text-amber-100' : 'border-[#2b5b85]/80 bg-[#0b2949]/75 text-blue-100/85 hover:border-amber-400/50'}`}>
            Εκπρόθεσμες επιστροφές ({overdueReturnsCount})
          </button>
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
          <div
            key={reservation.id}
            role="button"
            tabIndex={0}
            onClick={() => setViewReservation(reservation)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setViewReservation(reservation);
              }
            }}
            className="cursor-pointer overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55a8ff]/60"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
                    {reservation.customer?.name || 'Άγνωστος πελάτης'}
                  </h3>
                  <p className="text-xs text-blue-100/45 font-mono">Κράτηση #{reservation.id.substring(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-blue-100/65">{reservation.customer?.phone || '-'}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      reservation.excel_updated
                        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40'
                        : 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/50'
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleExcelToggle(reservation.id, !!reservation.excel_updated); }}
                  >
                    <span className={`mr-1.5 h-2.5 w-2.5 rounded-full ${reservation.excel_updated ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                    {reservation.excel_updated ? 'Excel ενημερώθηκε' : 'Excel εκκρεμεί'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isOverduePickup(reservation) || isOverdueReturn(reservation) ? 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/50' : getStatusColor(reservation.status)}`}>
                    {getDisplayStatus(reservation)}
                  </span>
                  <button
                    onClick={() => setViewReservation(reservation)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    aria-label="Προβολή"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setActionsMenuId(actionsMenuId === reservation.id ? null : reservation.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                      aria-label="Περισσότερες ενέργειες"
                    >
                      <EllipsisHorizontalIcon className="h-5 w-5" />
                    </button>
                    {actionsMenuId === reservation.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setActionsMenuId(null)} />
                        <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-[#1e4e7d]/80 bg-[#0b2949] shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
                          {reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
                            <button
                              className="flex w-full items-center px-3 py-2.5 text-left text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
                              onClick={() => { setActionsMenuId(null); handleStatusChange(reservation.id, 'cancelled'); }}
                              disabled={changingStatus === reservation.id}
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              {changingStatus === reservation.id ? '...' : 'Ακύρωση Κράτησης'}
                            </button>
                          )}
                          {isAdmin && (reservation.status === 'upcoming' || reservation.status === 'cancelled') && (
                            <button
                              className="flex w-full items-center px-3 py-2.5 text-left text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
                              onClick={() => { setActionsMenuId(null); openDeleteConfirm(reservation); }}
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Διαγραφή Κράτησης
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-4 border-b border-[#1e4e7d]/70 pb-4 sm:flex-row sm:items-center">
                <div className="relative flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2b5b85]/60 bg-[#061a31] sm:h-24 sm:w-40">
                  <TruckIcon className="h-12 w-12 text-[#2b5b85]/70" />
                  {reservation.vehicle?.photo_url && cardPhotoUrls.get(reservation.vehicle.photo_url) && (
                    <img
                      src={cardPhotoUrls.get(reservation.vehicle.photo_url)}
                      alt={`${reservation.vehicle.brand} ${reservation.vehicle.model}`}
                      className="absolute inset-0 h-full w-full object-contain p-2"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/50">Όχημα</p>
                  <p className="break-words text-lg font-semibold tracking-[-0.02em] text-white">
                    {reservation.vehicle ? `${reservation.vehicle.brand} ${reservation.vehicle.model}` : 'Όχημα μη διαθέσιμο'}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-blue-100/65">{reservation.vehicle?.plate || '-'}</p>
                </div>
                <div className="shrink-0 sm:min-w-20">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/50">Κατηγορία</p>
                  <span className="inline-flex min-w-10 items-center justify-center rounded-lg border border-[#3475aa] bg-[#0b2949] px-2.5 py-1.5 text-base font-semibold text-blue-50">
                    {reservation.vehicle?.category || reservation.category}
                  </span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 divide-y divide-[#1e4e7d]/70 rounded-xl border border-[#1e4e7d]/70 bg-[#061a31]/45 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">
                    <CalendarDaysIcon className="h-4 w-4 text-[#72b9ff]" />
                    Παραλαβή
                  </div>
                  <p className="whitespace-nowrap text-[11px] font-semibold text-white">{formatDateStr(reservation.pickup_date)}</p>
                  <p className="mt-0.5 truncate text-xs text-blue-100/60">{reservation.pickup_station?.name || '-'}</p>
                </div>
                <div className="p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">
                    <CalendarDaysIcon className="h-4 w-4 text-[#72b9ff]" />
                    Επιστροφή
                  </div>
                  <p className="whitespace-nowrap text-[11px] font-semibold text-white">{formatDateStr(reservation.return_date)}</p>
                  <p className="mt-0.5 truncate text-xs text-blue-100/60">{reservation.return_station?.name || '-'}</p>
                </div>
                <div className="p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-blue-100/50">
                    <CurrencyEuroIcon className="h-4 w-4 text-[#72b9ff]" />
                    Σύνολο
                  </div>
                  <p className="text-xl font-bold text-emerald-300">{'\u20AC'}{Number(reservation.total_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              {(reservation.status === 'upcoming' || reservation.status === 'active') && (
                <div className="flex items-stretch gap-2 border-t border-[#1e4e7d]/70 pt-4" onClick={(e) => e.stopPropagation()}>
                  {reservation.status === 'upcoming' && (
                    <>
                      <BookingConfirmation
                        compact
                        issuedAt={reservation.booking_confirmation_issued_at}
                        onIssued={(issuedAt) => setReservations(prev => prev.map(r =>
                          r.id === reservation.id ? { ...r, booking_confirmation_issued_at: issuedAt } : r
                        ))}
                        onError={setActionError}
                        data={{
                          reservationId: reservation.id,
                          customerName: reservation.customer?.name || '-',
                          customerPhone: reservation.customer?.phone || '-',
                          vehicleLabel: reservation.vehicle
                            ? `${reservation.vehicle.brand} ${reservation.vehicle.model} (${reservation.vehicle.plate})`
                            : `Κατηγορία ${reservation.category}`,
                          vehicleCategory: reservation.vehicle?.category || reservation.category,
                          pickupDate: reservation.pickup_date,
                          returnDate: reservation.return_date,
                          pickupStation: reservation.pickup_station?.name || '-',
                          returnStation: reservation.return_station?.name || '-',
                          totalAmount: Number(reservation.total_amount) || 0,
                        }}
                      />
                      <button
                        onClick={() => {
                        setViewReservation(reservation);
                        setContractMode(true);
                        startEditing(reservation);
                      }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-600/20 px-2 py-2.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30 sm:text-sm"
                      >
                        <DocumentTextIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{reservation.contract_issued_at ? 'Συμβόλαιο Εκδόθηκε ✓' : 'Έκδοση Συμβολαίου'}</span>
                      </button>
                      <button
                        onClick={() => onCheckOut?.(reservation.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-[#1268f3] px-2 py-2.5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] sm:text-sm"
                      >
                        <TruckIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">Check-Out</span>
                      </button>
                    </>
                  )}
                  {reservation.status === 'active' && (
                    <button
                      onClick={() => handleCheckInClick(reservation)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition-colors hover:bg-emerald-500"
                    >
                      <CheckIcon className="h-4 w-4 shrink-0" />
                      <span>Check-In</span>
                    </button>
                  )}
                </div>
              )}
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
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isOverduePickup(viewReservation) || isOverdueReturn(viewReservation) ? 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/50' : getStatusColor(viewReservation.status)}`}>
                        {getDisplayStatus(viewReservation)}
                      </span>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-blue-100/65">Αλλαγή κατάστασης:</label>
                        <select
                          value={viewReservation.status}
                          onChange={(e) => handleStatusChange(viewReservation.id, e.target.value)}
                          disabled={changingStatus === viewReservation.id}
                          className="border border-[#2b5b85]/80 rounded-lg px-2 py-1 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                        <div className="flex justify-between text-sm font-medium border-t border-[#1e4e7d]/60 pt-2">
                          <span className="text-blue-100/65">Τιμή κράτησης</span>
                          <span className="text-white">{'\u20AC'}{Number(viewReservation.total_amount || 0).toFixed(2)}</span>
                        </div>
                        {(() => {
                          const charges = checkinDetails?.additional_charges || [];
                          const chargesTotal = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
                          if (charges.length === 0) return null;
                          return (
                            <>
                              {charges.map((c, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-blue-100/65">{c.type}{c.description ? ` — ${c.description}` : ''}</span>
                                  <span className="text-red-300">{'\u20AC'}{Number(c.amount).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm font-medium border-t border-[#1e4e7d]/60 pt-2">
                                <span className="text-blue-100/65">Επιπλέον χρεώσεις</span>
                                <span className="text-red-300">{'\u20AC'}{chargesTotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold border-t border-[#1e4e7d]/60 pt-2">
                                <span>Τελικό Σύνολο</span>
                                <span className="text-emerald-300">{'\u20AC'}{(Number(viewReservation.total_amount || 0) + chargesTotal).toFixed(2)}</span>
                              </div>
                            </>
                          );
                        })()}
                        {(!checkinDetails || (checkinDetails.additional_charges || []).length === 0) && (
                          <div className="flex justify-between text-sm font-bold border-t border-[#1e4e7d]/60 pt-2">
                            <span>Σύνολο</span>
                            <span className="text-emerald-300">{'\u20AC'}{Number(viewReservation.total_amount || 0).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <PaymentPanel
                      reservationId={viewReservation.id}
                      totalAmount={Number(viewReservation.total_amount) || 0}
                    />

                    {/* Checkout & Checkin Details */}
                    {(checkoutDetails || checkinDetails) && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Στοιχεία Παράδοσης / Επιστροφής</h3>
                        <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-4">
                          {detailsLoading && (
                            <p className="text-sm text-blue-100/45">Φόρτωση...</p>
                          )}
                          {checkoutDetails && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-blue-100/55 uppercase tracking-wide">Check-out</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-blue-100/65">Χιλιόμετρα:</span>{' '}
                                  <span className="text-white">{checkoutDetails.odometer.toLocaleString()} km</span>
                                </div>
                                <div>
                                  <span className="text-blue-100/65">Καύσιμο:</span>{' '}
                                  <span className="text-white">{checkoutDetails.fuel_level}%</span>
                                </div>
                              </div>
                              {checkoutDetails.accessories_given.length > 0 && (
                                <div className="text-sm">
                                  <span className="text-blue-100/65">Αξεσουάρ:</span>{' '}
                                  <span className="text-white">{checkoutDetails.accessories_given.join(', ')}</span>
                                </div>
                              )}
                              {checkoutDetails.damages.length > 0 && (
                                <div className="text-sm space-y-1">
                                  <span className="text-blue-100/65">Υπάρχουσες ζημιές:</span>
                                  {checkoutDetails.damages.map((d) => (
                                    <div key={d.id} className="pl-3 text-blue-50">
                                      — {d.description}
                                      {d.estimated_cost != null && (
                                        <span className="text-red-300 ml-2">{'\u20AC'}{Number(d.estimated_cost).toFixed(2)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {checkinDetails && (
                            <div className="space-y-2 border-t border-[#1e4e7d]/60 pt-3">
                              <p className="text-xs font-semibold text-blue-100/55 uppercase tracking-wide">Check-in</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-blue-100/65">Χιλιόμετρα:</span>{' '}
                                  <span className="text-white">{checkinDetails.odometer.toLocaleString()} km</span>
                                </div>
                                <div>
                                  <span className="text-blue-100/65">Καύσιμο:</span>{' '}
                                  <span className="text-white">{checkinDetails.fuel_level}%</span>
                                </div>
                              </div>
                              {checkinDetails.new_damages.length > 0 && (
                                <div className="text-sm space-y-1">
                                  <span className="text-blue-100/65">Νέες ζημιές:</span>
                                  {checkinDetails.new_damages.map((d) => (
                                    <div key={d.id} className="pl-3 text-blue-50">
                                      — {d.description}
                                      {d.estimated_cost != null && (
                                        <span className="text-red-300 ml-2">{'\u20AC'}{Number(d.estimated_cost).toFixed(2)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Τηλέφωνο</label>
                              <input
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Email</label>
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Χώρα</label>
                              <input
                                type="text"
                                value={editForm.country}
                                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Αρ. Άδειας</label>
                              <input
                                type="text"
                                value={editForm.licenseNumber}
                                onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ημ. Γέννησης</label>
                              <input
                                type="date"
                                value={editForm.birthDate}
                                onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ώρα Παραλαβής</label>
                              <input
                                type="time"
                                value={editForm.pickupTime}
                                onChange={(e) => setEditForm({ ...editForm, pickupTime: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ημ. Παράδοσης</label>
                              <input
                                type="date"
                                value={editForm.returnDate}
                                onChange={(e) => setEditForm({ ...editForm, returnDate: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Ώρα Παράδοσης</label>
                              <input
                                type="time"
                                value={editForm.returnTime}
                                onChange={(e) => setEditForm({ ...editForm, returnTime: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-blue-100/55 mb-1">Σταθμός Παραλαβής</label>
                              <select
                                value={editForm.pickupStationId}
                                onChange={(e) => setEditForm({ ...editForm, pickupStationId: e.target.value })}
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                                className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                            className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                              <div className="mt-3 rounded-lg border border-[#2b5b85]/80 bg-[#0b2949]/60 p-3">
                                <label className="block text-xs text-blue-100/55 mb-1">Τελική Συμφωνημένη Τιμή (€)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm.finalPriceOverride != null ? editForm.finalPriceOverride : grandTotal}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setEditForm({ ...editForm, finalPriceOverride: Number.isFinite(val) ? val : null });
                                  }}
                                  className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#0b2949] px-3 py-2 text-sm font-semibold text-white text-right focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                                />
                                {editForm.finalPriceOverride != null && Math.abs(editForm.finalPriceOverride - grandTotal) > 0.001 && (
                                  <p className="text-xs text-amber-300 mt-1">
                                    Διαφορά από αυτόματο: {'\u20AC'}{(editForm.finalPriceOverride - grandTotal).toFixed(2)}
                                  </p>
                                )}
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
                            className="w-full border border-[#2b5b85]/80 rounded-lg px-3 py-2 text-sm text-white bg-[#0b2949] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                      <button
                        onClick={() => startEditing(viewReservation)}
                        className="inline-flex items-center px-4 py-2 border border-[#3475aa] text-sm font-medium rounded-lg text-[#8ec7ff] bg-[#071d38] hover:bg-blue-500/15 transition-colors"
                      >
                        <PencilSquareIcon className="h-4 w-4 mr-2" />
                        Επεξεργασία
                      </button>
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
                      {saving ? 'Αποθήκευση...' : (contractMode ? 'Αποθήκευση & Έκδοση Συμβολαίου' : 'Αποθήκευση')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020b18]/90">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-red-400/30 bg-[#0b2949] shadow-[0_18px_45px_rgba(0,0,0,0.35)] p-6">
            <div className="flex items-center mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 border border-red-400/30">
                <TrashIcon className="h-5 w-5 text-red-300" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Οριστική Διαγραφή Κράτησης</h3>
            </div>
            <p className="text-sm text-blue-100/80 mb-2">
              Προσοχή: αυτή η ενέργεια είναι <span className="text-red-300 font-medium">μη αναστρέψιμη</span>.
              Όλα τα δεδομένα της κράτησης θα διαγραφούν μόνιμα, συμπεριλαμβανομένων τυχόν φωτογραφιών.
            </p>
            <p className="text-sm text-blue-100/60 mb-4">
              Για επιβεβαίωση, πληκτρολογήστε τον κωδικό κράτησης:
              <span className="ml-1 font-mono text-[#8ec7ff] font-medium">{deleteTarget.id.substring(0, 8).toUpperCase()}</span>
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="Κωδικός κράτησης"
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#071d38]/90 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-400/40 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                  setActionError('');
                }}
                disabled={deleting === deleteTarget.id}
                className="px-4 py-2 border border-[#2b5b85]/80 text-sm font-medium rounded-lg text-blue-100/85 bg-[#071d38] hover:bg-[#0b2949]/70 transition-colors"
              >
                Άκυρο
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={deleteConfirmText !== deleteTarget.id.substring(0, 8).toUpperCase() || deleting === deleteTarget.id}
                className="inline-flex items-center px-4 py-2 border border-red-400/50 text-sm font-medium rounded-lg text-red-100 bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {deleting === deleteTarget.id ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
            {actionError && (
              <p className="mt-3 text-sm text-red-300">{actionError}</p>
            )}
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

      {/* Hidden Contract Generator for programmatic PDF generation after save */}
      {contractGenReservation && (
        <div className="hidden">
          <ContractGenerator ref={contractGenRef} data={getContractData(contractGenReservation)} />
        </div>
      )}
    </div>
  );
};

export default ReservationsList;
