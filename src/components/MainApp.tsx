import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { reservationService, vehicleService, checkoutService, checkinService } from '../lib/database';
import { checkoutDocumentError } from '../lib/vehicleDocuments';
import type { Vehicle } from '../types';
import LoginForm from './Login/LoginForm';
import Header from './Layout/Header';
import Sidebar, { isTabAllowed } from './Layout/Sidebar';
import DashboardPage from './Dashboard/DashboardPage';
import BookingWizard from './Booking/BookingWizard';
import ReservationsList from './Reservations/ReservationsList';
import CustomerManagement from './Customers/CustomerManagement';
import FleetManagement from './Fleet/FleetManagement';
import PricingManagement from './Pricing/PricingManagement';
import ReportsPage from './Reports/ReportsPageNew';
import UserManagement from './Users/UserManagement';
import SettingsPage from './Settings/SettingsPage';
import CheckOutForm from './CheckOut/CheckOutForm';
import CheckInForm from './CheckIn/CheckInForm';
import UpdatePassword from './Login/UpdatePassword';

const MainApp: React.FC = () => {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [managerTabs, setManagerTabs] = useState<string[]>([]);
  useEffect(() => {
    if (user?.role !== 'manager') {
      setManagerTabs([]);
      return;
    }
    let live = true;
    setManagerTabs([]);
    supabase.from('employee_permissions').select('permissions').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!live || error) return;
        const permissions = data?.permissions as Record<string, { view?: boolean }> | undefined;
        setManagerTabs(['dashboard', ...(['bookings', 'customers', 'fleet', 'pricing', 'reports'] as const)
          .filter((tab) => permissions?.[tab]?.view === true)]);
      });
    return () => { live = false; };
  }, [user?.id, user?.role]);
  const [previewRole, setPreviewRole] = useState<'admin' | 'manager'>('admin');
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [checkOutReservation, setCheckOutReservation] = useState<string | null>(null);
  const [checkoutAlert, setCheckoutAlert] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{ reservationId: string; odometer?: number } | null>(null);
  const [serviceWarning, setServiceWarning] = useState<{ reservationId: string; vehicle: Vehicle; contractMissing: boolean; reasons: string[] } | null>(null);
  const [serviceNewDate, setServiceNewDate] = useState('');
  const [serviceNewKm, setServiceNewKm] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceSaveError, setServiceSaveError] = useState('');

  const continueAfterServiceWarning = () => {
    if (!serviceWarning) return;
    const { reservationId, vehicle, contractMissing } = serviceWarning;
    setServiceWarning(null);
    setServiceSaveError('');
    if (contractMissing) {
      setPendingCheckout({ reservationId, odometer: vehicle.odometer });
    } else {
      setCheckOutVehicleOdometer(vehicle.odometer);
      setCheckOutReservation(reservationId);
    }
  };

  const saveServiceReschedule = async () => {
    if (user?.role !== 'admin' || !serviceWarning || serviceSaving) return;
    const oldDate = serviceWarning.vehicle.next_service_date || '';
    const oldKm = serviceWarning.vehicle.next_service_odometer;
    const parsedKm = serviceNewKm.trim() === '' ? null : Number(serviceNewKm);
    if ((serviceNewDate || '') === oldDate && parsedKm === (oldKm ?? null)) {
      setServiceSaveError('Αλλάξτε πρώτα την ημερομηνία ή τα χιλιόμετρα του επόμενου service.');
      return;
    }
    if (parsedKm !== null && (!Number.isInteger(parsedKm) || parsedKm < 0)) {
      setServiceSaveError('Τα χιλιόμετρα πρέπει να είναι μη αρνητικός ακέραιος αριθμός.');
      return;
    }
    setServiceSaving(true);
    setServiceSaveError('');
    try {
      await vehicleService.update(serviceWarning.vehicle.id, {
        next_service_date: serviceNewDate || null,
        next_service_odometer: parsedKm,
      } as Partial<Vehicle>);
      continueAfterServiceWarning();
    } catch (err) {
      console.error('Service rescheduling failed', err);
      setServiceSaveError('Η μετάθεση του service δεν αποθηκεύτηκε. Δοκιμάστε ξανά.');
    } finally {
      setServiceSaving(false);
    }
  };
  const [checkOutVehicleOdometer, setCheckOutVehicleOdometer] = useState<number | undefined>(undefined);
  const [checkInReservation, setCheckInReservation] = useState<string | null>(null);
  const [checkInVehicleFuelTankCapacity, setCheckInVehicleFuelTankCapacity] = useState<number | null | undefined>(undefined);
  const [reservationRefresh, setReservationRefresh] = useState(0);
  const [checkOutError, setCheckOutError] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [checkOutSubmitting, setCheckOutSubmitting] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [reservationsInitialFilter, setReservationsInitialFilter] = useState<string>('all');
  const [fleetInitialFilter, setFleetInitialFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [fleetEditVehicleId, setFleetEditVehicleId] = useState<string | null>(null);
  const [viewReservationId, setViewReservationId] = useState<string | null>(null);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(prev => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  if (window.location.pathname === '/update-password') {
    return <UpdatePassword />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061a35]">
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#0b2949] p-8 shadow-[0_20px_55px_rgba(0,0,0,0.3)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-100/70">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <UpdatePassword />;
  }

  if (!user) {
    return <LoginForm />;
  }

  const handleCheckOut = async (reservationId: string) => {
    setCheckOutError('');
    try {
      const existingCheckout = await checkoutService.getByReservationId(reservationId);
      if (existingCheckout) {
        setCheckoutAlert('Έχει ήδη γίνει Check-Out για αυτή την κράτηση.');
        return;
      }
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === reservationId);
      if (!reservation) {
        setCheckoutAlert('Η κράτηση δεν βρέθηκε. Ανανεώστε τη λίστα και δοκιμάστε ξανά.');
        return;
      }
      if (!(reservation as any).vehicle_id) {
        setCheckoutAlert('Δεν έχει επιλεγεί όχημα για αυτή την κράτηση.');
        return;
      }
      const vehicles = await vehicleService.getAll();
      const vehicle = vehicles.find(v => v.id === reservation.vehicle_id);
      if (!vehicle) {
        setCheckoutAlert('Το όχημα της κράτησης δεν βρέθηκε. Το Check-Out δεν επιτρέπεται.');
        return;
      }
      if (vehicle.current_station_id && vehicle.current_station_id !== reservation.pickup_station_id) {
        setCheckoutAlert('Το όχημα βρίσκεται σε διαφορετικό σταθμό από τον σταθμό παραλαβής της κράτησης. Ελέγξτε τον Στόλο.');
        return;
      }
      const documentError = checkoutDocumentError(reservation, vehicle);
      if (documentError) {
        setCheckoutAlert(documentError);
        return;
      }
      // Service is a non-blocking reminder; insurance and KTEO remain mandatory.
      const reasons: string[] = [];
      const requiredDate = String(reservation.return_date || '').slice(0, 10);
      const serviceDate = vehicle.next_service_date || '';
      if (serviceDate && serviceDate < requiredDate) {
        reasons.push(`Προγραμματισμένο service στις ${new Date(serviceDate + 'T00:00:00').toLocaleDateString('el-GR')} (πριν από την επιστροφή του οχήματος).`);
      }
      if (vehicle.next_service_odometer != null && vehicle.odometer != null &&
          vehicle.odometer >= vehicle.next_service_odometer) {
        reasons.push(`Service στα ${vehicle.next_service_odometer.toLocaleString('el-GR')} χλμ. — τρέχοντα ${vehicle.odometer.toLocaleString('el-GR')} χλμ.`);
      }
      if (reasons.length > 0) {
        setServiceWarning({ reservationId, vehicle, contractMissing: !(reservation as any).contract_issued_at, reasons });
        setServiceNewDate(vehicle.next_service_date || '');
        setServiceNewKm(vehicle.next_service_odometer == null ? '' : String(vehicle.next_service_odometer));
        setServiceSaveError('');
        return;
      }
      if (!(reservation as any).contract_issued_at) {
        setPendingCheckout({ reservationId, odometer: vehicle.odometer });
        return;
      }
      setCheckOutVehicleOdometer(vehicle.odometer);
      setCheckOutReservation(reservationId);
    } catch {
      setCheckoutAlert('Αποτυχία φόρτωσης κράτησης. Δοκιμάστε ξανά.');
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    setCheckInError('');
    try {
      const existingCheckin = await checkinService.getByReservationId(reservationId);
      if (existingCheckin) {
        setCheckInError('Έχει ήδη γίνει check-in για αυτή την κράτηση.');
        return;
      }
      const existingCheckout = await checkoutService.getByReservationId(reservationId);
      if (!existingCheckout) {
        setCheckInError('Πρέπει να γίνει πρώτα check-out πριν το check-in.');
        return;
      }
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === reservationId);
      setCheckInVehicleFuelTankCapacity((reservation as any)?.vehicle?.fuel_tank_capacity ?? null);
      setCheckInReservation(reservationId);
    } catch {
      setCheckInError('Αποτυχία φόρτωσης κράτησης.');
    }
  };

  const handleCheckOutComplete = async (data: any) => {
    if (!checkOutReservation || checkOutSubmitting) return;
    setCheckOutSubmitting(true);
    try {
      const existingCheckout = await checkoutService.getByReservationId(checkOutReservation);
      if (existingCheckout) {
        setCheckOutError('Έχει ήδη γίνει check-out για αυτή την κράτηση.');
        setCheckOutReservation(null);
        return;
      }
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === checkOutReservation);
      if (!reservation) throw new Error('Reservation not found');
      if (!reservation.vehicle_id) {
        setCheckOutError('Δεν έχει επιλεγεί όχημα για αυτή την κράτηση.');
        return;
      }
      const vehicles = await vehicleService.getAll();
      const vehicle = vehicles.find(v => v.id === reservation.vehicle_id);
      if (!vehicle) {
        setCheckOutError('Το όχημα της κράτησης δεν βρέθηκε. Το Check-Out δεν επιτρέπεται.');
        return;
      }
      const documentError = checkoutDocumentError(reservation, vehicle);
      if (documentError) {
        setCheckOutError(documentError);
        return;
      }

      await checkoutService.complete({
        reservation_id: checkOutReservation,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        accessories_given: data.accessories_given,
        damages: data.damages,
      });

      setCheckOutReservation(null);
      setReservationRefresh(prev => prev + 1);
    } catch (err) {
      console.error('Check-out save failed:', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('CHECKOUT_DOCUMENTS_INVALID:INSURANCE')) {
        setCheckOutError('Η ασφάλεια δεν καλύπτει ολόκληρη την περίοδο ενοικίασης. Το Check-Out δεν επιτρέπεται.');
      } else if (message.includes('CHECKOUT_DOCUMENTS_INVALID:INSPECTION')) {
        setCheckOutError('Το ΚΤΕΟ δεν καλύπτει ολόκληρη την περίοδο ενοικίασης. Το Check-Out δεν επιτρέπεται.');
      } else if (message.includes('CHECKOUT_DENIED:WRONG_STATION')) {
        setCheckOutError('Το όχημα βρίσκεται σε διαφορετικό σταθμό από τον σταθμό παραλαβής της κράτησης. Ελέγξτε τον Στόλο.');
      } else if (message.includes('CHECKOUT_DOCUMENTS_INVALID:RESERVATION_OR_VEHICLE')) {
        setCheckOutError('Λείπουν ή δεν είναι έγκυρα τα στοιχεία κράτησης ή οχήματος. Το Check-Out δεν επιτρέπεται.');
      } else {
        setCheckOutError('Αποτυχία ολοκλήρωσης Check-Out. Δεν αποθηκεύτηκε μερική συναλλαγή.');
      }
    } finally {
      setCheckOutSubmitting(false);
    }
  };

  const handleCheckInComplete = async (data: any) => {
    if (!checkInReservation || checkInSubmitting) return;
    setCheckInSubmitting(true);
    try {
      const existingCheckin = await checkinService.getByReservationId(checkInReservation);
      if (existingCheckin) {
        setCheckInError('Έχει ήδη γίνει check-in για αυτή την κράτηση.');
        setCheckInReservation(null);
        return;
      }
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === checkInReservation);
      if (!reservation) throw new Error('Reservation not found');

      await checkinService.complete({
        reservation_id: checkInReservation,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        new_damages: data.new_damages,
        additional_charges: data.additional_charges,
      });

      setCheckInReservation(null);
      setReservationRefresh(prev => prev + 1);
    } catch (err) {
      console.error('Check-in save failed:', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('CHECKIN_DENIED:ALREADY_DONE')) {
        setCheckInError('Έχει ήδη πραγματοποιηθεί Check-In για αυτή την κράτηση.');
      } else if (message.includes('CHECKIN_DENIED:NO_CHECKOUT')) {
        setCheckInError('Δεν μπορεί να γίνει Check-In χωρίς προηγούμενο Check-Out.');
      } else if (message.includes('CHECKIN_DENIED:MEASUREMENTS')) {
        setCheckInError('Ελέγξτε τη στάθμη καυσίμου και τα χιλιόμετρα του οχήματος.');
      } else if (message.includes('CHECKIN_DENIED:RESERVATION_STATUS') || message.includes('CHECKIN_DENIED:VEHICLE_STATUS')) {
        setCheckInError('Η κατάσταση της κράτησης ή του οχήματος δεν επιτρέπει Check-In.');
      } else {
        setCheckInError('Αποτυχία ολοκλήρωσης Check-In. Δεν αποθηκεύτηκε μερική συναλλαγή.');
      }
    } finally {
      setCheckInSubmitting(false);
    }
  };

  if (checkoutAlert) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutAlert(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="checkout-alert-title" aria-describedby="checkout-alert-message"
          className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0b2949] p-6 text-white shadow-[0_20px_65px_rgba(0,0,0,0.5)]">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-xl font-bold text-amber-200">!</span>
            <h2 id="checkout-alert-title" className="text-lg font-semibold">Το Check-Out δεν επιτρέπεται</h2>
          </div>
          <p id="checkout-alert-message" className="mb-5 text-sm leading-6 text-blue-100/85">{checkoutAlert}</p>
          <div className="flex justify-end">
            <button type="button" autoFocus onClick={() => setCheckoutAlert(null)}
              className="rounded-xl bg-[#1268f3] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2478ff]">
              Κατάλαβα
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (serviceWarning) {
    return (
      <div className="min-h-screen bg-[#061a35] flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="service-warning-title" className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-[#0b2949] p-6 text-white shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-xl text-amber-200">!</span>
            <h2 id="service-warning-title" className="text-lg font-semibold">Υπενθύμιση service οχήματος</h2>
          </div>
          <p className="mb-3 text-sm text-blue-100/85"><strong className="text-white">{serviceWarning.vehicle.brand} {serviceWarning.vehicle.model} ({serviceWarning.vehicle.plate})</strong></p>
          <div className="mb-4 space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            {serviceWarning.reasons.map((reason, index) => <p key={index}>{reason}</p>)}
          </div>
          <p className="mb-4 text-sm text-blue-100/75">Πρόκειται για προειδοποίηση. Μπορείτε να συνεχίσετε κανονικά το Check-Out. Η ασφάλεια και το ΚΤΕΟ εξακολουθούν να ελέγχονται υποχρεωτικά.</p>
          {user?.role === 'admin' && (
            <div className="mb-5 rounded-xl border border-[#2b5b85]/70 bg-[#071d38]/60 p-4">
              <h3 className="mb-1 text-sm font-semibold text-white">Μετάθεση προγραμματισμένου service (Admin)</h3>
              <p className="mb-3 text-xs text-blue-100/55">Η μετάθεση αλλάζει μόνο τον επόμενο προγραμματισμό, δεν καταγράφει πραγματοποίηση service.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs text-blue-100/80">Νέα ημερομηνία
                  <input type="date" value={serviceNewDate} onChange={e => setServiceNewDate(e.target.value)} disabled={serviceSaving} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#0b2949] p-2 text-sm text-white"/>
                </label>
                <label className="text-xs text-blue-100/80">Επόμενο service (χλμ.)
                  <input type="number" min="0" step="1" value={serviceNewKm} onChange={e => setServiceNewKm(e.target.value)} disabled={serviceSaving} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#0b2949] p-2 text-sm text-white"/>
                </label>
              </div>
              {serviceSaveError && <p role="alert" className="mt-2 text-sm text-red-300">{serviceSaveError}</p>}
              <button type="button" disabled={serviceSaving} onClick={saveServiceReschedule} className="mt-3 rounded-lg border border-[#2b5b85] bg-[#12375d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {serviceSaving ? 'Αποθήκευση...' : 'Αποθήκευση μετάθεσης & συνέχεια'}
              </button>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={serviceSaving} onClick={() => setServiceWarning(null)} className="rounded-xl border border-[#2b5b85] px-4 py-2.5 text-sm font-medium text-blue-100 disabled:opacity-50">Ακύρωση</button>
            <button type="button" disabled={serviceSaving} onClick={continueAfterServiceWarning} className="rounded-xl bg-[#1268f3] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Συνέχεια Check-Out</button>
          </div>
        </section>
      </div>
    );
  }

  // Confirm a missing contract inside the application instead of relying on
  // a native browser confirm, which can be unreliable in embedded previews.
  if (pendingCheckout) {
    return (
      <div className="min-h-screen bg-[#061a35] flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="checkout-contract-warning-title" className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#0b2949] p-6 shadow-2xl">
          <h2 id="checkout-contract-warning-title" className="text-xl font-semibold text-white">Δεν έχει καταγραφεί έκδοση συμβολαίου</h2>
          <p className="mt-3 text-blue-100">Δεν έχει καταγραφεί έκδοση συμβολαίου για αυτή την κράτηση. Θέλεις να συνεχίσεις με το Check-Out;</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setPendingCheckout(null)} className="rounded-xl border border-[#2b5b85] px-5 py-2 font-medium text-white">Ακύρωση</button>
            <button type="button" onClick={() => {
              setCheckOutVehicleOdometer(pendingCheckout.odometer);
              setCheckOutReservation(pendingCheckout.reservationId);
              setPendingCheckout(null);
            }} className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white">Συνέχεια στο Check-Out</button>
          </div>
        </div>
      </div>
    );
  }

  // Show check-out form
  if (checkOutReservation) {
    return (
      <div className="min-h-screen bg-[#061a35]">
        <Header />
        <div className="py-4 sm:py-8">
          {checkOutError && (
            <div className="max-w-4xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {checkOutError}
            </div>
          )}
          <CheckOutForm
            reservationId={checkOutReservation}
            vehicleOdometer={checkOutVehicleOdometer}
            onComplete={handleCheckOutComplete}
            onCancel={() => setCheckOutReservation(null)}
            submitting={checkOutSubmitting}
          />
        </div>
      </div>
    );
  }

  // Show check-in form
  if (checkInReservation) {
    return (
      <div className="min-h-screen bg-[#061a35]">
        <Header />
        <div className="py-4 sm:py-8">
          {checkInError && (
            <div className="max-w-4xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {checkInError}
            </div>
          )}
          <CheckInForm
            reservationId={checkInReservation}
            vehicleFuelTankCapacity={checkInVehicleFuelTankCapacity}
            onComplete={handleCheckInComplete}
            onCancel={() => setCheckInReservation(null)}
            submitting={checkInSubmitting}
          />
        </div>
      </div>
    );
  }

  // Show booking wizard
  if (showBookingWizard) {
    return (
      <div className="min-h-screen bg-[#061a35]">
        <Header />
        <div className="py-4 sm:py-8">
          <BookingWizard
            onComplete={() => {
              setShowBookingWizard(false);
              setActiveTab('bookings');
              setReservationRefresh(prev => prev + 1);
            }}
          />
          <div className="mx-auto mt-4 max-w-4xl">
            <button
              onClick={() => setShowBookingWizard(false)}
              className="rounded-lg px-4 py-2 text-sm text-blue-100/65 transition-colors hover:text-white"
            >
              ← Επιστροφή στις κρατήσεις
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const effectiveRole = user?.role === 'admin' ? previewRole : user?.role;
    const effectiveTab = isTabAllowed(effectiveRole, activeTab) && (user?.role !== 'manager' || managerTabs.includes(activeTab)) ? activeTab : 'dashboard';
    switch (effectiveTab) {
      case 'dashboard':
        return <DashboardPage onNavigateReservations={(f) => { setReservationsInitialFilter(f); setActiveTab('bookings'); }} onNavigateFleet={() => { setFleetInitialFilter('all'); setActiveTab('fleet'); }} onNavigateVehicle={(vehicleId) => { setFleetEditVehicleId(vehicleId); setFleetInitialFilter('all'); setActiveTab('fleet'); }} onNewBooking={() => setShowBookingWizard(true)} />;
      case 'bookings':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">{t('bookings')}</h1>
              <button
                onClick={() => setShowBookingWizard(true)}
                className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
              >
                {t('newBooking')}
              </button>
            </div>
            <ReservationsList
              onCheckOut={handleCheckOut}
              onCheckIn={handleCheckIn}
              refreshTrigger={reservationRefresh}
              initialFilter={reservationsInitialFilter}
              initialViewReservationId={viewReservationId}
            />
          </div>
        );
      case 'customers':
        return <CustomerManagement onViewReservation={(reservationId) => { setViewReservationId(reservationId); setActiveTab('bookings'); }} />;
      case 'fleet':
        return <FleetManagement initialFilter={fleetInitialFilter} editVehicleId={fleetEditVehicleId} onEditVehicleConsumed={() => setFleetEditVehicleId(null)} />;
      case 'pricing':
        return <PricingManagement />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#061a35]">
      <Header onToggleSidebar={toggleMobileSidebar} previewRole={previewRole} onPreviewRoleChange={(role) => { setPreviewRole(role); setActiveTab('dashboard'); }} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
          previewRole={user?.role === 'admin' ? previewRole : undefined}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(22,104,243,0.09),transparent_36%),#061a35] p-4 sm:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default MainApp;