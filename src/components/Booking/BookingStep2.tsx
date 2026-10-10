import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { vehicleService, pricingService, reservationService, resolveDailyRate } from '../../lib/database';
import type { Vehicle, Pricing, Season, Reservation } from '../../types';
import { TruckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface BookingStep2Props {
  data: any;
  updateData: (data: any) => void;
}

const BookingStep2: React.FC<BookingStep2Props> = ({ data, updateData }) => {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [vehicleData, pricingData, seasonData, reservationData] = await Promise.all([
          vehicleService.getAll(),
          pricingService.getPricing(),
          pricingService.getSeasons(),
          reservationService.getAll()
        ]);
        setVehicles(vehicleData.filter(v => v.status !== 'inactive'));
        setPricing(pricingData);
        setSeasons(seasonData);
        setReservations(reservationData);
      } catch (err) {
        console.error('Failed to load vehicles:', err);
        setError('Αποτυχία φόρτωσης οχημάτων.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isVehicleOverlapping = (vehicleId: string): boolean => {
    if (!data.pickupDate || !data.returnDate) return false;
    const newStart = new Date(data.pickupDate).getTime();
    const newEnd = new Date(data.returnDate).getTime();
    return reservations.some(r => {
      if (r.vehicle_id !== vehicleId) return false;
      if (r.status !== 'upcoming' && r.status !== 'active') return false;
      const rStart = new Date(r.pickup_date).getTime();
      const rEnd = new Date(r.return_date).getTime();
      return newStart < rEnd && newEnd > rStart;
    });
  };

  const getDailyRate = (category: string): { rate: number; seasonName: string | null } => {
    const { rate, season } = resolveDailyRate(data.pickupDate || '', category, seasons, pricing);
    return { rate, seasonName: season?.name ?? null };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Διαθέσιμο';
      case 'reserved': return 'Κρατημένο';
      case 'service': return 'Συντήρηση';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500/20 text-emerald-300';
      case 'reserved': return 'bg-amber-500/20 text-amber-300';
      case 'service': return 'bg-red-500/20 text-red-300';
      default: return 'bg-[#0b2949] text-blue-100/65';
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    const { rate } = getDailyRate(vehicle.category);
    if (rate <= 0) return;
    updateData({
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      category: vehicle.category,
      dailyRate: rate
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-6 w-6 text-[#55a8ff] animate-spin mr-3" />
        <span className="text-blue-100/65">Φόρτωση οχημάτων...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <TruckIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-12">
        <TruckIcon className="h-12 w-12 text-blue-100/45 mx-auto mb-4" />
        <p className="text-blue-100/55">Δεν υπάρχουν οχήματα στον στόλο. Προσθέστε οχήματα από τη σελίδα Στόλος.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white tracking-[-0.02em]">{t('selectCategory')}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((vehicle) => {
          const { rate, seasonName } = getDailyRate(vehicle.category);
          const isSelected = data.vehicleId === vehicle.id;
          const hasOverlap = isVehicleOverlapping(vehicle.id);
          const hasRate = rate > 0;
          const isAvailable = vehicle.status === 'available' && !hasOverlap && hasRate;

          return (
            <div
              key={vehicle.id}
              onClick={() => isAvailable && handleVehicleSelect(vehicle)}
              className={`rounded-2xl border p-4 transition-all ${
                isAvailable ? 'cursor-pointer hover:shadow-md' : 'opacity-60 cursor-not-allowed'
              } ${
                isSelected
                  ? 'border-[#2f8cff] bg-[#1268f3]/15'
                  : 'border-[#2b5b85]/80 bg-[#0b2949]/60 hover:border-[#55a8ff]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <TruckIcon className="h-6 w-6 text-blue-100/45 mr-2" />
                  <div>
                    <h4 className="font-medium text-white">{vehicle.plate}</h4>
                    <p className="text-sm text-blue-100/65">{vehicle.brand} {vehicle.model}</p>
                  </div>
                </div>
                {hasOverlap ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300">
                    Μη διαθέσιμο
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                    {getStatusLabel(vehicle.status)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-blue-100/55">Κατηγορία:</span>
                  <p className="font-medium text-white">{vehicle.category}</p>
                </div>
                <div>
                  <span className="text-blue-100/55">Κιβώτιο:</span>
                  <p className="font-medium text-white">{vehicle.transmission === 'manual' ? 'Χειροκίνητο' : 'Αυτόματο'}</p>
                </div>
                <div>
                  <span className="text-blue-100/55">Καύσιμο:</span>
                  <p className="font-medium text-white">{vehicle.fuel_type === 'petrol' ? 'Βενζίνη' : 'Πετρέλαιο'}</p>
                </div>
                <div>
                  <span className="text-blue-100/55">Έτος:</span>
                  <p className="font-medium text-white">{vehicle.year}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  {rate > 0 ? (
                    <p className="text-lg font-semibold text-emerald-300">
                      {`\u20AC${rate}/ημέρα`}
                      {seasonName && (
                        <span className="text-xs font-normal text-blue-100/55 ml-1">({seasonName})</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-red-400">
                      Δεν έχει οριστεί τιμή για αυτή την κατηγορία και σεζόν
                    </p>
                  )}
                </div>
                {isSelected && (
                  <span className="text-sm font-medium text-[#55a8ff] bg-[#1268f3]/20 px-2 py-0.5 rounded">
                    Επιλεγμένο
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingStep2;
