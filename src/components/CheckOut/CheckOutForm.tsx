import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { photoService } from '../../lib/database';
import { compressImage } from '../../lib/imageUtils';
import {
  CameraIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface CheckOutData {
  fuel_level: number;
  odometer: number;
  photos: string[];
  damages: Array<{
    id: string;
    description: string;
    photo?: string;
  }>;
  accessories_given: string[];
}

interface CheckOutFormProps {
  reservationId: string;
  onComplete: (data: CheckOutData) => void;
  onCancel: () => void;
}

const CheckOutForm: React.FC<CheckOutFormProps> = ({ reservationId, onComplete, onCancel }) => {
  const { t } = useLanguage();
  const [checkOutData, setCheckOutData] = useState<CheckOutData>({
    fuel_level: 100,
    odometer: 0,
    photos: [],
    damages: [],
    accessories_given: []
  });

  const [newDamage, setNewDamage] = useState('');
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshSignedUrls = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    try {
      const urls = await photoService.getSignedUrls(paths, 3600);
      setPhotoUrls(urls);
    } catch (err) {
      console.error('Failed to generate signed URLs:', err);
    }
  }, []);

  useEffect(() => {
    refreshSignedUrls(checkOutData.photos);
  }, [checkOutData.photos, refreshSignedUrls]);

  const accessories = [
    'Παιδικό κάθισμα',
    'GPS',
    'Φορτιστής κινητού',
    'Αλυσίδες χιονιού',
    'Τρίγωνο',
    'Φαρμακείο'
  ];

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1600, 0.8);
        const path = await photoService.upload(compressed, 'checkout', reservationId);
        setCheckOutData(prev => ({
          ...prev,
          photos: [...prev.photos, path]
        }));
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      alert('Αποτυχία μεταφόρτωσης φωτογραφίας');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removePhoto = async (path: string) => {
    try {
      await photoService.deletePhoto(path);
    } catch (err) {
      console.error('Failed to delete photo:', err);
    }
    setCheckOutData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p !== path)
    }));
    setPhotoUrls(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
  };

  const addDamage = () => {
    if (newDamage.trim()) {
      const damage = {
        id: Date.now().toString(),
        description: newDamage.trim()
      };
      setCheckOutData(prev => ({
        ...prev,
        damages: [...prev.damages, damage]
      }));
      setNewDamage('');
      setShowDamageForm(false);
    }
  };

  const removeDamage = (id: string) => {
    setCheckOutData(prev => ({
      ...prev,
      damages: prev.damages.filter(d => d.id !== id)
    }));
  };

  const toggleAccessory = (accessory: string) => {
    setCheckOutData(prev => ({
      ...prev,
      accessories_given: prev.accessories_given.includes(accessory)
        ? prev.accessories_given.filter(a => a !== accessory)
        : [...prev.accessories_given, accessory]
    }));
  };

  const handleSubmit = () => {
    onComplete(checkOutData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Check-out Οχήματος</h2>
            <button
              onClick={onCancel}
              className="text-blue-100/55 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Fuel and Odometer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-100/65 mb-2">
                Επίπεδο Καυσίμου (%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="12.5"
                value={checkOutData.fuel_level}
                onChange={(e) => setCheckOutData(prev => ({ ...prev, fuel_level: parseInt(e.target.value) }))}
                className="w-full accent-[#1268f3]"
              />
              <div className="flex justify-between text-xs text-blue-100/55 mt-1">
                <span>0%</span>
                <span>1/8</span>
                <span>1/4</span>
                <span>3/8</span>
                <span>1/2</span>
                <span>5/8</span>
                <span>3/4</span>
                <span>7/8</span>
                <span>100%</span>
              </div>
              <p className="text-center mt-2 font-medium text-white">{checkOutData.fuel_level}%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/65 mb-2">
                Χιλιόμετρα
              </label>
              <input
                type="number"
                value={checkOutData.odometer}
                onChange={(e) => setCheckOutData(prev => ({ ...prev, odometer: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                placeholder="Εισάγετε χιλιόμετρα..."
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-blue-100/65 mb-4">
              Φωτογραφίες Οχήματος
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {checkOutData.photos.map((photoPath) => (
                <div key={photoPath} className="relative">
                  <img
                    src={photoUrls.get(photoPath) || ''}
                    alt="Vehicle photo"
                    className="w-full h-32 object-cover rounded-xl border border-[#1e4e7d]/70"
                  />
                  <button
                    onClick={() => removePhoto(photoPath)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#2b5b85]/80 border-dashed rounded-lg cursor-pointer bg-[#0b2949]/50 hover:bg-[#0b2949]/80 transition-colors">
                {uploading ? (
                  <ArrowPathIcon className="h-8 w-8 text-[#55a8ff] mb-2 animate-spin" />
                ) : (
                  <CameraIcon className="h-8 w-8 text-blue-100/55 mb-2" />
                )}
                <span className="text-sm text-blue-100/55">
                  {uploading ? 'Μεταφόρτωση...' : 'Λήψη φωτογραφίας'}
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

            <p className="text-sm text-blue-100/65">
              Τραβήξτε φωτογραφίες από όλες τις πλευρές του οχήματος
            </p>
          </div>

          {/* Existing Damages */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-blue-100/65">
                Προϋπάρχουσες Ζημιές
              </label>
              <button
                onClick={() => setShowDamageForm(true)}
                className="text-sm text-[#55a8ff] hover:text-[#7bc0ff]"
              >
                + Προσθήκη ζημιάς
              </button>
            </div>

            {showDamageForm && (
              <div className="mb-4 p-4 rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newDamage}
                    onChange={(e) => setNewDamage(e.target.value)}
                    placeholder="Περιγραφή ζημιάς..."
                    className="flex-1 rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                  <button
                    onClick={addDamage}
                    className="rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDamageForm(false)}
                    className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {checkOutData.damages.map((damage) => (
                <div key={damage.id} className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/30 bg-yellow-950/40">
                  <span className="text-sm text-blue-50">{damage.description}</span>
                  <button
                    onClick={() => removeDamage(damage.id)}
                    className="text-red-300 hover:text-red-200"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div>
            <label className="block text-sm font-medium text-blue-100/65 mb-4">
              Αξεσουάρ που Δόθηκαν
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {accessories.map((accessory) => (
                <label key={accessory} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={checkOutData.accessories_given.includes(accessory)}
                    onChange={() => toggleAccessory(accessory)}
                    className="rounded border-[#2b5b85]/80 bg-[#0b2949]/80 text-[#1268f3] focus:ring-[#2f8cff]/50"
                  />
                  <span className="ml-2 text-sm text-blue-100/85">{accessory}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1e4e7d]/70 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
          >
            Ακύρωση
          </button>
          <button
            onClick={handleSubmit}
            disabled={false}
            className="rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ολοκλήρωση Check-out
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckOutForm;
