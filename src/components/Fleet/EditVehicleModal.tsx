import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../../types';
import { vehicleService } from '../../lib/database';
import { XMarkIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';

interface VehicleFormModalProps {
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

const DEFAULT_FORM = {
  plate: '',
  brand: '',
  model: '',
  category: 'B' as Vehicle['category'],
  year: new Date().getFullYear(),
  transmission: 'manual' as Vehicle['transmission'],
  fuel_type: 'petrol' as Vehicle['fuel_type'],
  insurance_expiry: '',
  inspection_expiry: '',
};

const VehicleFormModal: React.FC<VehicleFormModalProps> = ({ vehicle, onClose, onSaved }) => {
  const isEdit = !!vehicle;
  const [form, setForm] = useState(
    vehicle
      ? {
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          category: vehicle.category,
          year: vehicle.year,
          transmission: vehicle.transmission,
          fuel_type: vehicle.fuel_type,
          insurance_expiry: vehicle.insurance_expiry || '',
          inspection_expiry: vehicle.inspection_expiry || '',
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        plate: form.plate.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        category: form.category,
        year: Number(form.year),
        transmission: form.transmission,
        fuel_type: form.fuel_type,
        status: 'available' as Vehicle['status'],
        insurance_expiry: form.insurance_expiry || null,
        inspection_expiry: form.inspection_expiry || null,
      };
      const saved = isEdit
        ? await vehicleService.update(vehicle!.id, payload)
        : await vehicleService.create(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      console.error('Failed to save vehicle:', err);
      setError('Αποτυχία αποθήκευσης οχήματος.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020b18]/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#1e4e7d]/70 bg-[#071d38] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e4e7d]/70 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Επεξεργασία Οχήματος' : 'Προσθήκη Οχήματος'}
          </h2>
          <button onClick={onClose} className="text-blue-100/45 transition-colors hover:text-blue-100/75">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-950/45 p-3 text-sm text-red-100">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Πινακίδα</label>
              <input
                type="text"
                required
                value={form.plate}
                onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Έτος</label>
              <input
                type="number"
                required
                min="1990"
                max="2030"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Μάρκα</label>
              <input
                type="text"
                required
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Μοντέλο</label>
              <input
                type="text"
                required
                value={form.model}
                onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Κατηγορία</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Vehicle['category'] }))}
                className={inputClass}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="SUV">SUV</option>
                <option value="7-seater">7-seater</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Κιβώτιο</label>
              <select
                value={form.transmission}
                onChange={(e) => setForm((p) => ({ ...p, transmission: e.target.value as Vehicle['transmission'] }))}
                className={inputClass}
              >
                <option value="manual">Χειροκίνητο</option>
                <option value="automatic">Αυτόματο</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Καύσιμο</label>
              <select
                value={form.fuel_type}
                onChange={(e) => setForm((p) => ({ ...p, fuel_type: e.target.value as Vehicle['fuel_type'] }))}
                className={inputClass}
              >
                <option value="petrol">Βενζίνη</option>
                <option value="diesel">Πετρέλαιο</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Λήξη Ασφάλειας</label>
              <input
                type="date"
                value={form.insurance_expiry}
                onChange={(e) => setForm((p) => ({ ...p, insurance_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Λήξη ΚΤΕΟ</label>
              <input
                type="date"
                value={form.inspection_expiry}
                onChange={(e) => setForm((p) => ({ ...p, inspection_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 border-t border-[#1e4e7d]/70 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
            >
              Άκυρο
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] disabled:opacity-50"
            >
              {saving ? (
                <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckIcon className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleFormModal;
