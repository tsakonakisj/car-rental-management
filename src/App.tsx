import React from 'react';
import { useState } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { company } from './lib/company';
import ReservationsList from './components/Reservations/ReservationsList';
import BookingWizard from './components/Booking/BookingWizard';
import CustomerManagement from './components/Customers/CustomerManagement';
import FleetManagement from './components/Fleet/FleetManagement';
import DashboardPage from './components/Dashboard/DashboardPage';
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  TruckIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CameraIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [reservationRefresh, setReservationRefresh] = useState(0);




  const users = [
    {
      id: '1',
      email: `admin@${company.email.split('@')[1]}`,
      name: 'Διαχειριστής Συστήματος',
      role: 'admin',
      active: true,
      last_login: '2025-01-15T10:30:00',
      created_at: '2024-01-01T00:00:00'
    },
    {
      id: '2',
      email: `manager@${company.email.split('@')[1]}`,
      name: 'Μάνατζερ Καταστήματος',
      role: 'manager',
      active: true,
      last_login: '2025-01-15T09:15:00',
      created_at: '2024-02-15T00:00:00'
    }
  ];

  const menuItems = [
    { id: 'dashboard', label: 'Κεντρικό Ταμπλό', icon: HomeIcon },
    { id: 'bookings', label: 'Κρατήσεις', icon: CalendarDaysIcon },
    { id: 'customers', label: 'Πελάτες', icon: UsersIcon },
    { id: 'fleet', label: 'Στόλος', icon: TruckIcon },
    { id: 'pricing', label: 'Τιμές & Σεζόν', icon: CurrencyEuroIcon },
    { id: 'reports', label: 'Αναφορές', icon: ChartBarIcon },
    { id: 'users', label: 'Χρήστες', icon: UserGroupIcon },
    { id: 'settings', label: 'Ρυθμίσεις', icon: CogIcon },
  ];



  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'agent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {company.name}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Σύστημα Διαχείρισης Κρατήσεων
            </p>
          </div>
          
          <div className="mt-8 space-y-6">
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  type="email"

                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <input
                  type="password"

                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Κωδικός πρόσβασης"
                />
              </div>
            </div>

            <div>
              <button
                onClick={() => setIsLoggedIn(true)}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Σύνδεση
              </button>
            </div>
            

          </div>
        </div>
      </div>
    );
  }

  // Booking Wizard
  if (showBookingWizard) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-blue-600">{company.name}</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Demo User</span>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Αποσύνδεση
                </button>
              </div>
            </div>
          </div>
        </header>

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

  // Check-out Form
  if (showCheckOut) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-blue-600">{company.name}</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Demo User</span>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Αποσύνδεση
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Check-out Οχήματος</h2>
              </div>

              <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Επίπεδο Καυσίμου (%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue="100"
                      className="w-full"
                    />
                    <p className="text-center mt-2 font-medium">100%</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Χιλιόμετρα
                    </label>
                    <input
                      type="number"
                      defaultValue="45000"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Φωτογραφίες Οχήματος
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <CameraIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Μπροστά</span>
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <CameraIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Πίσω</span>
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <CameraIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Αριστερά</span>
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <CameraIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Δεξιά</span>
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Αξεσουάρ που Δόθηκαν
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Παιδικό Κάθισμα', 'GPS', 'Φορτιστής Κινητού', 'Αλυσίδες Χιονιού', 'Τρίγωνο', 'Φαρμακείο'].map((accessory) => (
                      <label key={accessory} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{accessory}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCheckOut(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Ακύρωση
                </button>
                <button
                  onClick={() => {
                    alert('Check-out ολοκληρώθηκε επιτυχώς!');
                    setShowCheckOut(false);
                  }}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Ολοκλήρωση Check-out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check-in Form
  if (showCheckIn) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-blue-600">{company.name}</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Demo User</span>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Αποσύνδεση
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Check-in Οχήματος</h2>
              </div>

              <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Επίπεδο Καυσίμου Επιστροφής (%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue="75"
                      className="w-full"
                    />
                    <p className="text-center mt-2 font-medium">75%</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Χιλιόμετρα Επιστροφής
                    </label>
                    <input
                      type="number"
                      defaultValue="45350"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Επιπλέον Χρεώσεις
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">Καύσιμο (25% έλλειψη)</span>
                        <p className="text-xs text-gray-600">25 λίτρα x €1.50</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600">€37.50</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Σύνολο Επιπλέον Χρεώσεων:</span>
                    <span className="text-xl font-bold text-red-600">€37.50</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCheckIn(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Ακύρωση
                </button>
                <button
                  onClick={() => {
                    alert('Check-in ολοκληρώθηκε επιτυχώς!');
                    setShowCheckIn(false);
                  }}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  Ολοκλήρωση Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600">{company.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <select className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </select>
              <span className="text-gray-700">Demo User</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                manager
              </span>
              <button
                onClick={() => setIsLoggedIn(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Αποσύνδεση
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 min-h-screen border-r border-gray-200">
          <nav className="mt-6 px-3">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`${
                      activeTab === item.id
                        ? 'bg-blue-50 border-r-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeTab === 'dashboard' && (
            <DashboardPage />
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Κρατήσεις</h1>
                <button
                  onClick={() => setShowBookingWizard(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Νέα Κράτηση
                </button>
              </div>
              <ReservationsList refreshTrigger={reservationRefresh} />
            </div>
          )}

          {activeTab === 'customers' && (
            <CustomerManagement />
          )}

          {activeTab === 'fleet' && (
            <FleetManagement />
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Τιμές & Σεζόν</h1>
              </div>

              {/* Seasons */}
              <div className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Σεζόν</h2>
                    <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Νέα Σεζόν
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'Low Season', start: '01/11/2024', end: '31/03/2025', multiplier: 1.0 },
                      { name: 'Mid Season', start: '01/04/2025', end: '31/05/2025', multiplier: 1.3 },
                      { name: 'High Season', start: '01/06/2025', end: '30/09/2025', multiplier: 1.8 }
                    ].map((season, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900">{season.name}</h3>
                          <span className="text-sm font-medium text-blue-600">x{season.multiplier}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-3">
                          <CalendarDaysIcon className="h-4 w-4 mr-1" />
                          {season.start} - {season.end}
                        </div>
                        <div className="flex space-x-2">
                          <button className="flex-1 inline-flex items-center justify-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                            <PencilIcon className="h-3 w-3 mr-1" />
                            Επεξεργασία
                          </button>
                          <button className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50">
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pricing Matrix */}
              <div className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Τιμές ανά Κατηγορία & Σεζόν</h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 text-sm font-medium text-gray-500">Κατηγορία</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">Low Season</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">Mid Season</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">High Season</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          { category: 'A', base: 25 },
                          { category: 'B', base: 35 },
                          { category: 'C', base: 45 },
                          { category: 'SUV', base: 65 },
                          { category: '7-seater', base: 85 }
                        ].map((cat) => (
                          <tr key={cat.category}>
                            <td className="py-4 text-sm font-medium text-gray-900">{cat.category}</td>
                            <td className="text-center py-4">
                              <div className="inline-flex items-center">
                                <CurrencyEuroIcon className="h-4 w-4 text-green-600 mr-1" />
                                <span className="text-sm font-medium text-gray-900">{cat.base}</span>
                                <span className="text-xs text-gray-500 ml-1">/ημέρα</span>
                              </div>
                            </td>
                            <td className="text-center py-4">
                              <div className="inline-flex items-center">
                                <CurrencyEuroIcon className="h-4 w-4 text-green-600 mr-1" />
                                <span className="text-sm font-medium text-gray-900">{Math.round(cat.base * 1.3)}</span>
                                <span className="text-xs text-gray-500 ml-1">/ημέρα</span>
                              </div>
                            </td>
                            <td className="text-center py-4">
                              <div className="inline-flex items-center">
                                <CurrencyEuroIcon className="h-4 w-4 text-green-600 mr-1" />
                                <span className="text-sm font-medium text-gray-900">{Math.round(cat.base * 1.8)}</span>
                                <span className="text-xs text-gray-500 ml-1">/ημέρα</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Extras */}
              <div className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Έξτρα</h2>
                    <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Νέο Έξτρα
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: 'Παιδικό Κάθισμα', nameEn: 'Child Seat', price: 5, type: 'daily' },
                      { name: 'Δεύτερος Οδηγός', nameEn: 'Additional Driver', price: 25, type: 'one-time' },
                      { name: 'GPS Πλοήγηση', nameEn: 'GPS Navigation', price: 8, type: 'daily' },
                      { name: 'Φορτιστής Κινητού', nameEn: 'Phone Charger', price: 3, type: 'daily' }
                    ].map((extra, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">{extra.name}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            extra.type === 'daily' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {extra.type === 'daily' ? 'Ημερήσιο' : 'Εφάπαξ'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{extra.nameEn}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold text-green-600">
                            €{extra.price}/{extra.type === 'daily' ? 'ημέρα' : 'εφάπαξ'}
                          </div>
                          <div className="flex space-x-2">
                            <button className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                              <PencilIcon className="h-3 w-3 mr-1" />
                              Επεξεργασία
                            </button>
                            <button className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50">
                              <TrashIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Αναφορές</h1>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      defaultValue="2025-01-08"
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">έως</span>
                    <input
                      type="date"
                      defaultValue="2025-01-15"
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Daily Sales Report */}
              <div className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Ημερήσιες Πωλήσεις</h2>
                    <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Εξαγωγή CSV
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 text-sm font-medium text-gray-500">Ημερομηνία</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">Κρατήσεις</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">Έσοδα</th>
                          <th className="text-center py-3 text-sm font-medium text-gray-500">Μέσο Έσοδο</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          { date: '10/01/2025', reservations: 8, revenue: 1240, avg: 155 },
                          { date: '11/01/2025', reservations: 12, revenue: 1850, avg: 154 },
                          { date: '12/01/2025', reservations: 6, revenue: 920, avg: 153 },
                          { date: '13/01/2025', reservations: 15, revenue: 2100, avg: 140 },
                          { date: '14/01/2025', reservations: 10, revenue: 1560, avg: 156 }
                        ].map((day, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-4 text-sm font-medium text-gray-900">{day.date}</td>
                            <td className="text-center py-4">
                              <div className="inline-flex items-center">
                                <CalendarDaysIcon className="h-4 w-4 text-blue-600 mr-1" />
                                <span className="text-sm font-medium">{day.reservations}</span>
                              </div>
                            </td>
                            <td className="text-center py-4">
                              <div className="inline-flex items-center">
                                <CurrencyEuroIcon className="h-4 w-4 text-green-600 mr-1" />
                                <span className="text-sm font-medium text-green-600">€{day.revenue}</span>
                              </div>
                            </td>
                            <td className="text-center py-4">
                              <span className="text-sm text-gray-600">€{day.avg}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Channel Performance */}
              <div className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Έσοδα ανά Κανάλι</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { channel: 'Κατάστημα', reservations: 25, revenue: 3850, percentage: 45, color: 'bg-blue-500' },
                      { channel: 'Τηλέφωνο', reservations: 18, revenue: 2940, percentage: 35, color: 'bg-green-500' },
                      { channel: 'Instagram', reservations: 8, revenue: 1680, percentage: 20, color: 'bg-purple-500' }
                    ].map((channel, index) => (
                      <div key={index} className="text-center">
                        <div className="mb-4">
                          <div className={`w-16 h-16 ${channel.color} rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold`}>
                            {channel.percentage}%
                          </div>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{channel.channel}</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">{channel.reservations} κρατήσεις</p>
                          <p className="text-lg font-semibold text-green-600">€{channel.revenue}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Χρήστες</h1>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Νέος Χρήστης
                </button>
              </div>

              {/* Users Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {users.map((user) => (
                  <div key={user.id} className="bg-white shadow-sm rounded-lg">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <UserGroupIcon className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                            <p className="text-sm text-gray-600">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role === 'admin' ? 'Διαχειριστής' : 
                             user.role === 'manager' ? 'Μάνατζερ' : 'Πράκτορας'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ενεργός
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Δικαιώματα:</h4>
                        <div className="flex flex-wrap gap-1">
                          {user.role === 'admin' ? 
                            ['Πλήρη δικαιώματα', 'Διαχείριση χρηστών', 'Ρυθμίσεις συστήματος'].map((perm, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                                {perm}
                              </span>
                            )) :
                            ['Κρατήσεις', 'Αναφορές', 'Τιμές & Σεζόν', 'Στόλος'].map((perm, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                                {perm}
                              </span>
                            ))
                          }
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                          <span className="text-gray-500">Δημιουργήθηκε:</span>
                          <p className="font-medium">01/01/2024</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Τελευταία σύνδεση:</span>
                          <p className="font-medium">15/01/2025</p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Προβολή
                        </button>
                        <button className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                          <PencilIcon className="h-4 w-4 mr-1" />
                          Επεξεργασία
                        </button>
                        <button className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Ρυθμίσεις</h1>
              </div>

              <div className="bg-white shadow-sm rounded-lg">
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8 px-6" aria-label="Tabs">
                    {[
                      { id: 'company', label: 'Εταιρικά Στοιχεία' },
                      { id: 'stations', label: 'Σταθμοί' },
                      { id: 'financial', label: 'Οικονομικά' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className="border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Επωνυμία Εταιρείας
                        </label>
                        <input
                          type="text"
                          defaultValue={company.name}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ΑΦΜ
                        </label>
                        <input
                          type="text"
                          defaultValue="123456789"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Διεύθυνση
                        </label>
                        <input
                          type="text"
                          defaultValue="Πλατανιάς, Χανιά, Κρήτη"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Τηλέφωνο
                        </label>
                        <input
                          type="text"
                          defaultValue={company.phone}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          defaultValue={company.email}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                    <CogIcon className="h-4 w-4 mr-2" />
                    Αποθήκευση Ρυθμίσεων
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;