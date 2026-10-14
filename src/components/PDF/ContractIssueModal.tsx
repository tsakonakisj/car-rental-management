import React, { useState, useRef } from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { customerService } from '../../lib/database';
import ContractGenerator, { type ContractData, type ContractGeneratorRef } from './ContractGenerator';

interface ContractIssueModalProps {
  reservation: {
    id: string;
    customer_id: string;
    category: string;
    pickup_date: string;
    return_date: string;
    daily_rate: number;
    insurance_type: string;
    insurance_rate: number;
    total_amount: number;
    customer: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      country?: string;
      license_number?: string;
      birth_date?: string;
    } | null;
    vehicle: {
      plate: string;
      brand: string;
      model: string;
      category: string;
    } | null;
    pickup_station: { name: string; name_en: string } | null;
    return_station: { name: string; name_en: string } | null;
  };
  onClose: () => void;
}

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  country: string;
  licenseNumber: string;
  birthDate: string;
}

const ContractIssueModal: React.FC<ContractIssueModalProps> = ({ reservation, onClose }) => {
  const customer = reservation.customer;
  const [form, setForm] = useState<CustomerForm>({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    country: customer?.country || '',
    licenseNumber: customer?.license_number || '',
    birthDate: customer?.birth_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const contractRef = useRef<ContractGeneratorRef>(null);

  const handleField = (field: keyof CustomerForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const buildContractData = (): ContractData => ({
    reservation: {
      id: reservation.id,
      customer: {
        name: form.name,
        phone: form.phone,
        email: form.email,
        country: form.country,
        license_number: form.licenseNumber,
        birth_date: form.birthDate,
      },
      vehicle: {
        plate: reservation.vehicle?.plate || '',
        brand: reservation.vehicle?.brand || '',
        model: reservation.vehicle?.model || reservation.category,
        category: reservation.category,
      },
      pickup_date: reservation.pickup_date,
      return_date: reservation.return_date,
      pickup_station: reservation.pickup_station?.name_en || reservation.pickup_station?.name || '',
      return_station: reservation.return_station?.name_en || reservation.return_station?.name || '',
      daily_rate: Number(reservation.daily_rate) || 0,
      insurance_type: reservation.insurance_type || 'basic',
      insurance_rate: Number(reservation.insurance_rate) || 0,
      total_amount: Number(reservation.total_amount) || 0,
      extras: [],
    },
  });

  const handleIssue = async () => {
    if (!form.name.trim()) {
      setError('Το όνομα πελάτη είναι υποχρεωτικό.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Το τηλέφωνο πελάτη είναι υποχρεωτικό.');
      return;
    }
    if (!form.licenseNumber.trim()) {
      setError('Ο αριθμός οδηγικής άδειας είναι υποχρεωτικός για έκδοση συμβολαίου.');
      return;
    }
    if (!form.birthDate) {
      setError('Η ημερομηνία γέννησης είναι υποχρεωτική για έκδοση συμβολαίου.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (customer?.id) {
        await customerService.update(customer.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          country: form.country.trim() || undefined,
          license_number: form.licenseNumber.trim(),
          birth_date: form.birthDate || undefined,
        });
      }
    } catch (err) {
      console.error('Failed to update customer:', err);
      setError('Αποτυχία αποθήκευσης στοιχείων πελάτη. Δοκιμάστε ξανά.');
      setSaving(false);
      return;
    }

    setSaving(false);

    await contractRef.current?.generate();
    onClose();
  };

  const inputClass = 'w-full rounded-lg border border-[#2b5b85]/80 bg-[#0b2949] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50';
  const labelClass = 'block text-xs text-blue-100/55 mb-1';

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        <div className="fixed inset-0 bg-[#020b18]/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#071d38] rounded-xl shadow-xl border border-[#1e4e7d]/70 max-w-lg w-full mx-auto z-10">
          <div className="px-4 sm:px-6 py-4 border-b border-[#1e4e7d]/70 flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-medium text-white">Έκδοση Συμβολαίου</h2>
            <button onClick={onClose} className="text-blue-100/45 hover:text-blue-100/65">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="rounded-lg border border-[#2f8cff]/25 bg-[#0b2949]/60 p-3">
              <p className="text-xs text-blue-100/65 leading-relaxed">
                Επιβεβαιώστε ή συμπληρώστε τα στοιχεία πελάτη. Μετά την αποθήκευση θα δημιουργηθεί το Σύμβολο Ενοικίασης PDF.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Όνομαπεπώνυμο *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleField('name', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Τηλέφωνο *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => handleField('phone', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleField('email', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Χώρα</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={e => handleField('country', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ημερομηνία Γέννησης *</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={e => handleField('birthDate', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Αριθμός Οδηγικής Άδειας *</label>
                <input
                  type="text"
                  value={form.licenseNumber}
                  onChange={e => handleField('licenseNumber', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/45 border border-red-400/30 rounded-lg text-sm text-red-100">
                {error}
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-[#1e4e7d]/70 flex justify-between gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#2b5b85]/80 text-sm font-medium rounded-lg text-blue-100/85 bg-[#071d38] hover:bg-[#0b2949]/70"
            >
              Άκυρο
            </button>
            <button
              onClick={handleIssue}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              {saving ? 'Αποθήκευση...' : 'Έκδοση & Δημιουργία PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden">
        <ContractGenerator ref={contractRef} data={buildContractData()} />
      </div>
    </div>
  );
};

export default ContractIssueModal;
