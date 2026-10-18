import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { customerService } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PageHero from '../Layout/PageHero';
import type { Customer } from '../../types';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  XMarkIcon,
  CalendarDaysIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface CustomerReservation {
  id: string;
  pickup_date: string;
  return_date: string;
  status: string;
  total_amount: number;
  vehicle: { plate: string; brand: string; model: string } | null;
}

interface CustomerManagementProps {
  onViewReservation?: (reservationId: string) => void;
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onViewReservation }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [customerRights, setCustomerRights] = useState({ create: false, edit: false, delete: false });
  const canCreate = user?.role === 'admin' || (user?.role === 'manager' && customerRights.create);
  const canEdit = user?.role === 'admin' || (user?.role === 'manager' && customerRights.edit);
  const mayDeleteCustomer = user?.role === 'admin' || (user?.role === 'manager' && customerRights.delete);

  useEffect(() => {
    setCustomerRights({ create: false, edit: false, delete: false });
    if (user?.role !== 'manager') return;
    let active = true;
    supabase.from('employee_permissions').select('permissions').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        const p = data?.permissions as { customers?: { create?: boolean; edit?: boolean; delete?: boolean } } | undefined;
        setCustomerRights({
          create: p?.customers?.create === true,
          edit: p?.customers?.edit === true,
          delete: p?.customers?.delete === true,
        });
      });
    return () => { active = false; };
  }, [user?.id, user?.role]);

  type CustomerForm = { name: string; phone: string; email: string; country: string; license_number: string; birth_date: string; notes: string; source: Customer['source'] };
  const blankCustomer: CustomerForm = { name: '', phone: '', email: '', country: '', license_number: '', birth_date: '', notes: '', source: 'store' };
  const [customerFormMode, setCustomerFormMode] = useState<'create' | 'edit' | null>(null);
  const [customerFormTarget, setCustomerFormTarget] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(blankCustomer);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerFormError, setCustomerFormError] = useState('');

  const openCreateCustomer = () => {
    if (!canCreate) return;
    setCustomerForm({ ...blankCustomer });
    setCustomerFormTarget(null);
    setCustomerFormError('');
    setCustomerFormMode('create');
  };
  const openEditCustomer = (customer: Customer) => {
    if (!canEdit) return;
    setSelectedCustomer(null);
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      country: customer.country || '',
      license_number: customer.license_number || '',
      birth_date: customer.birth_date || '',
      notes: customer.notes || '',
      source: customer.source || 'store',
    });
    setCustomerFormTarget(customer.id);
    setCustomerFormError('');
    setCustomerFormMode('edit');
  };
  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingCustomer || (customerFormMode === 'create' ? !canCreate : !canEdit)) return;
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      setCustomerFormError('Συμπληρώστε όνομα και τηλέφωνο.');
      return;
    }
    setSavingCustomer(true);
    setCustomerFormError('');
    try {
      const payload = {
        name: customerForm.name.trim(), phone: customerForm.phone.trim(),
        email: customerForm.email.trim() || null,
        country: customerForm.country.trim() || null,
        license_number: customerForm.license_number.trim() || null,
        birth_date: customerForm.birth_date || null,
        notes: customerForm.notes.trim() || null,
        source: customerForm.source,
      };
      if (customerFormMode === 'create') {
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
      } else {
        if (!customerFormTarget) throw new Error('Δεν επιλέχθηκε πελάτης.');
        const { error } = await supabase.from('customers').update(payload).eq('id', customerFormTarget).select('id').single();
        if (error) throw error;
      }
      setCustomerFormMode(null);
      setCustomerFormTarget(null);
      await fetchCustomers();
    } catch (err) {
      console.error('Failed to save customer:', err);
      setCustomerFormError('Η αποθήκευση απέτυχε. Ελέγξτε τα στοιχεία ή τα δικαιώματά σας.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dragCustomerId, setDragCustomerId] = useState<string | null>(null);
  const [savingCustomerOrder, setSavingCustomerOrder] = useState(false);
  const [customerOrderError, setCustomerOrderError] = useState('');
  const skipNextCardClick = React.useRef(false);
  const canReorderCustomers = user?.role === 'admin' && searchTerm.trim() === '';

  const reorderCustomers = async (sourceId: string, targetId: string) => {
    if (!canReorderCustomers || savingCustomerOrder || sourceId === targetId) return;
    const before = [...customers];
    const next = [...customers];
    const from = next.findIndex(c => c.id === sourceId);
    const to = next.findIndex(c => c.id === targetId);
    if (from === -1 || to === -1) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    setCustomers(next);
    setCustomerOrderError('');
    setSavingCustomerOrder(true);
    try {
      const { error } = await supabase.rpc('reorder_customer_cards', { p_ids: next.map(c => c.id) });
      if (error) throw error;
    } catch (error) {
      setCustomers(before);
      setCustomerOrderError('Η νέα σειρά δεν αποθηκεύτηκε. Κάντε ανανέωση και δοκιμάστε ξανά.');
      console.error('Failed to save customer order:', error);
    } finally {
      setSavingCustomerOrder(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerReservations, setCustomerReservations] = useState<CustomerReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteReservationCount, setDeleteReservationCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await customerService.getAll();
      setCustomers([...data].sort((a, b) => {
        const x = (a as Customer & { display_order?: number | null }).display_order;
        const y = (b as Customer & { display_order?: number | null }).display_order;
        if (x == null && y == null) return (b.created_at || '').localeCompare(a.created_at || '');
        if (x == null) return 1;
        if (y == null) return -1;
        return x - y;
      }));
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

  const openDeleteConfirm = async (customer: Customer) => {
    if (!mayDeleteCustomer) return;
    setDeleteTarget(customer);
    setDeleteConfirmText('');
    setDeleteReservationCount(null);
    setDeleteError('');
    setDeleteConfirmOpen(true);
    try {
      setDeleteReservationCount(await customerService.getReservationCount(customer.id));
    } catch (err) {
      console.error('Failed to check customer reservations:', err);
      setDeleteError('Δεν ήταν δυνατός ο έλεγχος των κρατήσεων του πελάτη.');
    }
  };

  const handleDelete = async () => {
    if (!mayDeleteCustomer || !deleteTarget || deleteReservationCount !== 0) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await customerService.delete(deleteTarget.id);
      await fetchCustomers();
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setDeleteError('Αποτυχία διαγραφής πελάτη.');
    } finally {
      setDeleting(false);
    }
  };

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
      <PageHero
        title={t('customers')}
        subtitle="Διαχείριση στοιχείων και ιστορικού πελατών"
        actions={canCreate ? (
          <button type="button" onClick={openCreateCustomer} className="inline-flex items-center rounded-xl bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2478ff]">
            <PlusIcon className="mr-2 h-4 w-4" /> Νέος Πελάτης
          </button>
        ) : undefined}
      />

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
              ? 'Δεν υπάρχουν πελάτες ακόμα. Μπορείτε να καταχωρίσετε νέο πελάτη από αυτή τη σελίδα ή μέσω κράτησης.'
              : 'Δεν βρέθηκαν πελάτες με αυτή την αναζήτηση.'}
          </p>
        </div>
      )}

      {/* Customers Grid */}
      {customerOrderError && <p role="alert" className="text-sm text-red-300">{customerOrderError}</p>}
      {user?.role === 'admin' && filteredCustomers.length > 0 && (
        <p className="text-xs text-blue-100/55">
          {searchTerm.trim() ? 'Καθαρίστε την αναζήτηση για να αλλάξετε τη σειρά των καρτών.' :
          savingCustomerOrder ? 'Αποθήκευση νέας σειράς...' :
          'Σύρετε τις κάρτες για να αλλάξετε τη σειρά τους για όλους τους χρήστες. Πατήστε στην κάρτα για επεξεργασία.'}
        </p>
      )}
      {filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              draggable={canReorderCustomers && !savingCustomerOrder}
              onDragStart={event => {
                if (!canReorderCustomers) { event.preventDefault(); return; }
                skipNextCardClick.current = true;
                setDragCustomerId(customer.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', customer.id);
              }}
              onDragOver={event => {
                if (canReorderCustomers && dragCustomerId && dragCustomerId !== customer.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={event => {
                event.preventDefault();
                const sourceId = dragCustomerId || event.dataTransfer.getData('text/plain');
                setDragCustomerId(null);
                void reorderCustomers(sourceId, customer.id);
              }}
              onDragEnd={() => { setDragCustomerId(null); window.setTimeout(() => { skipNextCardClick.current = false; }, 150); }}
              onClick={event => {
                if (skipNextCardClick.current) { skipNextCardClick.current = false; return; }
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                if (canEdit) openEditCustomer(customer);
                else void openCustomerModal(customer);
              }}
              className={`overflow-hidden rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#3475aa] hover:shadow-[0_22px_52px_rgba(0,0,0,0.34)] ${canReorderCustomers ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragCustomerId === customer.id ? 'opacity-50' : ''}`}
            >
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
                  {canEdit && <button
                    onClick={() => openEditCustomer(customer)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 hover:border-[#55a8ff]"
                  >
                    <PencilIcon className="mr-1 h-4 w-4" /> Επεξεργασία
                  </button>}
                  {mayDeleteCustomer && <button
                    onClick={() => openDeleteConfirm(customer)}
                    disabled={deleting && deleteTarget?.id === customer.id}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-400/50 bg-[#071d38] px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="mr-1 h-4 w-4" />
                    Διαγραφή
                  </button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Customer */}
      {customerFormMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <form onSubmit={saveCustomer} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2b5b85]/80 bg-[#071d38] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{customerFormMode === 'create' ? 'Νέος Πελάτης' : 'Επεξεργασία Πελάτη'}</h2>
              <button type="button" onClick={() => setCustomerFormMode(null)} className="text-blue-100/60 hover:text-white" aria-label="Κλείσιμο"><XMarkIcon className="h-6 w-6"/></button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ['name', 'Ονοματεπώνυμο *', 'text'],
                ['phone', 'Τηλέφωνο *', 'tel'],
                ['email', 'Email', 'email'],
                ['country', 'Χώρα', 'text'],
                ['license_number', 'Αριθμός άδειας οδήγησης', 'text'],
                ['birth_date', 'Ημερομηνία γέννησης', 'date'],
              ] as const).map(([field, label, type]) => (
                <label key={field} className="block text-sm text-blue-100/85">
                  <span className="mb-1 block">{label}</span>
                  <input
                    type={type}
                    required={field === 'name' || field === 'phone'}
                    value={customerForm[field]}
                    onChange={e => setCustomerForm(current => ({ ...current, [field]: e.target.value }))}
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-white focus:border-[#55a8ff] focus:outline-none"
                  />
                </label>
              ))}
              <label className="block text-sm text-blue-100/85">
                <span className="mb-1 block">Προέλευση</span>
                <select value={customerForm.source} onChange={e => setCustomerForm(current => ({ ...current, source: e.target.value as Customer['source'] }))} className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-white">
                  <option value="store">Κατάστημα</option>
                  <option value="phone">Τηλέφωνο</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Ιστοσελίδα</option>
                  <option value="repeat">Επαναλαμβανόμενος πελάτης</option>
                  <option value="other">Άλλο</option>
                </select>
              </label>
              <label className="block text-sm text-blue-100/85 sm:col-span-2">
                <span className="mb-1 block">Σημειώσεις</span>
                <textarea rows={3} value={customerForm.notes} onChange={e => setCustomerForm(current => ({ ...current, notes: e.target.value }))} className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-white focus:border-[#55a8ff] focus:outline-none" />
              </label>
            </div>
            {customerFormError && <p role="alert" className="mt-4 text-sm text-red-300">{customerFormError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={savingCustomer} onClick={() => setCustomerFormMode(null)} className="rounded-xl border border-[#2b5b85] px-4 py-2 text-sm text-blue-100">Άκυρο</button>
              <button type="submit" disabled={savingCustomer} className="rounded-xl bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingCustomer ? 'Αποθήκευση...' : customerFormMode === 'create' ? 'Καταχώριση' : 'Αποθήκευση'}</button>
            </div>
          </form>
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
                        <div
                          key={r.id}
                          onClick={() => onViewReservation?.(r.id)}
                          className={`rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/50 p-3 text-sm transition-colors ${onViewReservation ? 'cursor-pointer hover:border-[#55a8ff] hover:bg-[#12375d]' : ''}`}
                        >
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

      {mayDeleteCustomer && deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020b18]/90">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-red-400/30 bg-[#0b2949] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/15">
                <TrashIcon className="h-5 w-5 text-red-300" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-white">Οριστική Διαγραφή Πελάτη</h3>
            </div>
            <p className="mb-2 text-sm text-blue-100/80">
              Η διαγραφή του πελάτη <span className="font-medium text-white">{deleteTarget.name}</span> είναι μη αναστρέψιμη.
            </p>
            {deleteReservationCount === null && !deleteError && (
              <p className="mb-4 text-sm text-blue-100/60">Έλεγχος ιστορικού κρατήσεων...</p>
            )}
            {deleteReservationCount !== null && deleteReservationCount > 0 && (
              <p className="mb-4 text-sm text-amber-200">
                Δεν είναι δυνατή η διαγραφή: ο πελάτης έχει {deleteReservationCount} συνδεδεμένες {deleteReservationCount === 1 ? 'κράτηση' : 'κρατήσεις'}. Το ιστορικό και τα οικονομικά δεδομένα διατηρούνται.
              </p>
            )}
            {deleteReservationCount === 0 && (
              <>
                <p className="mb-4 text-sm text-blue-100/60">
                  Για επιβεβαίωση, πληκτρολογήστε τον κωδικό πελάτη:
                  <span className="ml-1 font-mono font-medium text-[#8ec7ff]">{deleteTarget.id.substring(0, 8).toUpperCase()}</span>
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Κωδικός πελάτη"
                  className="mb-4 w-full rounded-xl border border-[#2b5b85]/80 bg-[#071d38]/90 px-3 py-2 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-400/40"
                  autoFocus
                />
              </>
            )}
            {deleteError && <p className="mb-4 text-sm text-red-300">{deleteError}</p>}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                disabled={deleting}
                className="rounded-lg border border-[#2b5b85]/80 bg-[#071d38] px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#0b2949]/70"
              >
                Άκυρο
              </button>
              {deleteReservationCount === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== deleteTarget.id.substring(0, 8).toUpperCase() || deleting}
                  className="inline-flex items-center rounded-lg border border-red-400/50 bg-red-700 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  {deleting ? 'Διαγραφή...' : 'Διαγραφή'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
