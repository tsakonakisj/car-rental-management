import React, { useState } from 'react';
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

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [checkOutReservation, setCheckOutReservation] = useState<string | null>(null);
  const [checkInReservation, setCheckInReservation] = useState<string | null>(null);
  const [reservationRefresh, setReservationRefresh] = useState(0);
  const [checkOutError, setCheckOutError] = useState('');
  const [checkInError, setCheckInError] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Φόρτωση...</p>
        </div>
      </div>
    );
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
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="py-8">
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
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="py-8">
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
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="py-8">
          <BookingWizard
            onComplete={() => {
              setShowBookingWizard(false);
              setActiveTab('bookings');
              setReservationRefresh(prev => prev + 1);
            }}
          />
          <div className="max-w-4xl mx-auto mt-4">
            <button
              onClick={() => setShowBookingWizard(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
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
        return <DashboardPage />;
      case 'bookings':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900">{t('bookings')}</h1>
              <button
                onClick={() => setShowBookingWizard(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                {t('newBooking')}
              </button>
            </div>
            <ReservationsList
              onCheckOut={handleCheckOut}
              onCheckIn={handleCheckIn}
              refreshTrigger={reservationRefresh}
            />
          </div>
        );
      case 'customers':
        return <CustomerManagement />;
      case 'fleet':
        return <FleetManagement />;
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
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default MainApp;