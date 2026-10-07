import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { photoService } from '../../lib/database';
import { compressImage } from '../../lib/imageUtils';
import {
  CameraIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface CheckInData {
  fuel_level: number;
  odometer: number;
  photos: string[];
  new_damages: Array<{
    id: string;
    description: string;
    photo?: string;
    estimated_cost?: number;
  }>;
  additional_charges: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
  }>;
}

interface CheckInFormProps {
  reservationId: string;
  onComplete: (data: CheckInData) => void;
  onCancel: () => void;
}

const CheckInForm: React.FC<CheckInFormProps> = ({ reservationId, onComplete, onCancel }) => {
  const { t } = useLanguage();
  const [checkInData, setCheckInData] = useState<CheckInData>({
    fuel_level: 100,
    odometer: 0,
    photos: [],
    new_damages: [],
    additional_charges: []
  });

  const [showDamageForm, setShowDamageForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [newDamage, setNewDamage] = useState({ description: '', cost: 0 });
  const [newCharge, setNewCharge] = useState({ type: '', amount: 0, description: '' });
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
    refreshSignedUrls(checkInData.photos);
  }, [checkInData.photos, refreshSignedUrls]);

  const chargeTypes = [
    'Καύσιμο',
    'Καθαρισμός',
    'Καθυστέρηση',
    'Ζημιά',
    'Χαμένο αντικείμενο',
    'Άλλο'
  ];

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1600, 0.8);
        const path = await photoService.upload(compressed, 'checkin', reservationId);
        setCheckInData(prev => ({
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
    setCheckInData(prev => ({
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
    if (newDamage.description.trim()) {
      const damage = {
        id: Date.now().toString(),
        description: newDamage.description.trim(),
        estimated_cost: newDamage.cost
      };
      setCheckInData(prev => ({
        ...prev,
        new_damages: [...prev.new_damages, damage]
      }));
      setNewDamage({ description: '', cost: 0 });
      setShowDamageForm(false);
    }
  };

  const removeDamage = (id: string) => {
    setCheckInData(prev => ({
      ...prev,
      new_damages: prev.new_damages.filter(d => d.id !== id)
    }));
  };

  const addCharge = () => {
    if (newCharge.type && newCharge.amount > 0) {
      const charge = {
        id: Date.now().toString(),
        type: newCharge.type,
        amount: newCharge.amount,
        description: newCharge.description
      };
      setCheckInData(prev => ({
        ...prev,
        additional_charges: [...prev.additional_charges, charge]
      }));
      setNewCharge({ type: '', amount: 0, description: '' });
      setShowChargeForm(false);
    }
  };

  const removeCharge = (id: string) => {
    setCheckInData(prev => ({
      ...prev,
      additional_charges: prev.additional_charges.filter(c => c.id !== id)
    }));
  };

  const getTotalAdditionalCharges = () => {
    return checkInData.additional_charges.reduce((total, charge) => total + charge.amount, 0) +
           checkInData.new_damages.reduce((total, damage) => total + (damage.estimated_cost || 0), 0);
  };

  const handleSubmit = () => {
    onComplete(checkInData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Check-in Οχήματος</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Fuel and Odometer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Επίπεδο Καυσίμου Επιστροφής (%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="12.5"
                value={checkInData.fuel_level}
                onChange={(e) => setCheckInData(prev => ({ ...prev, fuel_level: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
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
              <p className="text-center mt-2 font-medium">{checkInData.fuel_level}%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Χιλιόμετρα Επιστροφής
              </label>
              <input
                type="number"
                value={checkInData.odometer}
                onChange={(e) => setCheckInData(prev => ({ ...prev, odometer: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Εισάγετε χιλιόμετρα..."
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Φωτογραφίες Επιστροφής
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {checkInData.photos.map((photoPath) => (
                <div key={photoPath} className="relative">
                  <img
                    src={photoUrls.get(photoPath) || ''}
                    alt="Return photo"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removePhoto(photoPath)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                {uploading ? (
                  <ArrowPathIcon className="h-8 w-8 text-blue-500 mb-2 animate-spin" />
                ) : (
                  <CameraIcon className="h-8 w-8 text-gray-400 mb-2" />
                )}
                <span className="text-sm text-gray-500">
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
          </div>

          {/* New Damages */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Νέες Ζημιές
              </label>
              <button
                onClick={() => setShowDamageForm(true)}
                className="inline-flex items-center text-sm text-red-600 hover:text-red-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Προσθήκη ζημιάς
              </button>
            </div>

            {showDamageForm && (
              <div className="mb-4 p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newDamage.description}
                    onChange={(e) => setNewDamage(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Περιγραφή ζημιάς..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <input
                    type="number"
                    value={newDamage.cost}
                    onChange={(e) => setNewDamage(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="Εκτιμώμενο κόστος (€)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={addDamage}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowDamageForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {checkInData.new_damages.map((damage) => (
                <div key={damage.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{damage.description}</span>
                    {damage.estimated_cost && (
                      <span className="text-sm text-red-600 ml-2">€{damage.estimated_cost}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeDamage(damage.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Charges */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Επιπλέον Χρεώσεις
              </label>
              <button
                onClick={() => setShowChargeForm(true)}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Προσθήκη χρέωσης
              </button>
            </div>

            {showChargeForm && (
              <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="space-y-3">
                  <select
                    value={newCharge.type}
                    onChange={(e) => setNewCharge(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Επιλέξτε τύπο χρέωσης...</option>
                    {chargeTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={newCharge.amount}
                    onChange={(e) => setNewCharge(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ποσό (€)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newCharge.description}
                    onChange={(e) => setNewCharge(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Περιγραφή (προαιρετικό)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={addCharge}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowChargeForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {checkInData.additional_charges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{charge.type}</span>
                    <span className="text-sm text-blue-600 ml-2">€{charge.amount}</span>
                    {charge.description && (
                      <p className="text-xs text-gray-600 mt-1">{charge.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeCharge(charge.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total Additional Charges */}
          {getTotalAdditionalCharges() > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Σύνολο Επιπλέον Χρεώσεων:</span>
                <span className="text-xl font-bold text-red-600">€{getTotalAdditionalCharges().toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Ακύρωση
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            Ολοκλήρωση Check-in
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckInForm;
