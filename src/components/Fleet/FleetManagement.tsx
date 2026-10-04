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
      case 'available': return 'bg-green-100 text-green-800';
      case 'reserved': return 'bg-yellow-100 text-yellow-800';
      case 'rented': return 'bg-blue-100 text-blue-800';
      case 'service': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-200 text-gray-500';
      default: return 'bg-gray-100 text-gray-800';
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
        <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin mr-3" />
        <span className="text-gray-600">Φόρτωση στόλου...</span>
      </div>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <div className="text-center py-12">
        <TruckIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchVehicles}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Δοκιμή ξανά
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{t('fleet')}</h1>
        <button
          onClick={() => setAddingVehicle(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
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
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredVehicles.length === 0 && (
        <div className="text-center py-12 bg-white shadow-sm rounded-lg">
          <TruckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => {
            const StatusIcon = getStatusIcon(vehicle.status);
            const isInactive = vehicle.status === 'inactive';
            return (
              <div
                key={vehicle.id}
                className={`bg-white shadow-sm rounded-lg overflow-hidden ${isInactive ? 'opacity-50' : ''}`}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <TruckIcon className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{vehicle.plate}</h3>
                        <p className="text-sm text-gray-600">{vehicle.brand} {vehicle.model}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {getStatusLabel(vehicle.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">Κατηγορία:</span>
                      <p className="font-medium">{vehicle.category}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Έτος:</span>
                      <p className="font-medium">{vehicle.year}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Κιβώτιο:</span>
                      <p className="font-medium">{vehicle.transmission === 'manual' ? 'Χειροκίνητο' : 'Αυτόματο'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Καύσιμο:</span>
                      <p className="font-medium">{vehicle.fuel_type === 'petrol' ? 'Βενζίνη' : 'Πετρέλαιο'}</p>
                    </div>
                  </div>

                  {/* Document Status */}
                  {!isInactive && (
                    <div className="space-y-2 mb-4">
                      {vehicle.insurance_expiry && (
                        <div className={`flex items-center justify-between text-xs p-2 rounded ${
                          isDocumentExpiring(vehicle.insurance_expiry) ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          <span>Ασφάλεια:</span>
                          <span>{new Date(vehicle.insurance_expiry).toLocaleDateString('el-GR')}</span>
                        </div>
                      )}
                      {vehicle.inspection_expiry && (
                        <div className={`flex items-center justify-between text-xs p-2 rounded ${
                          isDocumentExpiring(vehicle.inspection_expiry) ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
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
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 transition-colors"
                    >
                      <CalendarDaysIcon className="h-4 w-4 mr-1" />
                      Κρατήσεις
                    </button>
                    {!isInactive && (
                      <>
                        <button
                          onClick={() => setEditingVehicle(vehicle)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          title="Επεξεργασία"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(vehicle)}
                          disabled={togglingId === vehicle.id}
                          className="inline-flex items-center px-3 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 transition-colors disabled:opacity-50"
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
                        className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-1" />
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
