import React, { useEffect, useState } from 'react';
import { checkinCorrectionService, type CheckinCorrectionContext } from '../../lib/database';

interface Props { reservationId: string; onClose: () => void; onSaved: () => void }

const CheckInCorrection: React.FC<Props> = ({ reservationId, onClose, onSaved }) => {
  const [context, setContext] = useState<CheckinCorrectionContext | null>(null);
  const [fuel, setFuel] = useState(100);
  const [odometer, setOdometer] = useState(0);
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [charges, setCharges] = useState<Array<{ type: string; amount: number; description: string }>>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    checkinCorrectionService.load(reservationId).then(data => {
      if (!live) return;
      setContext(data); setFuel(data.checkin.fuel_level); setOdometer(data.checkin.odometer);
      setCharges((data.checkin.additional_charges || []).filter(c => c.type !== 'Καύσιμο'));
    }).catch(() => { if (live) setError('Δεν φορτώθηκε το Check-In. Απαιτείται λογαριασμός Admin και ολοκληρωμένη επιστροφή.'); });
    return () => { live = false; };
  }, [reservationId]);
  const lockedFuel = !!context?.waiver;
  const liters = context ? Math.max(0, context.checkout_fuel - fuel) / 100 * (context.tank_capacity || 0) : 0;
  const preserveFuel = lockedFuel || (!!context && fuel === context.checkin.fuel_level && price === '');
  const fuelAmount = preserveFuel
    ? (context?.checkin.additional_charges || []).filter(c => c.type === 'Καύσιμο').reduce((sum, c) => sum + Number(c.amount), 0)
    : Math.round(liters * Number(price) * 100) / 100;
  const save = async () => {
    if (!context || saving) return;
    setError(''); setSaving(true);
    try {
      await checkinCorrectionService.correct({ reservation_id: reservationId, expected_revision: context.checkin.correction_revision,
        fuel_level: fuel, odometer, fuel_price: preserveFuel || liters <= 0 ? null : Number(price), non_fuel_charges: charges, reason });
      onSaved();
    } catch (err) {
      const message = (err as { message?: string }).message || '';
      setError(message.includes('STALE') ? 'Τα στοιχεία άλλαξαν. Κλείστε και ανοίξτε ξανά τη διόρθωση.'
        : message.includes('LATER_MOVEMENT') ? 'Υπάρχει μεταγενέστερη κίνηση του οχήματος. Τα χιλιόμετρα αυτής της επιστροφής δεν μπορούν να αλλάξουν.'
        : message.includes('FUEL_LOCKED') ? 'Υπάρχει αίτημα εξαίρεσης καυσίμου. Ανοίξτε ξανά τη φόρμα για ενημερωμένα στοιχεία.'
        : 'Δεν αποθηκεύτηκε η διόρθωση. Ελέγξτε τιμές, τιμή καυσίμου, χρεώσεις και αιτιολογία.');
    } finally { setSaving(false); }
  };
  const field = 'mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#071d38] p-2 text-white disabled:opacity-50';
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020b18]/90 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="correction-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#2b5b85] bg-[#0b2949] p-6 text-white">
      <h2 id="correction-title" className="text-xl font-semibold">Διόρθωση Check-In</h2>
      <p className="mt-2 text-sm text-blue-100/70">Η επιστροφή παραμένει ολοκληρωμένη. Κάθε αλλαγή αποθηκεύεται στο ιστορικό μαζί με το όνομα του Admin και την αιτιολογία.</p>
      {context && <fieldset disabled={saving} className="mt-4 space-y-4">
        {lockedFuel && <p className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-100">Υπάρχει αίτημα εξαίρεσης ({context.waiver?.status === 'pending' ? 'εκκρεμές' : context.waiver?.status === 'approved' ? 'εγκεκριμένο' : 'απορριφθέν'}). Το καύσιμο και η σχετική χρέωση παραμένουν κλειδωμένα.</p>}
        <div className="grid grid-cols-2 gap-4">
          <label>Καύσιμο επιστροφής (%)<input type="number" min={0} max={100} step={1} disabled={lockedFuel} value={fuel} onChange={e => setFuel(Number(e.target.value))} className={field} /></label>
          <label>Χιλιόμετρα επιστροφής<input type="number" min={context.checkout_odometer} step={1} value={odometer} onChange={e => setOdometer(Number(e.target.value))} className={field} /></label>
        </div>
        {!lockedFuel && fuel < context.checkout_fuel && <label className="block">Τιμή καυσίμου ανά λίτρο (€)<input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={field} /><span className="mt-1 block text-sm">Έλλειμμα: {liters.toFixed(2)} L · Χρέωση: €{fuelAmount.toFixed(2)}{preserveFuel && ' — διατηρείται η υπάρχουσα χρέωση'}{!context.tank_capacity && ' — απαιτείται χωρητικότητα ρεζερβουάρ στον Στόλο'}</span></label>}
        <div><h3 className="font-semibold">Λοιπές επιπλέον χρεώσεις</h3>
          {charges.map((c, i) => <div key={i} className="mt-2 flex flex-wrap gap-2">
            <input aria-label="Τύπος χρέωσης" value={c.type} onChange={e => setCharges(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className={`${field} !w-32`} />
            <input aria-label="Ποσό χρέωσης" type="number" min={0} step="0.01" value={c.amount} onChange={e => setCharges(prev => prev.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} className={`${field} !w-24`} />
            <input aria-label="Περιγραφή χρέωσης" value={c.description} onChange={e => setCharges(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className={`${field} !w-48`} />
            <button type="button" onClick={() => setCharges(prev => prev.filter((_, j) => i !== j))} className="text-red-300">Αφαίρεση</button>
          </div>)}
          <button type="button" className="mt-2 text-blue-200" onClick={() => setCharges(prev => [...prev, { type: 'Άλλο', amount: 0, description: '' }])}>+ Προσθήκη χρέωσης</button>
        </div>
        <p className="font-semibold">Νέο σύνολο επιπλέον χρεώσεων: €{(charges.reduce((sum, c) => sum + c.amount, 0) + fuelAmount).toFixed(2)}</p>
        <p className="text-sm text-blue-100/70">Οι ήδη καταχωρισμένες ζημιές και φωτογραφίες διατηρούνται.</p>
        <label className="block">Αιτιολογία διόρθωσης (υποχρεωτική)<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className={field} /></label>
        {context.history.length > 0 && <details><summary className="cursor-pointer">Ιστορικό διορθώσεων ({context.history.length})</summary>{context.history.map(h => <div key={h.id} className="mt-3 rounded-lg border border-[#2b5b85] p-3 text-sm">
          <p>{h.actor_name} · {new Date(h.corrected_at).toLocaleString('el-GR')}</p><p>{h.reason}</p>
          <p>Καύσιμο: {h.before_data.fuel_level}% → {h.after_data.fuel_level}% · Χλμ: {h.before_data.odometer} → {h.after_data.odometer}</p>
          <p>Χρεώσεις πριν: {JSON.stringify(h.before_data.additional_charges)}</p><p>Χρεώσεις μετά: {JSON.stringify(h.after_data.additional_charges)}</p>
        </div>)}</details>}
      </fieldset>}
      {!context && !error && <p className="mt-4">Φόρτωση...</p>}
      {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
      <div className="mt-5 flex justify-end gap-3"><button autoFocus type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-[#2b5b85] px-4 py-2">Ακύρωση</button><button type="button" disabled={!context || saving || reason.trim().length < 5} onClick={save} className="rounded-lg bg-[#1268f3] px-4 py-2 disabled:opacity-40">{saving ? 'Αποθήκευση...' : 'Αποθήκευση διόρθωσης'}</button></div>
    </section>
  </div>;
};
export default CheckInCorrection;
