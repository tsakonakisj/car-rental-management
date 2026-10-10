import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalendarDaysIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../../types';

interface VehicleReservation {
  id: string;
  pickup_date: string;
  return_date: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  customer: { name: string } | null;
  pickup_station: { name: string } | null;
}

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

const statusOrder: Record<string, number> = { active: 0, upcoming: 1, completed: 2, cancelled: 3 };

const statusLabels: Record<string, string> = {
  active: 'Ενεργή',
  upcoming: 'Επερχόμενη',
  completed: 'Ολοκληρωμένη',
  cancelled: 'Ακυρωμένη',
};

const statusColors: Record<string, string> = {
  active: 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40',
  upcoming: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40',
  completed: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40',
  cancelled: 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35',
};

const VehicleReservationsModal: React.FC<Props> = ({ vehicle, onClose }) => {
  const [reservations, setReservations] = useState<VehicleReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    supabase
      .from('reservations')
      .select(`
        id, pickup_date, return_date, status,
        customer:customers(name),
        pickup_station:pickup_station_id(name)
      `)
      .eq('vehicle_id', vehicle.id)
      .order('pickup_date', { ascending: false })
      .then(({ data }) => {
        setReservations((data as VehicleReservation[]) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [vehicle.id]);

  const visibleReservations = reservations
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  const activeOrUpcoming = reservations.find(r => r.status === 'active' || r.status === 'upcoming');

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020b18]/80 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#1e4e7d]/70 bg-[#071d38] shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e4e7d]/70 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{vehicle.plate}</h2>
            <p className="text-sm text-blue-100/55">{vehicle.brand} {vehicle.model} &middot; {vehicle.category}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-blue-100/45 transition-colors hover:bg-[#0b2949] hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Availability badge */}
        <div className="border-b border-[#1e4e7d]/70 bg-[#0b2949]/40 px-6 py-3">
          {vehicle.status === 'service' ? (
            <span className="text-sm font-medium text-red-300">Σε συντήρηση</span>
          ) : activeOrUpcoming ? (
            <div className="flex items-center text-sm text-amber-300">
              <ClockIcon className="mr-1.5 h-4 w-4 flex-shrink-0" />
              <span>
                {activeOrUpcoming.status === 'active' ? 'Ενοικιασμένο' : 'Κρατημένο'} από {formatDate(activeOrUpcoming.pickup_date).split(' ')[0]} έως {formatDate(activeOrUpcoming.return_date).split(' ')[0]}
              </span>
            </div>
          ) : (
            <div className="flex items-center text-sm text-emerald-300">
              <CheckCircleIcon className="mr-1.5 h-4 w-4 flex-shrink-0" />
              <span>Διαθέσιμο τώρα</span>
            </div>
          )}
        </div>

        {/* Reservation list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="mb-3 flex items-center text-sm font-medium text-blue-100/85">
            <CalendarDaysIcon className="mr-1.5 h-4 w-4 text-[#72b9ff]" />
            Κρατήσεις ({visibleReservations.length})
          </h3>

          {loading ? (
            <p className="py-4 text-center text-sm text-blue-100/45">Φόρτωση...</p>
          ) : visibleReservations.length === 0 ? (
            <p className="py-4 text-center text-sm text-blue-100/45">Δεν υπάρχουν κρατήσεις.</p>
          ) : (
            <div className="space-y-3">
              {visibleReservations.map(r => (
                <div key={r.id} className="rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/50 p-3 text-sm">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-medium text-white">{r.customer?.name || 'Άγνωστος'}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || ''}`}>
                      {statusLabels[r.status] || r.status}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-blue-100/55">
                    <p>Παραλαβή: {formatDate(r.pickup_date)}</p>
                    <p>Επιστροφή: {formatDate(r.return_date)}</p>
                    {r.pickup_station?.name && <p>Σταθμός: {r.pickup_station.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#1e4e7d]/70 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleReservationsModal;
