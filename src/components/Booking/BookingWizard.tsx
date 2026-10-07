import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { reservationService, customerService, insuranceService, pricingService, reservationExtrasService } from '../../lib/database';
import type { Customer, Reservation, Insurance, Extra } from '../../types';
import BookingStep1 from './BookingStep1';
import BookingStep2 from './BookingStep2';
import BookingStep3 from './BookingStep3';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// --- helpers (πάνω από το component) ---
const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

// UTC-midnight, όχι local ούτε toISOString
const daysBetweenUTC = (start: string, end: string) => {
  if (!start || !end) return 1;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((e - s) / 86400000));
};

interface BookingData {
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  pickupStation: string;
  returnStation: string;
  category: string;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  dailyRate: number;
  insuranceType: string;
  insuranceRate: number;
  insuranceId?: string;
  extras: { [key: string]: number };
  customer: {
    name: string;
    phone: string;
    email: string;
    country: string;
    licenseNumber: string;
    birthDate: string;
    source: string;
  };
  notes: string;
}

interface BookingWizardProps {
  onComplete?: () => void;
}

const BookingWizard: React.FC<BookingWizardProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);

  // DB-loaded insurance and extras
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [extrasList, setExtrasList] = useState<Extra[]>([]);

  // Scroll to top when wizard opens
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Load insurance and extras from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [insData, extData] = await Promise.all([
          insuranceService.getAll(),
          pricingService.getExtras()
        ]);
        if (cancelled) return;
        setInsurances(insData);
        setExtrasList(extData);
      } catch (err) {
        console.error('Failed to load insurance/extras:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Σήμερα & Αύριο
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [bookingData, setBookingData] = useState<BookingData>(() => {
    const pickupStr = formatDate(today);
    return {
      pickupDate: pickupStr,
      returnDate: formatDate(tomorrow),
      pickupTime: '09:00',
      returnTime: '09:00',
      pickupStation: '',
      returnStation: '',
      category: '',
      dailyRate: 0,
      insuranceType: '',
      insuranceRate: 0,
      insuranceId: undefined,
      extras: {},
      customer: {
        name: '',
        phone: '',
        email: '',
        country: '',
        licenseNumber: '',
        birthDate: '',
        source: 'store'
      },
      notes: ''
    };
  });

  const updateBookingData = (updates: Partial<BookingData>) => {
    setBookingData(prev => {
      const next = {
        ...prev,
        ...updates,
        customer: {
          ...prev.customer,
          ...(updates.customer || {})
        },
        extras: {
          ...prev.extras,
          ...(updates.extras || {})
        }
      };
      return next;
    });
  };

  // Pricing calculations with useMemo — uses DB-loaded extras
  const pricing = useMemo(() => {
    const days = daysBetweenUTC(bookingData.pickupDate, bookingData.returnDate);
    const rate = Number.isFinite(bookingData.dailyRate) ? bookingData.dailyRate : 0;

    let dailyTotal = rate * days;
    let insuranceTotal = 0;
    if (bookingData.insuranceRate > 0) {
      insuranceTotal = bookingData.insuranceRate * days;
    }

    let extrasTotal = 0;
    const extrasMap = new Map(extrasList.map(e => [e.id, e]));
    Object.entries(bookingData.extras || {}).forEach(([extraId, quantity]) => {
      const def = extrasMap.get(extraId);
      if (!def || !quantity) return;
      const price = Number(def.price) || 0;
      extrasTotal += def.type === 'daily'
        ? price * quantity * days
        : price * quantity;
    });

    return {
      days,
      rate,
      dailyTotal,
      insuranceTotal,
      extrasTotal,
      grandTotal: dailyTotal + insuranceTotal + extrasTotal
    };
  }, [bookingData.pickupDate, bookingData.returnDate, bookingData.dailyRate, bookingData.insuranceRate, bookingData.extras, extrasList]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          bookingData.pickupDate && bookingData.returnDate &&
          bookingData.pickupStation && bookingData.returnStation
        );
      case 2:
        return !!(bookingData.category && bookingData.vehicleId);
      case 3:
        return !!(bookingData.customer.name && bookingData.customer.phone);
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null);
  const [customerChoice, setCustomerChoice] = useState<'existing' | 'new' | null>(null);

  const checkAndComplete = async () => {
    setSaveError('');
    setDuplicateCustomer(null);
    setCustomerChoice(null);

    const existing = await customerService.findByPhoneOrEmail(
      bookingData.customer.phone,
      bookingData.customer.email
    );

    if (existing) {
      setDuplicateCustomer(existing);
      return;
    }

    saveBooking(null);
  };

  const confirmAndSave = () => {
    if (customerChoice === 'existing' && duplicateCustomer) {
      saveBooking(duplicateCustomer);
    } else if (customerChoice === 'new') {
      saveBooking(null);
    }
    setDuplicateCustomer(null);
  };

  const saveBooking = async (reuseCustomer: Customer | null) => {
    setSaving(true);
    setSaveError('');
    try {
      // Final overlap check before saving
      if (bookingData.vehicleId) {
        const allReservations: Reservation[] = await reservationService.getAll();
        const newStart = new Date(bookingData.pickupDate).getTime();
        const newEnd = new Date(bookingData.returnDate).getTime();
        const hasConflict = allReservations.some(r => {
          if (r.vehicle_id !== bookingData.vehicleId) return false;
          if (r.status !== 'upcoming' && r.status !== 'active') return false;
          const rStart = new Date(r.pickup_date).getTime();
          const rEnd = new Date(r.return_date).getTime();
          return newStart < rEnd && newEnd > rStart;
        });
        if (hasConflict) {
          setSaveError('Το όχημα δεν είναι διαθέσιμο για τις επιλεγμένες ημερομηνίες');
          setSaving(false);
          return;
        }
      }

      // 1) Customer
      let customer;
      if (reuseCustomer) {
        customer = reuseCustomer;
      } else {
        const customerPayload: any = {
          name: bookingData.customer.name,
          phone: bookingData.customer.phone,
          email: bookingData.customer.email || null,
          country: bookingData.customer.country || '-',
          license_number: bookingData.customer.licenseNumber || '-',
          birth_date: bookingData.customer.birthDate || null,
          source: bookingData.customer.source || 'store'
        };
        customer = await customerService.create(customerPayload);
      }

      if (!customer?.id) {
        throw new Error('Customer ID missing after save');
      }

      // 2) Reservation
      const reservationPayload: any = {
        customer_id: customer.id,
        vehicle_id: bookingData.vehicleId || null,
        category: bookingData.category,
        pickup_date: `${bookingData.pickupDate}T${bookingData.pickupTime}:00`,
        return_date: `${bookingData.returnDate}T${bookingData.returnTime}:00`,
        pickup_station_id: bookingData.pickupStation,
        return_station_id: bookingData.returnStation,
        daily_rate: pricing.rate,
        insurance_type: bookingData.insuranceType || 'Βασική Ασφάλεια',
        insurance_rate: bookingData.insuranceRate || 0,
        total_amount: pricing.grandTotal,
        notes: bookingData.notes || '',
        status: 'upcoming',
        excel_updated: false
      };
      const reservation = await reservationService.create(reservationPayload);

      // 3) Save extras to reservation_extras
      const extrasMap = new Map(extrasList.map(e => [e.id, e]));
      const extrasToSave: Array<{ extra_id: string; quantity: number; daily_rate: number }> = [];
      Object.entries(bookingData.extras || {}).forEach(([extraId, quantity]) => {
        const def = extrasMap.get(extraId);
        if (!def || !quantity) return;
        extrasToSave.push({
          extra_id: extraId,
          quantity: quantity,
          daily_rate: Number(def.price) || 0
        });
      });

      if (extrasToSave.length > 0) {
        await reservationExtrasService.createMany(reservation.id, extrasToSave);
      }

      onComplete?.();
    } catch (error: any) {
      console.error('Booking creation failed:', error);
      const msg = error?.message || error?.error_description || JSON.stringify(error);
      setSaveError(`Αποτυχία: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = () => {
    checkAndComplete();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{t('newBooking')}</h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {t('step')} {currentStep} / 3
              </span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === currentStep
                        ? 'bg-blue-600 text-white'
                        : step < currentStep
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step < currentStep ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          {currentStep === 1 && (
            <BookingStep1 data={bookingData} updateData={updateBookingData} />
          )}
          {currentStep === 2 && (
            <BookingStep2 data={bookingData} updateData={updateBookingData} />
          )}
          {currentStep === 3 && (
            <BookingStep3 data={bookingData} pricing={pricing} updateData={updateBookingData} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            {t('previous')}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('next')}
              <ChevronRightIcon className="h-4 w-4 ml-2" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {saveError && (
                <span className="text-sm text-red-600">{saveError}</span>
              )}
              <button
                onClick={handleComplete}
                disabled={!canProceed() || saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Αποθήκευση...' : t('complete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Duplicate customer warning */}
      {duplicateCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50" onClick={() => setDuplicateCustomer(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-5 z-10">
            <p className="text-sm font-semibold text-amber-700 mb-3">
              Υπάρχει ήδη πελάτης με αυτά τα στοιχεία
            </p>

            <div className="space-y-2 mb-4">
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  customerChoice === 'existing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="customerChoice"
                  checked={customerChoice === 'existing'}
                  onChange={() => setCustomerChoice('existing')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Χρήση υπάρχοντος πελάτη</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {duplicateCustomer.name} &mdash; {duplicateCustomer.phone}
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  customerChoice === 'new' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="customerChoice"
                  checked={customerChoice === 'new'}
                  onChange={() => setCustomerChoice('new')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Δημιουργία νέου πελάτη</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {bookingData.customer.name} &mdash; {bookingData.customer.phone}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDuplicateCustomer(null)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Ακύρωση
              </button>
              <button
                onClick={confirmAndSave}
                disabled={saving || customerChoice === null}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Αποθήκευση...' : 'Συνέχεια'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingWizard;
