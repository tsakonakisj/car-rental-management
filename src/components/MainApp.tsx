import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { reservationService, vehicleService, checkoutService, checkinService } from '../lib/database';
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
  const [checkInReservation, setCheckInReservation] = useState<string | null>(null);
  const [reservationRefresh, setReservationRefresh] = useState(0);
  const [checkOutError, setCheckOutError] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [reservationsInitialFilter, setReservationsInitialFilter] = useState<string>('all');
  const [fleetInitialFilter, setFleetInitialFilter] = useState<'active' | 'inactive' | 'all'>('active');

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
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === reservationId);
      if (!reservation) return;
      if (!(reservation as any).vehicle_id) {
        alert('Δεν έχει επιλεγεί όχημα για αυτή την κράτηση');
        return;
      }
      setCheckOutReservation(reservationId);
    } catch {
      setCheckOutError('Αποτυχία φόρτωσης κράτησης.');
    }
  };

  const handleCheckIn = (reservationId: string) => {
    setCheckInReservation(reservationId);
  };

  const handleCheckOutComplete = async (data: any) => {
    if (!checkOutReservation) return;
    try {
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === checkOutReservation);
      if (!reservation) throw new Error('Reservation not found');

      // Αποθήκευση checkout δεδομένων στη βάση
      await checkoutService.create({
        reservation_id: checkOutReservation,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        accessories_given: data.accessories_given,
        damages: data.damages,
        checked_out_by: user?.id,
      });

      await reservationService.update(checkOutReservation, { status: 'active' });

      if ((reservation as any).vehicle_id) {
        await vehicleService.update((reservation as any).vehicle_id, { status: 'rented' });
      }

      setCheckOutReservation(null);
      setReservationRefresh(prev => prev + 1);
    } catch (err) {
      console.error('Check-out save failed:', err);
      setCheckOutError('Αποτυχία ολοκλήρωσης check-out.');
    }
  };

  const handleCheckInComplete = async (data: any) => {
    if (!checkInReservation) return;
    try {
      const allReservations = await reservationService.getAll();
      const reservation = allReservations.find((r: any) => r.id === checkInReservation);
      if (!reservation) throw new Error('Reservation not found');

      // Αποθήκευση checkin δεδομένων στη βάση
      await checkinService.create({
        reservation_id: checkInReservation,
        fuel_level: data.fuel_level,
        odometer: data.odometer,
        new_damages: data.new_damages,
        additional_charges: data.additional_charges,
        checked_in_by: user?.id,
      });

      await reservationService.update(checkInReservation, { status: 'completed' });

      if ((reservation as any).vehicle_id) {
        await vehicleService.update((reservation as any).vehicle_id, { status: 'available' });
      }

      setCheckInReservation(null);
      setReservationRefresh(prev => prev + 1);
    } catch (err) {
      console.error('Check-in save failed:', err);
      setCheckInError('Αποτυχία ολοκλήρωσης check-in.');
    }
  };

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
            onComplete={handleCheckOutComplete}
            onCancel={() => setCheckOutReservation(null)}
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
            onComplete={handleCheckInComplete}
            onCancel={() => setCheckInReservation(null)}
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
        return <DashboardPage onNavigateReservations={(f) => { setReservationsInitialFilter(f); setActiveTab('bookings'); }} onNavigateFleet={() => { setFleetInitialFilter('all'); setActiveTab('fleet'); }} onNewBooking={() => setShowBookingWizard(true)} />;
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
            />
          </div>
        );
      case 'customers':
        return <CustomerManagement />;
      case 'fleet':
        return <FleetManagement initialFilter={fleetInitialFilter} />;
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
    <div className="min-h-screen overflow-x-hidden bg-[#061a35]">
      <Header onToggleSidebar={toggleMobileSidebar} />
      <div className="flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
        />
        <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(22,104,243,0.09),transparent_36%),#061a35] p-4 sm:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default MainApp;