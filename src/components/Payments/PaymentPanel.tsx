import React, { useState, useEffect, useCallback } from 'react';
import { paymentService } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import type { Payment } from '../../types';
import { CurrencyEuroIcon, PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface PaymentPanelProps {
  reservationId: string;
  totalAmount: number;
  onPaymentsChanged?: () => void;
}

const methodLabels: Record<string, string> = {
  cash: 'Μετρητά',
  card: 'Κάρτα',
  transfer: 'Μεταφορά',
};

const PaymentPanel: React.FC<PaymentPanelProps> = ({ reservationId, totalAmount, onPaymentsChanged }) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidError, setVoidError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await paymentService.getByReservationId(reservationId);
      setPayments(data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const amountPaid = payments.filter(p => !p.voided_at).reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totalAmount - amountPaid);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Εισάγετε έγκυρο ποσό.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await paymentService.create({
        reservation_id: reservationId,
        amount: numAmount,
        method,
        notes: notes.trim() || undefined,
      });
      setAmount('');
      setNotes('');
      setMethod('cash');
      setShowForm(false);
      await fetchPayments();
      onPaymentsChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης πληρωμής.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget || voidReason.trim().length < 5 || voidSubmitting) return;
    setVoidSubmitting(true);
    setVoidError('');
    try {
      await paymentService.void(voidTarget.id, voidReason);
      setVoidTarget(null);
      setVoidReason('');
      await fetchPayments();
      onPaymentsChanged?.();
    } catch (err) {
      console.error('Failed to void payment:', err);
      setVoidError('Η ακύρωση δεν ολοκληρώθηκε. Ελέγξτε τα δικαιώματα και δοκιμάστε ξανά.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const setQuickAmount = (value: number) => {
    setAmount(value.toFixed(2));
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-blue-100/55 mb-2">Πληρωμές</h3>
      <div className="bg-[#0b2949]/70 rounded-lg p-4 space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-[#071d38]/80 border border-[#1e4e7d]/60 px-2 py-3">
            <p className="text-xs text-blue-100/55 mb-1">Σύνολο</p>
            <p className="text-sm font-semibold text-white">€{totalAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-2 py-3">
            <p className="text-xs text-emerald-300/70 mb-1">Πληρωμένο</p>
            <p className="text-sm font-semibold text-emerald-300">€{amountPaid.toFixed(2)}</p>
          </div>
          <div className={`rounded-lg border px-2 py-3 ${remaining > 0 ? 'bg-amber-500/10 border-amber-400/30' : 'bg-emerald-500/10 border-emerald-400/30'}`}>
            <p className={`text-xs mb-1 ${remaining > 0 ? 'text-amber-300/70' : 'text-emerald-300/70'}`}>Υπόλοιπο</p>
            <p className={`text-sm font-semibold ${remaining > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>€{remaining.toFixed(2)}</p>
          </div>
        </div>

        {/* Payment history */}
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <ArrowPathIcon className="h-4 w-4 text-[#55a8ff] animate-spin mr-2" />
            <span className="text-sm text-blue-100/55">Φόρτωση πληρωμών...</span>
          </div>
        ) : payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between rounded-lg bg-[#071d38]/60 border border-[#1e4e7d]/50 px-3 py-2 ${p.voided_at ? "opacity-65" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-medium text-emerald-300">
                    {i + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${p.voided_at ? "text-blue-100/50 line-through" : "text-white"}`}>€{p.amount.toFixed(2)} {p.voided_at ? "· Ακυρώθηκε" : ""}</p>
                    <p className="text-xs text-blue-100/55">
                      {methodLabels[p.method] || p.method}
                      {p.notes ? ` · ${p.notes}` : ''}
                      {' · '}
                      {new Date(p.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    {p.voided_at && (
                      <p className="text-xs text-amber-200/80">
                        Ακύρωση: {new Date(p.voided_at).toLocaleString('el-GR')} · {p.void_reason || '-'}
                      </p>
                    )}
                  </div>
                </div>
                {!p.voided_at && user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => { setVoidTarget(p); setVoidReason(''); setVoidError(''); }}
                    className="text-blue-100/50 hover:text-amber-300 transition-colors p-1"
                    title="Ακύρωση πληρωμής με ιστορικό"
                    aria-label="Ακύρωση πληρωμής"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-blue-100/45 text-center py-2">Δεν έχουν καταχωρηθεί πληρωμές.</p>
        )}

        {/* Add payment form */}
        {showForm ? (
          <div className="space-y-3 rounded-lg border border-[#2f8cff]/30 bg-[#071d38]/80 p-3">
            <div>
              <label className="block text-xs text-blue-100/55 mb-1">Ποσό (€)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#0b2949] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                autoFocus
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setQuickAmount(remaining)}
                  disabled={remaining <= 0}
                  className="rounded-lg border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Πλήρες Υπόλοιπο
                </button>
                <button
                  onClick={() => setQuickAmount(totalAmount / 2)}
                  className="rounded-lg border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d]"
                >
                  50% Προκαταβολή
                </button>
                <button
                  onClick={() => setQuickAmount(totalAmount * 0.3)}
                  className="rounded-lg border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d]"
                >
                  30% Προκαταβολή
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-blue-100/55 mb-1">Τρόπος Πληρωμής</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#0b2949] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
              >
                <option value="cash">Μετρητά</option>
                <option value="card">Κάρτα</option>
                <option value="transfer">Μεταφορά</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-blue-100/55 mb-1">Σημειώσεις (προαιρετικά)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="πχ. Αριθμός απόδειξης"
                className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#0b2949] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setError(''); setAmount(''); setNotes(''); }}
                disabled={submitting}
                className="rounded-lg border border-[#2b5b85]/80 px-3 py-1.5 text-sm font-medium text-blue-100/85 bg-[#0b2949]/70 hover:bg-[#0b2949] disabled:opacity-50"
              >
                Άκυρο
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !amount}
                className="inline-flex items-center rounded-lg border border-transparent bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Αποθήκευση...' : 'Καταχώρηση'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full inline-flex items-center justify-center rounded-lg border border-dashed border-[#2b5b85]/80 bg-[#0b2949]/40 px-3 py-2.5 text-sm font-medium text-blue-100/75 transition-colors hover:border-[#55a8ff] hover:bg-[#0b2949]/70 hover:text-white"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Προσθήκη Πληρωμής
          </button>
        )}
      </div>
      {voidTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget && !voidSubmitting) setVoidTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-void-title" className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0b2949] p-6 text-white shadow-2xl">
            <h2 id="payment-void-title" className="text-lg font-semibold">Ακύρωση καταχωρισμένης πληρωμής</h2>
            <p className="mt-3 text-sm text-blue-100/80">
              Πληρωμή €{voidTarget.amount.toFixed(2)}. Η κίνηση θα παραμείνει στο ιστορικό, αλλά δεν θα μετρά πλέον στο εισπραχθέν ποσό.
            </p>
            <label className="mt-4 block text-sm font-medium text-white" htmlFor="payment-void-reason">Αιτιολογία ακύρωσης (υποχρεωτική)</label>
            <textarea id="payment-void-reason" rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)}
              placeholder="Π.χ. Λανθασμένη καταχώριση ποσού" disabled={voidSubmitting}
              className="mt-2 w-full rounded-xl border border-[#2b5b85] bg-[#071d38] p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50" />
            {voidError && <p role="alert" className="mt-2 text-sm text-red-300">{voidError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={voidSubmitting} onClick={() => setVoidTarget(null)}
                className="rounded-xl border border-[#2b5b85] px-4 py-2 text-sm font-medium text-blue-100">Επιστροφή</button>
              <button type="button" disabled={voidSubmitting || voidReason.trim().length < 5} onClick={handleVoid}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {voidSubmitting ? 'Ακύρωση...' : 'Επιβεβαίωση ακύρωσης'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default PaymentPanel;
