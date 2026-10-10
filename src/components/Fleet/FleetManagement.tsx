import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { vehicleService } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../../types';
import {
  TruckIcon,
  PlusIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  NoSymbolIcon
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

const FleetManagement: React.FC = () => {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filter, setFilter] = useState<FleetFilter>('active');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vehicleService.getAll();
      const synced = await recalculateStatuses(data);
      setVehicles(synced);
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

  const handleDeactivate = async (vehicle: Vehicle) => {
    const confirmed = window.confirm(
      'Θέλετε να απενεργοποιήσετε αυτό το όχημα; Δεν θα εμφανίζεται σε νέες κρατήσεις, αλλά θα παραμείνει στο ιστορικό.'
    );
    if (!confirmed) return;

    setTogglingId(vehicle.id);
    try {
      await vehicleService.update(vehicle.id, { status: 'inactive' } as Partial<Vehicle>);
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'inactive' } : v));
    } catch (err) {
      console.error('Deactivation failed:', err);
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

  const isDocumentExpiring = (date: string) => {
    const expiry = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30;
  };

  const filteredVehicles = vehicles
    .filter(v => {
      if (filter === 'active') return v.status !== 'inactive';
      if (filter === 'inactive') return v.status === 'inactive';
      return true;
    })
    .sort((a, b) => {
      const aInactive = a.status === 'inactive' ? 1 : 0;
      const bInactive = b.status === 'inactive' ? 1 : 0;
      return aInactive - bInactive;
    });

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">{t('fleet')}</h1>
        <button
          onClick={() => setAddingVehicle(true)}
          className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Προσθήκη Οχήματος
        </button>
      </div>

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
      {addingVehicle && (
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
      {editingVehicle && (
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

      {/* Fleet Grid */}
      {filteredVehicles.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const StatusIcon = getStatusIcon(vehicle.status);
            const isInactive = vehicle.status === 'inactive';
            return (
              <div
                key={vehicle.id}
                className={`overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)] ${isInactive ? 'opacity-50' : ''}`}
              >
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <TruckIcon className="mr-3 h-8 w-8 text-blue-100/45" />
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">{vehicle.plate}</h3>
                        <p className="text-sm text-blue-100/65">{vehicle.brand} {vehicle.model}</p>
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
                        <div className={`flex items-center justify-between rounded-lg p-2 text-xs ${
                          isDocumentExpiring(vehicle.insurance_expiry) ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                        }`}>
                          <span>Ασφάλεια:</span>
                          <span>{new Date(vehicle.insurance_expiry).toLocaleDateString('el-GR')}</span>
                        </div>
                      )}
                      {vehicle.inspection_expiry && (
                        <div className={`flex items-center justify-between rounded-lg p-2 text-xs ${
                          isDocumentExpiring(vehicle.inspection_expiry) ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                        }`}>
                          <span>ΚΤΕΟ:</span>
                          <span>{new Date(vehicle.inspection_expiry).toLocaleDateString('el-GR')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedVehicle(vehicle)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    >
                      <CalendarDaysIcon className="mr-1 h-4 w-4" />
                      Κρατήσεις
                    </button>
                    {!isInactive && (
                      <>
                        <button
                          onClick={() => setEditingVehicle(vehicle)}
                          className="inline-flex min-h-10 items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                          title="Επεξεργασία"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(vehicle)}
                          disabled={togglingId === vehicle.id}
                          className="inline-flex min-h-10 items-center rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
                          title="Απενεργοποίηση"
                        >
                          <NoSymbolIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isInactive && (
                      <button
                        onClick={() => handleReactivate(vehicle)}
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
