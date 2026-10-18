import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { photoService, checkoutService } from '../../lib/database';
import { compressImage } from '../../lib/imageUtils';
import {
  CameraIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export interface CheckInData {
  fuel_level: number;
  odometer: number;
  photos: string[];
  new_damages: Array<{
    id: string;
    description: string;
    photo?: string;
    estimated_cost?: number;
  }>;
  fuel_price: number | null;
  fuel_waiver_reason: string | null;
  additional_charges: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
  }>;
}

interface CheckInFormProps {
  reservationId: string;
  vehicleFuelTankCapacity?: number | null;
  onComplete: (data: CheckInData) => void;
  onCancel: () => void;
  submitting?: boolean;
  initialData?: CheckInData;
  initialFuelPrice?: number;
  correctionReason?: string;
}

const CheckInForm: React.FC<CheckInFormProps> = ({ reservationId, vehicleFuelTankCapacity, onComplete, onCancel, submitting = false, initialData, initialFuelPrice, correctionReason }) => {
  const { t } = useLanguage();
  const [checkOutOdometer, setCheckOutOdometer] = useState<number | null>(null);
  const [checkOutFuelLevel, setCheckOutFuelLevel] = useState<number | null>(null);
  const [odometerError, setOdometerError] = useState('');
  const [fuelWarningDismissed, setFuelWarningDismissed] = useState(false);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<string>(initialFuelPrice ? String(initialFuelPrice) : '');
  const [fuelSettlement, setFuelSettlement] = useState<'charge' | 'waiver'>(initialData?.fuel_waiver_reason ? 'waiver' : 'charge');
  const [fuelWaiverReason, setFuelWaiverReason] = useState(initialData?.fuel_waiver_reason || '');
  const [fuelSettlementError, setFuelSettlementError] = useState('');
  const [confirmation, setConfirmation] = useState<CheckInData | null>(null);
  const [checkInData, setCheckInData] = useState<CheckInData>(initialData || {
    fuel_level: 100,
    odometer: 0,
    photos: [],
    new_damages: [],
    additional_charges: [],
    fuel_price: null, fuel_waiver_reason: null
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const checkout = await checkoutService.getByReservationId(reservationId);
        if (cancelled) return;
        if (checkout) {
          if (typeof checkout.odometer === 'number') {
            setCheckOutOdometer(checkout.odometer);
            if (!initialData) setCheckInData(prev => ({ ...prev, odometer: checkout.odometer }));
          }
          if (typeof checkout.fuel_level === 'number') {
            setCheckOutFuelLevel(checkout.fuel_level);
            if (!initialData) setCheckInData(prev => ({ ...prev, fuel_level: checkout.fuel_level }));
          }
        }
      } catch (err) {
        console.error('Failed to load checkout odometer:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [reservationId, initialData]);

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
    if (initialData?.photos.includes(path)) return;
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
        additional_charges: [...prev.additional_charges.filter(c => c.type !== 'Καύσιμο'), charge]
      }));
      setNewCharge({ type: '', amount: 0, description: '' });
      setShowChargeForm(false);
      if (newCharge.type === 'Καύσιμο') {
        setFuelWarningDismissed(false);
      }
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

  const fuelDiffPercent = checkOutFuelLevel != null ? Math.max(0, checkOutFuelLevel - checkInData.fuel_level) : 0;
  const missingLiters = vehicleFuelTankCapacity != null && fuelDiffPercent > 0
    ? (fuelDiffPercent / 100) * vehicleFuelTankCapacity
    : 0;
  const pricePerLiter = parseFloat(fuelPricePerLiter) || 0;
  const proposedFuelCharge = missingLiters > 0 && pricePerLiter > 0 ? missingLiters * pricePerLiter : 0;

  const addFuelChargeFromCalculation = () => {
    if (proposedFuelCharge <= 0) return;
    const charge = {
      id: Date.now().toString(),
      type: 'Καύσιμο',
      amount: parseFloat(proposedFuelCharge.toFixed(2)),
      description: `Διαφορά ${fuelDiffPercent}% (${missingLiters.toFixed(1)}L × €${pricePerLiter.toFixed(2)}/L)`,
    };
    setCheckInData(prev => ({
      ...prev,
      additional_charges: [...prev.additional_charges, charge]
    }));
    setFuelWarningDismissed(false);
  };

  const handleSubmit = () => {
    setFuelSettlementError('');
    if (initialData && (!correctionReason || correctionReason.trim().length < 5)) {
      setFuelSettlementError('Γράψτε αιτιολογία τουλάχιστον 5 χαρακτήρων για την αλλαγή της επιστροφής.');
      return;
    }
    if (fuelDiffPercent > 0) {
      if (vehicleFuelTankCapacity == null || vehicleFuelTankCapacity <= 0 ||
          !Number.isFinite(pricePerLiter) || pricePerLiter <= 0 ||
          Math.abs(pricePerLiter * 100 - Math.round(pricePerLiter * 100)) > 1e-6) {
        setFuelSettlementError('Για έλλειμμα καυσίμου απαιτούνται χωρητικότητα ρεζερβουάρ και τιμή ανά λίτρο.');
        return;
      }
      if (fuelSettlement === 'waiver') {
        if (fuelWaiverReason.trim().length < 5) {
          setFuelSettlementError('Γράψτε αιτιολογία τουλάχιστον 5 χαρακτήρων για έγκριση από Admin.');
          return;
        }
        if (checkInData.additional_charges.some(c => c.type === 'Καύσιμο')) {
          setFuelSettlementError('Αφαιρέστε τη χρέωση καυσίμου πριν ζητήσετε εξαίρεση.');
          return;
        }
      } else {
        const fuelCharges = checkInData.additional_charges.filter(c => c.type === 'Καύσιμο');
        if (fuelCharges.length !== 1 ||
            Math.round(fuelCharges[0].amount * 100) !== Math.round(proposedFuelCharge * 100)) {
          setFuelSettlementError('Καταχωρίστε την προτεινόμενη χρέωση καυσίμου πριν ολοκληρώσετε το Check-In.');
          return;
        }
      }
    }
    if (checkOutOdometer != null && checkInData.odometer < checkOutOdometer) {
      setOdometerError(`Τα χιλιόμετρα επιστροφής δεν μπορούν να είναι μικρότερα από τα χιλιόμετρα check-out (${checkOutOdometer}).`);
      return;
    }
    setOdometerError('');
    setConfirmation({
      ...checkInData,
      fuel_price: fuelDiffPercent > 0 ? pricePerLiter : null,
      fuel_waiver_reason: fuelDiffPercent > 0 && fuelSettlement === 'waiver' ? fuelWaiverReason.trim() : null,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {confirmation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020b18]/90 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="checkin-confirm-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2b5b85] bg-[#0b2949] p-6 text-white">
            <h2 id="checkin-confirm-title" className="text-xl font-semibold">{initialData ? 'Επιβεβαίωση αλλαγών επιστροφής' : 'Επιβεβαίωση επιστροφής'}</h2>
            <p className="mt-3">Καύσιμο επιστροφής: {confirmation.fuel_level}% · Χιλιόμετρα: {confirmation.odometer}</p>
            <p className="mt-2">Νέες ζημιές: {confirmation.new_damages.length}</p>
            {confirmation.new_damages.map(d => <p key={d.id} className="mt-1 text-sm">{d.description} · Εκτίμηση €{(d.estimated_cost || 0).toFixed(2)}</p>)}
            {confirmation.additional_charges.map(c => <p key={c.id} className="mt-2 text-sm">{c.type}: €{c.amount.toFixed(2)} {c.description}</p>)}
            <p className="mt-3 font-semibold">Σύνολο επιπλέον χρεώσεων: €{confirmation.additional_charges.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}</p>
            {confirmation.fuel_waiver_reason && <p className="mt-3 rounded-lg bg-amber-500/15 p-3 text-amber-100">Εκκρεμεί έγκριση Admin για εξαίρεση €{proposedFuelCharge.toFixed(2)}. Αιτιολογία: {confirmation.fuel_waiver_reason}</p>}
            <p className="mt-4 text-sm text-blue-100/80">{initialData ? `Η κράτηση παραμένει ολοκληρωμένη. Αιτιολογία: ${correctionReason}` : 'Με την επιβεβαίωση καταγράφεται η επιστροφή και ολοκληρώνεται το Check-In.'}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button autoFocus type="button" disabled={submitting} onClick={() => setConfirmation(null)} className="rounded-lg border border-[#2b5b85] px-4 py-2">Επιστροφή για αλλαγές</button>
              <button type="button" disabled={submitting} onClick={() => { if (!submitting) { onComplete(confirmation); setConfirmation(null); } }} className="rounded-lg bg-emerald-600 px-4 py-2 disabled:opacity-40">{initialData ? 'Αποθήκευση αλλαγών' : 'Επιβεβαίωση επιστροφής'}</button>
            </div>
          </section>
        </div>
      )}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">{initialData ? 'Στοιχεία επιστροφής' : 'Check-in Οχήματος'}</h2>
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
                Επίπεδο Καυσίμου Επιστροφής (%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="12.5"
                value={checkInData.fuel_level}
                onChange={(e) => {
                  setCheckInData(prev => ({ ...prev, fuel_level: parseInt(e.target.value) }));
                  setFuelWarningDismissed(false);
                }}
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
              <p className="text-center mt-2 font-medium text-white">{checkInData.fuel_level}%</p>
              {checkOutFuelLevel != null && (
                <p className="text-xs text-blue-100/45 mt-1 text-center">
                  Καύσιμο παράδοσης: {checkOutFuelLevel}%
                </p>
              )}
              {checkOutFuelLevel != null && checkInData.fuel_level < checkOutFuelLevel && (
                <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-950/40 px-3 py-2">
                  <p className="text-sm text-amber-200">
                    Διαφορά καυσίμου: {checkOutFuelLevel - checkInData.fuel_level}%
                  </p>
                </div>
              )}
              {checkOutFuelLevel != null && checkInData.fuel_level < checkOutFuelLevel && vehicleFuelTankCapacity != null && (
                <div className="mt-3 rounded-lg border border-[#1e4e7d]/70 bg-[#071d38]/90 px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-100/65">Χωρητικότητα ρεζερβουάρ:</span>
                    <span className="font-medium text-white">{vehicleFuelTankCapacity} L</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-100/65">Ελλειμμα καυσίμου:</span>
                    <span className="font-medium text-amber-300">{missingLiters.toFixed(1)} L</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-blue-100/65 whitespace-nowrap">Τιμή ανά λίτρο (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fuelPricePerLiter}
                      onChange={(e) => setFuelPricePerLiter(e.target.value)}
                      placeholder="π.χ. 1.75"
                      className="flex-1 rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                    />
                  </div>
                  {proposedFuelCharge > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm border-t border-[#1e4e7d]/70 pt-3">
                        <span className="text-blue-100/65">Προτεινόμενη χρέωση καυσίμου:</span>
                        <span className="font-bold text-amber-300">€{proposedFuelCharge.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={addFuelChargeFromCalculation}
                        className="w-full rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/25"
                      >
                        Προσθήκη χρέωσης καυσίμου €{proposedFuelCharge.toFixed(2)}
                      </button>
                    </>
                  )}
                </div>
              )}
              {fuelDiffPercent > 0 && (
                <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="font-semibold">Υποχρεωτική τακτοποίηση ελλείμματος καυσίμου</p>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="radio" checked={fuelSettlement === 'charge'} onChange={() => setFuelSettlement('charge')} />
                    Καταχώριση υπολογισμένης χρέωσης
                  </label>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="radio" checked={fuelSettlement === 'waiver'} onChange={() => setFuelSettlement('waiver')} />
                    Αίτημα εξαίρεσης — έγκριση από Admin αργότερα
                  </label>
                  {fuelSettlement === 'waiver' && (
                    <label className="mt-3 block">
                      Αιτιολογία εξαίρεσης
                      <textarea rows={2} value={fuelWaiverReason} onChange={e => setFuelWaiverReason(e.target.value)}
                        placeholder="Γιατί δεν θα χρεωθεί ο πελάτης;"
                        className="mt-1 w-full rounded-lg border border-amber-300/40 bg-[#071d38] p-2 text-white" />
                      <span className="mt-1 block text-xs">Το Check-In ολοκληρώνεται και δημιουργείται εκκρεμής οικονομική έγκριση.</span>
                    </label>
                  )}
                  {fuelSettlementError && <p role="alert" className="mt-2 text-red-300">{fuelSettlementError}</p>}
                </div>
              )}
              {checkOutFuelLevel != null && checkInData.fuel_level < checkOutFuelLevel && vehicleFuelTankCapacity == null && (
                <div className="mt-2 rounded-lg border border-[#1e4e7d]/70 bg-[#071d38]/90 px-3 py-2">
                  <p className="text-xs text-blue-100/55">
                    Η χωρητικότητα ρεζερβουάρ δεν έχει οριστεί για αυτό το όχημα. Η αυτοματοποιημένη υπολογισμός καυσίμου δεν είναι διαθέσιμος — προσθέστε χρέωση καυσίμου χειροκίνητα από τις Επιπλέον Χρεώσεις.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/65 mb-2">
                Χιλιόμετρα Επιστροφής
              </label>
              <input
                type="number"
                value={checkInData.odometer}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCheckInData(prev => ({ ...prev, odometer: val }));
                  if (checkOutOdometer != null && val < checkOutOdometer) {
                    setOdometerError(`Τα χιλιόμετρα επιστροφής δεν μπορούν να είναι μικρότερα από τα χιλιόμετρα check-out (${checkOutOdometer}).`);
                  } else {
                    setOdometerError('');
                  }
                }}
                min={checkOutOdometer ?? 0}
                className={`w-full rounded-xl border bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50 ${
                  odometerError ? 'border-red-400/70' : 'border-[#2b5b85]/80'
                }`}
                placeholder="Εισάγετε χιλιόμετρα..."
              />
              {checkOutOdometer != null && (
                <p className="text-xs text-blue-100/45 mt-1">
                  Χιλιόμετρα check-out: {checkOutOdometer}
                </p>
              )}
              {odometerError && (
                <p className="text-xs text-red-300 mt-1">{odometerError}</p>
              )}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-blue-100/65 mb-4">
              Φωτογραφίες Επιστροφής
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {checkInData.photos.map((photoPath) => (
                <div key={photoPath} className="relative">
                  <img
                    src={photoUrls.get(photoPath) || ''}
                    alt="Return photo"
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
          </div>

          {/* New Damages */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-blue-100/65">
                Νέες Ζημιές
              </label>
              <button
                onClick={() => setShowDamageForm(true)}
                className="inline-flex items-center text-sm text-red-300 hover:text-red-200"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Προσθήκη ζημιάς
              </button>
            </div>

            {showDamageForm && (
              <div className="mb-4 p-4 rounded-lg bg-red-950/45 border border-red-400/30">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newDamage.description}
                    onChange={(e) => setNewDamage(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Περιγραφή ζημιάς..."
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                  <input
                    type="number"
                    value={newDamage.cost}
                    onChange={(e) => setNewDamage(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="Εκτιμώμενο κόστος (€)"
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={addDamage}
                      className="rounded-xl border border-transparent bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(220,38,38,0.28)] transition-colors hover:bg-red-500"
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
              </div>
            )}

            <div className="space-y-2">
              {checkInData.new_damages.map((damage) => (
                <div key={damage.id} className="flex items-center justify-between p-3 rounded-lg border border-red-400/30 bg-red-950/45">
                  <div>
                    <span className="text-sm font-medium text-blue-50">{damage.description}</span>
                    {damage.estimated_cost && (
                      <span className="text-sm text-red-300 ml-2">€{damage.estimated_cost}</span>
                    )}
                  </div>
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

          {/* Additional Charges */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-blue-100/65">
                Επιπλέον Χρεώσεις
              </label>
              <button
                onClick={() => setShowChargeForm(true)}
                className="inline-flex items-center text-sm text-[#55a8ff] hover:text-[#7bc0ff]"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Προσθήκη χρέωσης
              </button>
            </div>

            {showChargeForm && (
              <div className="mb-4 p-4 rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <div className="space-y-3">
                  <select
                    value={newCharge.type}
                    onChange={(e) => setNewCharge(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
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
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                  <input
                    type="text"
                    value={newCharge.description}
                    onChange={(e) => setNewCharge(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Περιγραφή (προαιρετικό)"
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={addCharge}
                      className="rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowChargeForm(false)}
                      className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {checkInData.additional_charges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between p-3 rounded-lg border border-[#1e4e7d]/70 bg-[#071d38]/90">
                  <div>
                    <span className="text-sm font-medium text-blue-50">{charge.type}</span>
                    <span className="text-sm text-[#55a8ff] ml-2">€{charge.amount}</span>
                    {charge.description && (
                      <p className="text-xs text-blue-100/55 mt-1">{charge.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeCharge(charge.id)}
                    className="text-red-300 hover:text-red-200"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total Additional Charges */}
          {getTotalAdditionalCharges() > 0 && (
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-950/40 p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-white">Σύνολο Επιπλέον Χρεώσεων:</span>
                <span className="text-xl font-bold text-red-300">€{getTotalAdditionalCharges().toFixed(2)}</span>
              </div>
            </div>
          )}

          {fuelSettlementError && fuelDiffPercent <= 0 && (
            <p role="alert" className="text-sm text-red-300">{fuelSettlementError}</p>
          )}
          {/* Fuel charge warning */}
          {(() => {
            const hasFuelCharge = checkInData.additional_charges.some(c => c.type === 'Καύσιμο');
            const fuelSuspicious =
              checkOutFuelLevel != null &&
              checkInData.fuel_level >= checkOutFuelLevel;
            if (!hasFuelCharge || !fuelSuspicious || fuelWarningDismissed) return null;
            return (
              <div className="rounded-lg border border-amber-400/50 bg-amber-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-100">
                      Έχετε προσθέσει χρέωση καυσίμου, αλλά το επίπεδο καυσίμου επιστροφής ({checkInData.fuel_level}%) είναι ίσο ή υψηλότερο από το επίπεδο παράδοσης ({checkOutFuelLevel}%). Ελέγξτε αν η χρέωση είναι σωστή.
                    </p>
                  </div>
                  <button
                    onClick={() => setFuelWarningDismissed(true)}
                    className="text-amber-300 hover:text-amber-100 flex-shrink-0"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })()}
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
            disabled={submitting}
            className="rounded-xl border border-transparent bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Αποθήκευση...' : initialData ? 'Έλεγχος αλλαγών επιστροφής' : 'Ολοκλήρωση Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckInForm;
