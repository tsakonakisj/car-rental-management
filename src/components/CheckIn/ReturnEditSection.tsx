import React, { useEffect, useState } from 'react';
import CheckInForm, { type CheckInData } from './CheckInForm';
import { photoService, rentalActionError, returnLifecycleService, type ReturnContext } from '../../lib/database';

interface Props { reservationId: string; onCancel: () => void; onSaved: () => void }
const ReturnEditSection: React.FC<Props> = ({ reservationId, onCancel, onSaved }) => {
  const [loaded, setLoaded] = useState<{ context: ReturnContext; initial: CheckInData; price: number } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([returnLifecycleService.load(reservationId), photoService.getPhotos('checkin', reservationId)]).then(([context, photos]) => {
      if (!live) return;
      const liters = Math.max(0, context.checkout_fuel - context.checkin.fuel_level) / 100 * (context.tank_capacity || 0);
      const fuelCharge = (context.checkin.additional_charges || []).find(c => c.type === 'Καύσιμο');
      const price = context.waiver ? Number(context.waiver.fuel_price_per_liter) : liters > 0 && fuelCharge ? Math.round(Number(fuelCharge.amount) / liters * 100) / 100 : 0;
      setLoaded({ context, price, initial: {
        fuel_level: context.checkin.fuel_level, odometer: context.checkin.odometer, photos,
        additional_charges: (context.checkin.additional_charges || []).map((c, i) => ({ ...c, amount: Number(c.amount), id: `saved-charge-${i}` })),
        new_damages: (context.damages || []).map(d => ({ id: d.id, description: d.description, estimated_cost: d.estimated_cost == null ? undefined : Number(d.estimated_cost) })),
        fuel_price: price || null,
        fuel_waiver_reason: context.waiver && context.waiver.status !== 'rejected' ? context.waiver.reason : null,
      } });
    }).catch(err => { if (live) setError(rentalActionError(err)); });
    return () => { live = false; };
  }, [reservationId]);
  const save = async (data: CheckInData) => {
    if (!loaded || saving) return;
    setSaving(true); setError('');
    try { await returnLifecycleService.edit(reservationId, loaded.context, data, reason); onSaved(); }
    catch (err) { setError(rentalActionError(err)); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4">
    <p className="text-sm text-blue-100/75">Διορθώστε τα αποθηκευμένα στοιχεία επιστροφής. Η κράτηση παραμένει ολοκληρωμένη. Οι πληρωμές διατηρούνται.</p>
    <label className="block text-sm text-blue-100">Αιτιολογία αλλαγής (υποχρεωτική)
      <textarea value={reason} onChange={e => setReason(e.target.value)} disabled={saving} maxLength={2000} rows={2} className="mt-2 w-full rounded-lg border border-[#2b5b85] bg-[#0b2949] p-3 text-white" />
    </label>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!loaded && !error && <p className="text-blue-100">Φόρτωση επιστροφής...</p>}
    {loaded && <>
      {loaded.context.waiver && <p className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-100">Υπάρχει απόφαση ή αίτημα εξαίρεσης καυσίμου. Αν αλλάξετε τη σχετική χρέωση ή το έλλειμμα, η προηγούμενη απόφαση διατηρείται στο ιστορικό και καταχωρίζεται η νέα τακτοποίηση.</p>}
      <CheckInForm reservationId={reservationId} vehicleFuelTankCapacity={loaded.context.tank_capacity} initialData={loaded.initial} initialFuelPrice={loaded.price} correctionReason={reason} onComplete={save} onCancel={onCancel} submitting={saving} />
      <details className="rounded-lg border border-[#2b5b85] p-3 text-sm text-blue-100"><summary className="cursor-pointer">Ιστορικό επιστροφής</summary>
        {loaded.context.history.map(h => <p key={h.id} className="mt-2">{h.actor_name} · {new Date(h.corrected_at).toLocaleString('el-GR')} · {h.reason}</p>)}
        {loaded.context.status_history.map(h => <p key={h.id} className="mt-2">{h.actor_name} · {new Date(h.created_at).toLocaleString('el-GR')} · Αναίρεση: {h.reason}</p>)}
        {loaded.context.history.length === 0 && loaded.context.status_history.length === 0 && <p className="mt-2">Δεν έχουν καταγραφεί διορθώσεις ή αναιρέσεις.</p>}
      </details>
    </>}
  </div>;
};
export default ReturnEditSection;
