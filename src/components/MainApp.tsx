import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { reservationService, vehicleService, checkoutService, checkinService } from '../lib/database';
import { checkoutDocumentError } from '../lib/vehicleDocuments';
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
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [checkOutReservation, setCheckOutReservation] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{ reservationId: string; odometer?: number } | null>(null);
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
        setCheckOutError('Έχει ήδη γίνει check-out για αυτή την κράτηση.');
        return;
      }
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === reservationId);
      if (!reservation) return;
      if (!(reservation as any).vehicle_id) {
        window.alert('Δεν έχει επιλεγεί όχημα για αυτή την κράτηση.');
        return;
      }
      const vehicles = await vehicleService.getAll();
      const vehicle = vehicles.find(v => v.id === reservation.vehicle_id);
      if (!vehicle) {
        window.alert('Το όχημα της κράτησης δεν βρέθηκε. Το Check-Out δεν επιτρέπεται.');
        return;
      }
      if (vehicle.current_station_id && vehicle.current_station_id !== reservation.pickup_station_id) {
        window.alert('Το όχημα βρίσκεται σε διαφορετικό σταθμό από τον σταθμό παραλαβής της κράτησης. Ελέγξτε τον Στόλο.');
        return;
      }
      const documentError = checkoutDocumentError(reservation, vehicle);
      if (documentError) {
        window.alert(documentError);
        return;
      }
      if (!(reservation as any).contract_issued_at) {
        setPendingCheckout({ reservationId, odometer: vehicle.odometer });
        return;
      }
      setCheckOutVehicleOdometer(vehicle.odometer);
      setCheckOutReservation(reservationId);
    } catch {
      setCheckOutError('Αποτυχία φόρτωσης κράτησης.');
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
    const effectiveTab = isTabAllowed(user?.role, activeTab) ? activeTab : 'dashboard';
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
      <Header onToggleSidebar={toggleMobileSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(22,104,243,0.09),transparent_36%),#061a35] p-4 sm:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default MainApp;