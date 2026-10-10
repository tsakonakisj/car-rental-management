import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { customerService } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import type { Customer } from '../../types';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  XMarkIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

interface CustomerReservation {
  id: string;
  pickup_date: string;
  return_date: string;
  status: string;
  total_amount: number;
  vehicle: { plate: string; brand: string; model: string } | null;
}

const CustomerManagement: React.FC = () => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerReservations, setCustomerReservations] = useState<CustomerReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError('Αποτυχία φόρτωσης πελατών.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCustomerModal = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerReservations([]);
    if (!supabase) return;
    setLoadingReservations(true);
    const { data } = await supabase
      .from('reservations')
      .select(`id, pickup_date, return_date, status, total_amount, vehicle:vehicles(plate, brand, model)`)
      .eq('customer_id', customer.id)
      .order('pickup_date', { ascending: false });
    setCustomerReservations((data as CustomerReservation[]) || []);
    setLoadingReservations(false);
  };

  const formatGreekDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getReservationStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ενεργή';
      case 'upcoming': return 'Επερχόμενη';
      case 'completed': return 'Ολοκληρωμένη';
      case 'cancelled': return 'Ακυρωμένη';
      default: return status;
    }
  };

  const getReservationStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
      case 'upcoming': return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40';
      case 'completed': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40';
      case 'cancelled': return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
      default: return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'walk-in': return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
      case 'phone': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40';
      case 'instagram': return 'bg-pink-500/15 text-pink-300 ring-1 ring-inset ring-pink-400/40';
      default: return 'bg-slate-500/15 text-blue-100/70 ring-1 ring-inset ring-slate-400/35';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'walk-in': return 'Κατάστημα';
      case 'phone': return 'Τηλέφωνο';
      case 'instagram': return 'Instagram';
      default: return source || '-';
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="mr-3 h-6 w-6 animate-spin text-[#55a8ff]" />
        <span className="text-blue-100/65">Φόρτωση πελατών...</span>
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="py-12 text-center">
        <XMarkIcon className="mx-auto mb-4 h-12 w-12 text-red-300" />
        <p className="mb-4 text-red-100">{error}</p>
        <button
          onClick={fetchCustomers}
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
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">{t('customers')}</h1>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#72b9ff]" />
          <input
            type="text"
            placeholder="Αναζήτηση πελάτη..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-blue-100/45 focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
      </div>

      {/* Empty state */}
      {filteredCustomers.length === 0 && (
        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/85 py-14 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <UsersIcon className="mx-auto mb-4 h-12 w-12 text-blue-100/45" />
          <p className="text-blue-100/55">
            {customers.length === 0
              ? 'Δεν υπάρχουν πελάτες ακόμα. Θα εμφανιστούν εδώ μετά την πρώτη κράτηση.'
              : 'Δεν βρέθηκαν πελάτες με αυτή την αναζήτηση.'}
          </p>
        </div>
      )}

      {/* Customers Grid */}
      {filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)]">
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <UsersIcon className="mr-3 h-8 w-8 text-blue-100/45" />
                    <div>
                      <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">{customer.name}</h3>
                      <p className="text-sm text-blue-100/65">{customer.country || '-'}</p>
                    </div>
                  </div>
                  {customer.source && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSourceColor(customer.source)}`}>
                      {getSourceLabel(customer.source)}
                    </span>
                  )}
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex items-center text-sm text-blue-100/65">
                    <PhoneIcon className="mr-2 h-4 w-4 text-[#72b9ff]" />
                    {customer.phone || '-'}
                  </div>
                  <div className="flex items-center text-sm text-blue-100/65">
                    <EnvelopeIcon className="mr-2 h-4 w-4 text-[#72b9ff]" />
                    {customer.email || '-'}
                  </div>
                  {customer.license_number && (
                    <div className="text-sm text-blue-100/65">
                      <span className="font-medium">Άδεια:</span> {customer.license_number}
                    </div>
                  )}
                </div>

                {customer.notes && (
                  <div className="mb-4 rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/60 p-3">
                    <p className="text-sm text-blue-100/85">{customer.notes}</p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => openCustomerModal(customer)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                  >
                    <EyeIcon className="mr-1 h-4 w-4" />
                    Προβολή
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-[#020b18]/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedCustomer(null)} />
            <div className="relative z-10 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#1e4e7d]/70 bg-[#071d38] shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e4e7d]/70 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Στοιχεία Πελάτη</h2>
                <button onClick={() => setSelectedCustomer(null)} className="text-blue-100/45 transition-colors hover:text-blue-100/75">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-blue-100/55">Όνομα</p>
                    <p className="text-sm font-medium text-white">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Χώρα</p>
                    <p className="text-sm text-blue-50">{selectedCustomer.country || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Τηλέφωνο</p>
                    <p className="text-sm text-blue-50">{selectedCustomer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Email</p>
                    <p className="text-sm text-blue-50">{selectedCustomer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Αρ. Άδειας</p>
                    <p className="text-sm text-blue-50">{selectedCustomer.license_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Ημ. Γέννησης</p>
                    <p className="text-sm text-blue-50">{selectedCustomer.birth_date ? formatGreekDate(selectedCustomer.birth_date) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-100/55">Πηγή</p>
                    <p className="text-sm text-blue-50">{getSourceLabel(selectedCustomer.source)}</p>
                  </div>
                </div>
                {selectedCustomer.notes && (
                  <div>
                    <p className="mb-1 text-xs text-blue-100/55">Σημειώσεις</p>
                    <p className="rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/60 p-3 text-sm text-blue-100/85">{selectedCustomer.notes}</p>
                  </div>
                )}

                {/* Reservation History */}
                <div className="border-t border-[#1e4e7d]/70 pt-4">
                  <h3 className="mb-3 flex items-center text-sm font-medium text-blue-100/85">
                    <CalendarDaysIcon className="mr-1.5 h-4 w-4 text-[#72b9ff]" />
                    Ιστορικό Κρατήσεων
                  </h3>
                  {loadingReservations ? (
                    <p className="py-3 text-center text-sm text-blue-100/45">Φόρτωση...</p>
                  ) : customerReservations.length === 0 ? (
                    <p className="py-3 text-center text-sm text-blue-100/45">Δεν υπάρχουν κρατήσεις.</p>
                  ) : (
                    <div className="space-y-2">
                      {customerReservations.map(r => (
                        <div key={r.id} className="rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/50 p-3 text-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-white">
                              {r.vehicle ? `${r.vehicle.plate} - ${r.vehicle.brand} ${r.vehicle.model}` : '-'}
                            </span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getReservationStatusColor(r.status)}`}>
                              {getReservationStatusLabel(r.status)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-blue-100/55">
                            <span>{formatGreekDate(r.pickup_date)} - {formatGreekDate(r.return_date)}</span>
                            <span className="font-medium text-emerald-300">{Number(r.total_amount).toFixed(2)}&euro;</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end border-t border-[#1e4e7d]/70 px-6 py-4">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                >
                  Κλείσιμο
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
