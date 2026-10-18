import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { vehicleService, photoService } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Vehicle } from '../../types';
import PageHero from '../Layout/PageHero';
import {
  TruckIcon,
  PlusIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  NoSymbolIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import VehicleReservationsModal from './VehicleReservationsModal';
import EditVehicleModal from './EditVehicleModal';

type FleetFilter = 'active' | 'inactive' | 'all';

async function recalculateStatuses(vehicles: Vehicle[]): Promise<Vehicle[]> {
  if (!supabase) return vehicles;

  const { data: activeReservations } = await supabase
    .from('reservations')
    .select('vehicle_id')
    .eq('status', 'active');

  const rentedVehicleIds = new Set(
    (activeReservations || []).map(r => r.vehicle_id).filter(Boolean)
  );

  const updates: { id: string; newStatus: Vehicle['status'] }[] = [];

  const corrected = vehicles.map(v => {
    if (v.status === 'inactive') return v;

    let correctStatus: Vehicle['status'];
    if (rentedVehicleIds.has(v.id)) {
      correctStatus = 'rented';
    } else {
      correctStatus = 'available';
    }

    if (v.status !== correctStatus) {
      updates.push({ id: v.id, newStatus: correctStatus });
      return { ...v, status: correctStatus };
    }
    return v;
  });

  for (const { id, newStatus } of updates) {
    await supabase
      .from('vehicles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return corrected;
}

interface FleetManagementProps {
  initialFilter?: FleetFilter;
  editVehicleId?: string | null;
  onEditVehicleConsumed?: () => void;
}

const FleetManagement: React.FC<FleetManagementProps> = ({ initialFilter, editVehicleId, onEditVehicleConsumed }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [fleetAccess, setFleetAccess] = useState({ create: false, edit: false });
  const canAdd = user?.role === 'admin' || (user?.role === 'manager' && fleetAccess.create);
  const canEdit = user?.role === 'admin' || (user?.role === 'manager' && fleetAccess.edit);

  useEffect(() => {
    if (user?.role !== 'manager') {
      setFleetAccess({ create: false, edit: false });
      return;
    }
    let mounted = true;
    setFleetAccess({ create: false, edit: false });
    supabase.from('employee_permissions').select('permissions').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!mounted || error) return;
        const p = data?.permissions as { fleet?: { create?: boolean; edit?: boolean } } | undefined;
        setFleetAccess({ create: p?.fleet?.create === true, edit: p?.fleet?.edit === true });
      });
    return () => { mounted = false; };
  }, [user?.id, user?.role]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dragVehicleId, setDragVehicleId] = useState<string | null>(null);
  const [savingVehicleOrder, setSavingVehicleOrder] = useState(false);
  const [vehicleOrderError, setVehicleOrderError] = useState('');
  const skipCardClick = React.useRef(false);
  const canReorder = user?.role === 'admin';

  const reorderVehicles = async (sourceId: string, targetId: string) => {
    if (!canReorder || savingVehicleOrder || sourceId === targetId) return;
    const original = [...vehicles];
    // Reorder within the currently selected filter, retaining hidden vehicles in the full list.
    const visible = original.filter(v => filter === 'all' || (filter === 'active' ? v.status !== 'inactive' : v.status === 'inactive'));
    const from = visible.findIndex(v => v.id === sourceId);
    const to = visible.findIndex(v => v.id === targetId);
    if (from === -1 || to === -1) return;
    visible.splice(to, 0, visible.splice(from, 1)[0]);
    const movedIds = visible.map(v => v.id);
    let index = 0;
    const next = original.map(v => movedIds.includes(v.id) ? visible[index++] : v);
    setVehicles(next);
    setVehicleOrderError('');
    setSavingVehicleOrder(true);
    try {
      const { error } = await supabase.rpc('reorder_vehicle_cards', { p_ids: next.map(v => v.id) });
      if (error) throw error;
    } catch (error) {
      console.error('Failed to reorder vehicle cards', error);
      setVehicles(original);
      setVehicleOrderError('Η νέα σειρά δεν αποθηκεύτηκε. Κάντε ανανέωση και δοκιμάστε ξανά.');
    } finally {
      setSavingVehicleOrder(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filter, setFilter] = useState<FleetFilter>(initialFilter || 'active');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Vehicle | null>(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [deleteReservationCount, setDeleteReservationCount] = useState<number | null>(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [deleteVehicleError, setDeleteVehicleError] = useState('');
  const [deletingVehicle, setDeletingVehicle] = useState(false);

  const closeDeleteVehicle = () => {
    if (deletingVehicle) return;
    setDeleteTarget(null);
    setDeleteReservationCount(null);
    setDeleteVehicleError('');
  };

  const openDeleteVehicle = async (vehicle: Vehicle) => {
    if (user?.role !== 'admin') return;
    setDeleteTarget(vehicle);
    setDeleteReservationCount(null);
    setDeleteVehicleError('');
    setDeleteCheckLoading(true);
    try {
      const { count, error } = await supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', vehicle.id);
      if (error) throw error;
      setDeleteReservationCount(count ?? 0);
    } catch (error) {
      console.error('Failed to check vehicle reservation history:', error);
      setDeleteVehicleError('Δεν ήταν δυνατός ο έλεγχος ιστορικού κρατήσεων. Η διαγραφή δεν επιτρέπεται.');
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  const permanentlyDeleteVehicle = async () => {
    if (user?.role !== 'admin' || !deleteTarget || deletingVehicle || deleteCheckLoading || deleteReservationCount !== 0) return;
    setDeletingVehicle(true);
    setDeleteVehicleError('');
    try {
      // Recheck immediately before deletion; the reservation FK also prevents concurrent unsafe deletion.
      const { count, error: checkError } = await supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', deleteTarget.id);
      if (checkError) throw checkError;
      if (count !== 0) {
        setDeleteReservationCount(count);
        setDeleteVehicleError('Το όχημα έχει συνδεδεμένες κρατήσεις και δεν μπορεί να διαγραφεί.');
        return;
      }
      const { data, error } = await supabase.from('vehicles')
        .delete().eq('id', deleteTarget.id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('No vehicle deleted');
      setVehicles(prev => prev.filter(v => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteReservationCount(null);
    } catch (error) {
      console.error('Failed to permanently delete vehicle:', error);
      setDeleteVehicleError('Η διαγραφή δεν ολοκληρώθηκε. Το όχημα μπορεί να έχει ιστορικό ή συνδεδεμένα στοιχεία.');
    } finally {
      setDeletingVehicle(false);
    }
  };
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [cardPhotoUrls, setCardPhotoUrls] = useState<Map<string, string>>(new Map());

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vehicleService.getAll();
      const synced = await recalculateStatuses(data);
      setVehicles([...synced].sort((a, b) => {
        const x = (a as Vehicle & { display_order?: number | null }).display_order;
        const y = (b as Vehicle & { display_order?: number | null }).display_order;
        if (x == null && y == null) return a.plate.localeCompare(b.plate);
        if (x == null) return 1;
        if (y == null) return -1;
        return x - y;
      }));
    } catch (err) {
      console.error('Failed to load vehicles:', err);
      setError('Αποτυχία φόρτωσης οχημάτων.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (editVehicleId && vehicles.length > 0) {
      const v = vehicles.find(v => v.id === editVehicleId && v.status !== 'inactive');
      if (v && canEdit) setEditingVehicle(v);
      onEditVehicleConsumed?.();
    }
  }, [editVehicleId, vehicles, onEditVehicleConsumed, canEdit]);

  useEffect(() => {
    const paths = vehicles
      .map((v) => v.photo_url)
      .filter((p): p is string => !!p);
    if (paths.length === 0) {
      setCardPhotoUrls(new Map());
      return;
    }
    let cancelled = false;
    photoService.getSignedUrls(paths, 3600).then((urls) => {
      if (!cancelled) setCardPhotoUrls(urls);
    }).catch(() => {
      if (!cancelled) setCardPhotoUrls(new Map());
    });
    return () => { cancelled = true; };
  }, [vehicles]);

  const handleDeactivate = async () => {
    if (!deactivateTarget || !canEdit || togglingId) return;
    const vehicle = deactivateTarget;
    setTogglingId(vehicle.id);
    setDeactivateError('');
    try {
      await vehicleService.update(vehicle.id, { status: 'inactive' } as Partial<Vehicle>);
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'inactive' } : v));
      setDeactivateTarget(null);
    } catch (err) {
      console.error('Deactivation failed:', err);
      setDeactivateError('Η απενεργοποίηση απέτυχε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleReactivate = async (vehicle: Vehicle) => {
    setTogglingId(vehicle.id);
    try {
      await vehicleService.update(vehicle.id, { status: 'available' } as Partial<Vehicle>);
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'available' } : v));
    } catch (err) {
      console.error('Reactivation failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40';
      case 'reserved': return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40';
      case 'rented': return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
      case 'service': return 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40';
      case 'inactive': return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
      default: return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Διαθέσιμο';
      case 'reserved': return 'Κρατημένο';
      case 'rented': return 'Ενοικιασμένο';
      case 'service': return 'Συντήρηση';
      case 'inactive': return 'Ανενεργό';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return CheckCircleIcon;
      case 'reserved': return ClockIcon;
      case 'rented': return TruckIcon;
      case 'service': return ExclamationTriangleIcon;
      case 'inactive': return NoSymbolIcon;
      default: return TruckIcon;
    }
  };

  type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'soon' | 'ok';

  const MAX_DISPLAY_DAYS = 3650;

  const getExpiryLevel = (date: string): ExpiryLevel => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(date + 'T00:00:00');
    if (isNaN(expiry.getTime())) return 'ok';
    const diffMs = expiry.getTime() - today.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return 'expired';
    if (days <= 7) return 'critical';
    if (days <= 15) return 'warning';
    if (days <= 30) return 'soon';
    return 'ok';
  };

  const expiryStyles: Record<ExpiryLevel, string> = {
    expired: 'bg-red-500/20 text-red-300 ring-1 ring-inset ring-red-400/50',
    critical: 'bg-orange-500/20 text-orange-300 ring-1 ring-inset ring-orange-400/50',
    warning: 'bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-400/50',
    soon: 'bg-yellow-500/15 text-yellow-200 ring-1 ring-inset ring-yellow-400/40',
    ok: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40',
  };

  const expiryLabel = (date: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(date + 'T00:00:00');
    if (isNaN(expiry.getTime())) return '—';
    const days = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Έληξε';
    if (days === 0) return 'Σήμερα';
    if (days > MAX_DISPLAY_DAYS) return '—';
    return `${days} ημέρες`;
  };

  const filteredVehicles = vehicles
    .filter(v => {
      if (filter === 'active') return v.status !== 'inactive';
      if (filter === 'inactive') return v.status === 'inactive';
      return true;
    })
;

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="mr-3 h-6 w-6 animate-spin text-[#55a8ff]" />
        <span className="text-blue-100/65">Φόρτωση στόλου...</span>
      </div>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <div className="py-12 text-center">
        <TruckIcon className="mx-auto mb-4 h-12 w-12 text-red-300" />
        <p className="mb-4 text-red-100">{error}</p>
        <button
          onClick={fetchVehicles}
          className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
        >
          <ArrowPathIcon className="mr-2 h-4 w-4" />
          Δοκιμή ξανά
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('fleet')}
        subtitle="Διαχείριση οχημάτων και διαθεσιμότητας"
        actions={canAdd ? (
          <button
            onClick={() => setAddingVehicle(true)}
            className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Προσθήκη Οχήματος
          </button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex space-x-2">
        {([
          { key: 'active', label: 'Ενεργά' },
          { key: 'inactive', label: 'Ανενεργά' },
          { key: 'all', label: 'Όλα' },
        ] as { key: FleetFilter; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[#1268f3] text-white shadow-[0_6px_18px_rgba(18,104,243,0.28)]'
                : 'border border-[#2b5b85]/80 bg-[#0b2949]/75 text-blue-100/75 hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredVehicles.length === 0 && (
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/85 py-14 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <TruckIcon className="mx-auto mb-4 h-12 w-12 text-blue-100/45" />
          <p className="text-blue-100/55">
            {filter === 'inactive'
              ? 'Δεν υπάρχουν ανενεργά οχήματα.'
              : 'Δεν υπάρχουν οχήματα ακόμα. Προσθέστε το πρώτο όχημα του στόλου σας.'}
          </p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {canAdd && addingVehicle && (
        <EditVehicleModal
          vehicle={null}
          onClose={() => setAddingVehicle(false)}
          onSaved={(created) => {
            setVehicles(prev => [...prev, created]);
            setAddingVehicle(false);
          }}
        />
      )}

      {/* Edit Vehicle Modal */}
      {canEdit && editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSaved={(updated) => {
            setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
            setEditingVehicle(null);
          }}
        />
      )}

      {/* Vehicle Reservations Modal */}
      {selectedVehicle && (
        <VehicleReservationsModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}

      {/* Vehicle Deactivation Confirmation */}
      {canEdit && deactivateTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !togglingId) {
              setDeactivateTarget(null);
              setDeactivateError('');
            }
          }}
        >
          <section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-vehicle-title" aria-describedby="deactivate-vehicle-description" className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0b2949] p-6 text-white shadow-[0_20px_65px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
                  <NoSymbolIcon className="h-6 w-6 text-amber-300" />
                </span>
                <h2 id="deactivate-vehicle-title" className="text-lg font-semibold">Απενεργοποίηση οχήματος</h2>
              </div>
              <button type="button" disabled={!!togglingId} onClick={() => { setDeactivateTarget(null); setDeactivateError(''); }} aria-label="Κλείσιμο" className="text-blue-100/60 hover:text-white disabled:opacity-40">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p id="deactivate-vehicle-description" className="mb-3 text-sm leading-6 text-blue-100/85">
              Θέλετε να απενεργοποιήσετε το όχημα <strong className="font-semibold text-white">{deactivateTarget.brand} {deactivateTarget.model} ({deactivateTarget.plate})</strong>;
            </p>
            <p className="mb-5 rounded-xl border border-[#2b5b85]/70 bg-[#071d38]/60 p-3 text-sm leading-6 text-blue-100/70">
              Δεν θα είναι διαθέσιμο για νέες κρατήσεις. Θα διατηρηθεί στον στόλο και στο ιστορικό, και μπορείτε να το επανενεργοποιήσετε.
            </p>
            {deactivateError && <p role="alert" className="mb-4 text-sm text-red-300">{deactivateError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={!!togglingId} onClick={() => { setDeactivateTarget(null); setDeactivateError(''); }} className="rounded-xl border border-[#2b5b85] bg-[#071d38] px-4 py-2.5 text-sm font-medium text-blue-100 hover:bg-[#12375d] disabled:opacity-40">
                Ακύρωση
              </button>
              <button type="button" onClick={handleDeactivate} disabled={!!togglingId} className="rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40">
                {togglingId ? 'Απενεργοποίηση...' : 'Απενεργοποίηση'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Permanent vehicle deletion is restricted to Admin and vehicles without reservation history. */}
      {user?.role === 'admin' && deleteTarget && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={event => { if (event.currentTarget === event.target) closeDeleteVehicle(); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-vehicle-title" className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#0b2949] p-6 text-white shadow-[0_20px_65px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10">
                  <TrashIcon className="h-6 w-6 text-red-300" />
                </span>
                <h2 id="delete-vehicle-title" className="text-lg font-semibold">Οριστική Διαγραφή Οχήματος</h2>
              </div>
              <button type="button" aria-label="Κλείσιμο" onClick={closeDeleteVehicle} disabled={deletingVehicle} className="text-blue-100/60 hover:text-white disabled:opacity-40"><XMarkIcon className="h-5 w-5"/></button>
            </div>
            <p className="mb-3 text-sm text-blue-100/85">
              Όχημα: <strong className="text-white">{deleteTarget.brand} {deleteTarget.model} ({deleteTarget.plate})</strong>
            </p>
            {deleteCheckLoading && <p className="mb-4 text-sm text-blue-100/70">Έλεγχος κρατήσεων...</p>}
            {deleteReservationCount !== null && deleteReservationCount > 0 && (
              <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Δεν επιτρέπεται η διαγραφή: το όχημα έχει {deleteReservationCount} συνδεδεμένες κρατήσεις. Μπορείτε να το απενεργοποιήσετε ώστε να διατηρηθεί το ιστορικό.
              </p>
            )}
            {deleteReservationCount === 0 && !deleteCheckLoading && (
              <p className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
                Το όχημα δεν έχει κρατήσεις. Η οριστική διαγραφή δεν μπορεί να αναιρεθεί.
              </p>
            )}
            {deleteVehicleError && <p role="alert" className="mb-4 text-sm text-red-300">{deleteVehicleError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={deletingVehicle} onClick={closeDeleteVehicle} className="rounded-xl border border-[#2b5b85] bg-[#071d38] px-4 py-2.5 text-sm font-medium text-blue-100 hover:bg-[#12375d] disabled:opacity-40">Ακύρωση</button>
              {deleteReservationCount === 0 && !deleteVehicleError && (
                <button type="button" disabled={deletingVehicle || deleteCheckLoading} onClick={permanentlyDeleteVehicle} className="rounded-xl border border-red-400/40 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40">
                  {deletingVehicle ? 'Διαγραφή...' : 'Οριστική Διαγραφή'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Fleet Grid */}
      {vehicleOrderError && <p role="alert" className="text-sm text-red-300">{vehicleOrderError}</p>}
      {canReorder && filteredVehicles.length > 0 && (
        <p className="text-xs text-blue-100/55">
          {savingVehicleOrder ? 'Αποθήκευση σειράς οχημάτων...' : 'Σύρετε μια κάρτα για να αλλάξετε τη σειρά εμφάνισης σε όλους τους χρήστες.'}
        </p>
      )}
      {filteredVehicles.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const StatusIcon = getStatusIcon(vehicle.status);
            const isInactive = vehicle.status === 'inactive';
            return (
              <div
                key={vehicle.id}
                draggable={canReorder && !savingVehicleOrder}
                onDragStart={event => {
                  if (!canReorder) { event.preventDefault(); return; }
                  skipCardClick.current = true;
                  setDragVehicleId(vehicle.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', vehicle.id);
                }}
                onDragOver={event => {
                  if (canReorder && dragVehicleId && dragVehicleId !== vehicle.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={event => {
                  event.preventDefault();
                  const source = dragVehicleId || event.dataTransfer.getData('text/plain');
                  setDragVehicleId(null);
                  void reorderVehicles(source, vehicle.id);
                }}
                onDragEnd={() => { setDragVehicleId(null); window.setTimeout(() => { skipCardClick.current = false; }, 150); }}
                role={!isInactive && canEdit ? 'button' : undefined}
                tabIndex={!isInactive && canEdit ? 0 : undefined}
                aria-label={!isInactive && canEdit ? `Επεξεργασία οχήματος ${vehicle.plate}` : undefined}
                onClick={event => {
                  if (skipCardClick.current) { skipCardClick.current = false; return; }
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                  if (!isInactive && canEdit) setEditingVehicle(vehicle);
                }}
                onKeyDown={(event) => {
                  if (!isInactive && canEdit && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setEditingVehicle(vehicle);
                  }
                }}
                className={`flex flex-col overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)] ${isInactive ? 'opacity-50' : canReorder ? 'cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55a8ff]' : canEdit ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55a8ff]' : ''} ${dragVehicleId === vehicle.id ? 'opacity-40' : ''}`}
              >
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center">
                      {vehicle.photo_url && cardPhotoUrls.get(vehicle.photo_url) ? (
                        <img
                          src={cardPhotoUrls.get(vehicle.photo_url)!}
                          alt={`${vehicle.brand} ${vehicle.model}`}
                          className="mr-3 h-12 w-12 flex-shrink-0 rounded-lg border border-[#1e4e7d]/70 object-cover"
                        />
                      ) : (
                        <div className="mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-[#1e4e7d]/50 bg-[#0b2949]/60">
                          <TruckIcon className="h-7 w-7 text-blue-100/45" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="whitespace-nowrap text-lg font-semibold tracking-[-0.02em] text-white">{vehicle.plate}</h3>
                        <p className="truncate text-sm text-blue-100/65">{vehicle.brand} {vehicle.model}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {getStatusLabel(vehicle.status)}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-100/55">Κατηγορία:</span>
                      <p className="font-medium text-white">{vehicle.category}</p>
                    </div>
                    <div>
                      <span className="text-blue-100/55">Έτος:</span>
                      <p className="font-medium text-white">{vehicle.year}</p>
                    </div>
                    <div>
                      <span className="text-blue-100/55">Κιβώτιο:</span>
                      <p className="font-medium text-white">{vehicle.transmission === 'manual' ? 'Χειροκίνητο' : 'Αυτόματο'}</p>
                    </div>
                    <div>
                      <span className="text-blue-100/55">Καύσιμο:</span>
                      <p className="font-medium text-white">{vehicle.fuel_type === 'petrol' ? 'Βενζίνη' : 'Πετρέλαιο'}</p>
                    </div>
                  </div>

                  {/* Document Status */}
                  {!isInactive && (
                    <div className="mb-4 space-y-2">
                      {vehicle.insurance_expiry && (
                        <div className={`flex items-start justify-between gap-2 rounded-lg p-2 text-xs ${expiryStyles[getExpiryLevel(vehicle.insurance_expiry)]}`}>
                          <span className="flex-shrink-0">Ασφάλεια:</span>
                          <div className="flex flex-col items-end text-right">
                            <span>{expiryLabel(vehicle.insurance_expiry)}</span>
                            <span className="text-blue-100/40">{new Date(vehicle.insurance_expiry + 'T00:00:00').toLocaleDateString('el-GR')}</span>
                          </div>
                        </div>
                      )}
                      {vehicle.inspection_expiry && (
                        <div className={`flex items-start justify-between gap-2 rounded-lg p-2 text-xs ${expiryStyles[getExpiryLevel(vehicle.inspection_expiry)]}`}>
                          <span className="flex-shrink-0">ΚΤΕΟ:</span>
                          <div className="flex flex-col items-end text-right">
                            <span>{expiryLabel(vehicle.inspection_expiry)}</span>
                            <span className="text-blue-100/40">{new Date(vehicle.inspection_expiry + 'T00:00:00').toLocaleDateString('el-GR')}</span>
                          </div>
                        </div>
                      )}
                      {vehicle.next_service_date && (() => {
                        const level = getExpiryLevel(vehicle.next_service_date);
                        if (level === 'ok') return null;
                        return (
                          <div className={`flex items-start justify-between gap-2 rounded-lg p-2 text-xs ${expiryStyles[level]}`}>
                            <span className="flex-shrink-0">Επόμενο Service:</span>
                            <div className="flex flex-col items-end text-right">
                              <span>{expiryLabel(vehicle.next_service_date)}</span>
                              <span className="text-blue-100/40">{new Date(vehicle.next_service_date + 'T00:00:00').toLocaleDateString('el-GR')}</span>
                            </div>
                          </div>
                        );
                      })()}
                      {vehicle.next_service_odometer != null && vehicle.odometer != null && (() => {
                        const kmRemaining = vehicle.next_service_odometer - vehicle.odometer;
                        if (kmRemaining > 1000) return null;
                        const kmLevel: ExpiryLevel =
                          kmRemaining < 0 ? 'expired' :
                          kmRemaining <= 100 ? 'critical' :
                          kmRemaining <= 300 ? 'warning' :
                          'soon';
                        return (
                          <div className={`flex items-start justify-between gap-2 rounded-lg p-2 text-xs ${expiryStyles[kmLevel]}`}>
                            <span className="flex-shrink-0">Service (χλμ):</span>
                            <div className="flex flex-col items-end text-right">
                              <span>{kmRemaining < 0 ? `Έχει ξεπεραστεί ${Math.abs(kmRemaining)} km` : `${kmRemaining} km απομένουν`}</span>
                              <span className="text-blue-100/40">{vehicle.odometer.toLocaleString('el-GR')} / {vehicle.next_service_odometer.toLocaleString('el-GR')} km</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="mt-auto flex space-x-2 pt-4">
                    <button
                      onClick={(event) => { event.stopPropagation(); setSelectedVehicle(vehicle); }}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    >
                      <CalendarDaysIcon className="mr-1 h-4 w-4" />
                      Κρατήσεις
                    </button>
                    {!isInactive && canEdit && (
                      <>
                        <button
                          onClick={(event) => { event.stopPropagation(); setEditingVehicle(vehicle); }}
                          className="inline-flex min-h-10 items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                          title="Επεξεργασία"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeactivateError('');
                            setDeactivateTarget(vehicle);
                          }}
                          disabled={togglingId === vehicle.id}
                          className="inline-flex min-h-10 items-center rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
                          title="Απενεργοποίηση"
                        >
                          <NoSymbolIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={(event) => { event.stopPropagation(); void openDeleteVehicle(vehicle); }}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20"
                        title="Οριστική διαγραφή οχήματος"
                        aria-label={`Οριστική διαγραφή οχήματος ${vehicle.plate}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                    {isInactive && canEdit && (
                      <button
                        onClick={(event) => { event.stopPropagation(); handleReactivate(vehicle); }}
                        disabled={togglingId === vehicle.id}
                        className="inline-flex min-h-10 items-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        <ArrowPathIcon className="mr-1 h-4 w-4" />
                        Επανενεργοποίηση
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FleetManagement;
