import React, { useState, useEffect, useCallback } from 'react';
import type { Vehicle } from '../../types';
import { vehicleService, photoService } from '../../lib/database';
import { compressImage } from '../../lib/imageUtils';
import { supabase } from '../../lib/supabase';
import {
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  CameraIcon,
  TrashIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

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
  odometer: 0,
  last_service: '',
  next_service_date: '',
  next_service_odometer: '' as string | number,
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
          odometer: vehicle.odometer ?? 0,
          last_service: vehicle.last_service || '',
          next_service_date: vehicle.next_service_date || '',
          next_service_odometer: vehicle.next_service_odometer ?? '',
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [mainPhotoPath, setMainPhotoPath] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!vehicle) return;
    const loadPhotos = async () => {
      try {
        const paths = await photoService.getPhotos('vehicle', vehicle.id);
        setPhotoPaths(paths);
        const main = vehicle.photo_url || paths[0] || null;
        setMainPhotoPath(main);
      } catch {
        setPhotoPaths([]);
      }
    };
    loadPhotos();
  }, [vehicle]);

  const refreshSignedUrls = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    try {
      const urls = await photoService.getSignedUrls(paths, 3600);
      setPhotoUrls(urls);
    } catch {
      setPhotoUrls(new Map());
    }
  }, []);

  useEffect(() => {
    refreshSignedUrls(photoPaths);
  }, [photoPaths, refreshSignedUrls]);

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !vehicle) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1600, 0.8);
        const path = await photoService.upload(compressed, 'vehicle', vehicle.id);
        setPhotoPaths((prev) => [...prev, path]);
        if (!mainPhotoPath) {
          setMainPhotoPath(path);
        }
      }
    } catch {
      setError('Αποτυχία μεταφόρτωσης φωτογραφίας.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removePhoto = async (path: string) => {
    try {
      await photoService.deletePhoto(path);
    } catch {
      // storage delete failed silently
    }
    setPhotoPaths((prev) => prev.filter((p) => p !== path));
    setPhotoUrls((prev) => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    if (mainPhotoPath === path) {
      setMainPhotoPath((prev) => {
        const remaining = photoPaths.filter((p) => p !== path);
        return remaining[0] || null;
      });
    }
  };

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
        odometer: Number(form.odometer) || 0,
        last_service: form.last_service || null,
        next_service_date: (form.next_service_date as string) || null,
        next_service_odometer: form.next_service_odometer !== '' ? Number(form.next_service_odometer) : null,
        photo_url: mainPhotoPath || null,
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
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);
  const maxDateStr = maxDate.toISOString().split('T')[0];

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

          {/* Photo upload section */}
          {isEdit && (
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-100/65">Φωτογραφίες Οχήματος</label>
              <div className="grid grid-cols-3 gap-3">
                {photoPaths.map((photoPath) => (
                  <div key={photoPath} className="group relative">
                    <img
                      src={photoUrls.get(photoPath) || ''}
                      alt="Vehicle"
                      className="h-24 w-full rounded-lg border border-[#1e4e7d]/70 object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between rounded-b-lg bg-[#020b18]/80 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setMainPhotoPath(photoPath)}
                        className={`rounded p-0.5 transition-colors ${mainPhotoPath === photoPath ? 'text-amber-400' : 'text-blue-100/60 hover:text-amber-400'}`}
                        title="Ορισμός ως κύρια"
                      >
                        <StarIcon className="h-4 w-4" fill={mainPhotoPath === photoPath ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(photoPath)}
                        className="rounded p-0.5 text-red-400 transition-colors hover:text-red-300"
                        title="Διαγραφή"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {mainPhotoPath === photoPath && (
                      <div className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Κύρια
                      </div>
                    )}
                  </div>
                ))}

                <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#2b5b85]/80 bg-[#0b2949]/50 transition-colors hover:bg-[#0b2949]/80">
                  {uploading ? (
                    <ArrowPathIcon className="mb-1 h-6 w-6 animate-spin text-[#55a8ff]" />
                  ) : (
                    <CameraIcon className="mb-1 h-6 w-6 text-blue-100/55" />
                  )}
                  <span className="text-center text-[11px] text-blue-100/55">
                    {uploading ? '...' : 'Προσθήκη'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-blue-100/40">Κάντε κλικ στο αστέρι για να ορίσετε την κύρια φωτογραφία.</p>
            </div>
          )}

          {!isEdit && (
            <div className="rounded-xl border border-[#1e4e7d]/50 bg-[#0b2949]/40 p-3 text-xs text-blue-100/45">
              Αποθηκεύστε το όχημα πρώτα για να προσθέσετε φωτογραφίες.
            </div>
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
                max={maxDateStr}
                value={form.insurance_expiry}
                onChange={(e) => setForm((p) => ({ ...p, insurance_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Λήξη ΚΤΕΟ</label>
              <input
                type="date"
                max={maxDateStr}
                value={form.inspection_expiry}
                onChange={(e) => setForm((p) => ({ ...p, inspection_expiry: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Χιλιομετρητής (km)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.odometer}
                onChange={(e) => setForm((p) => ({ ...p, odometer: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Τελευταίο Service</label>
              <input
                type="date"
                value={form.last_service}
                onChange={(e) => setForm((p) => ({ ...p, last_service: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Επόμενο Service (Ημερομηνία)</label>
              <input
                type="date"
                max={maxDateStr}
                value={form.next_service_date}
                onChange={(e) => setForm((p) => ({ ...p, next_service_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-blue-100/65">Επόμενο Service (Χιλιόμετρα)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="π.χ. 150000"
                value={form.next_service_odometer}
                onChange={(e) => setForm((p) => ({ ...p, next_service_odometer: e.target.value }))}
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
