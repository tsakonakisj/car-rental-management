import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../../types';
import { vehicleService } from '../../lib/database';
import { XMarkIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';

interface EditVehicleModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: (updated: Vehicle) => void;
}

const EditVehicleModal: React.FC<EditVehicleModalProps> = ({ vehicle, onClose, onSaved }) => {
  const [form, setForm] = useState({
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    category: vehicle.category,
    year: vehicle.year,
    transmission: vehicle.transmission,
    fuel_type: vehicle.fuel_type,
    insurance_expiry: vehicle.insurance_expiry || '',
    inspection_expiry: vehicle.inspection_expiry || '',
  });
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
      const updates: Partial<Vehicle> = {
        plate: form.plate.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        category: form.category,
        year: Number(form.year),
        transmission: form.transmission,
        fuel_type: form.fuel_type,
        insurance_expiry: form.insurance_expiry || null,
        inspection_expiry: form.inspection_expiry || null,
      };
      const updated = await vehicleService.update(vehicle.id, updates);
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update vehicle:', err);
      setError('Αποτυχία αποθήκευσης οχήματος.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Επεξεργασία Οχήματος</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Πινακίδα</label>
              <input
                type="text"
                required
                value={form.plate}
                onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Έτος</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Μάρκα</label>
              <input
                type="text"
                required
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Μοντέλο</label>
              <input
                type="text"
                required
                value={form.model}
                onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Κατηγορία</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Κιβώτιο</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Καύσιμο</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Λήξη Ασφάλειας</label>
              <input
                type="date"
                value={form.insurance_expiry}
                onChange={(e) => setForm((p) => ({ ...p, insurance_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Λήξη ΚΤΕΟ</label>
              <input
                type="date"
                value={form.inspection_expiry}
                onChange={(e) => setForm((p) => ({ ...p, inspection_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Άκυρο
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckIcon className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditVehicleModal;
