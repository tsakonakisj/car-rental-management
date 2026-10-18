import React, { useState, useEffect, useCallback } from 'react';
import { paymentService, paymentRefundService } from '../../lib/database';
import type { PaymentRefund } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import type { Payment } from '../../types';
import { CurrencyEuroIcon, PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface PaymentPanelProps {
  reservationId: string;
  totalAmount: number;
  reservationStatus?: string;
  onPaymentsChanged?: () => void;
}

const methodLabels: Record<string, string> = {
  cash: 'Μετρητά',
  card: 'Κάρτα',
  transfer: 'Μεταφορά',
};

const PaymentPanel: React.FC<PaymentPanelProps> = ({ reservationId, totalAmount, reservationStatus, onPaymentsChanged }) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState('');
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
  const [confirmOverpayment, setConfirmOverpayment] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentData, refundData] = await Promise.all([
        paymentService.getByReservationId(reservationId),
        paymentRefundService.getByReservationId(reservationId),
      ]);
      setPayments(paymentData);
      setRefunds(refundData);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const grossPaid = payments.filter(p => !p.voided_at).reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const amountPaid = grossPaid - totalRefunded;
  const getRefundableAmount = (payment: Payment) =>
    Math.max(0, Math.round(payment.amount * 100) - refunds.filter(r => r.payment_id === payment.id)
      .reduce((sum, r) => sum + Math.round(r.amount * 100), 0)) / 100;
  const balanceCents = Math.round(totalAmount * 100) - Math.round(amountPaid * 100);
  const remaining = Math.max(0, balanceCents) / 100;
  const credit = Math.max(0, -balanceCents) / 100;
  const enteredCents = Math.round(Number(amount) * 100);
  const willOverpay = Number.isFinite(enteredCents) && enteredCents > balanceCents;
  const projectedCredit = Math.max(0, enteredCents - balanceCents) / 100;

  const handleSubmit = async (overpaymentConfirmed = false) => {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || Math.abs(numAmount * 100 - Math.round(numAmount * 100)) > 1e-6) {
      setError('Εισάγετε έγκυρο θετικό ποσό με έως δύο δεκαδικά ψηφία.');
      return;
    }
    if (willOverpay && !overpaymentConfirmed) {
      setConfirmOverpayment(true);
      return;
    }
    setConfirmOverpayment(false);
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
      setConfirmOverpayment(false);
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

  const handleRefund = async () => {
    if (!refundTarget || refundSubmitting) return;
    const refundValue = Number(refundAmount);
    if (!Number.isFinite(refundValue) || refundValue <= 0 ||
        Math.abs(refundValue * 100 - Math.round(refundValue * 100)) > 1e-6 ||
        refundValue > getRefundableAmount(refundTarget) || refundReason.trim().length < 5) {
      setRefundError('Ελέγξτε το ποσό (έως το διαθέσιμο για επιστροφή) και την αιτιολογία.');
      return;
    }
    setRefundSubmitting(true);
    setRefundError('');
    try {
      await paymentRefundService.create({
        payment_id: refundTarget.id,
        amount: refundValue,
        method: refundMethod,
        reason: refundReason,
      });
      setRefundTarget(null);
      setRefundAmount('');
      setRefundReason('');
      await fetchPayments();
      onPaymentsChanged?.();
    } catch (err) {
      console.error('Failed to record refund:', err);
      setRefundError('Η επιστροφή δεν καταχωρίστηκε. Ελέγξτε τα στοιχεία και δοκιμάστε ξανά.');
    } finally {
      setRefundSubmitting(false);
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
            <p className="text-xs text-emerald-300/70 mb-1">Καθαρά εισπραχθέντα</p>
            <p className="text-sm font-semibold text-emerald-300">€{amountPaid.toFixed(2)}</p>
          </div>
          <div className={`rounded-lg border px-2 py-3 ${credit > 0 ? 'bg-sky-500/10 border-sky-400/30' : remaining > 0 ? 'bg-amber-500/10 border-amber-400/30' : 'bg-emerald-500/10 border-emerald-400/30'}`}>
            <p className={`text-xs mb-1 ${credit > 0 ? 'text-sky-300/80' : remaining > 0 ? 'text-amber-300/70' : 'text-emerald-300/70'}`}>{credit > 0 ? 'Επιπλέον εισπραχθέντα' : 'Υπόλοιπο'}</p>
            <p className={`text-sm font-semibold ${credit > 0 ? 'text-sky-300' : remaining > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>€{(credit > 0 ? credit : remaining).toFixed(2)}</p>
          </div>
        </div>
        {totalRefunded > 0 && (
          <p className="text-xs text-blue-100/75">
            Αρχικές ενεργές εισπράξεις: €{grossPaid.toFixed(2)} · Καταχωρισμένες επιστροφές: €{totalRefunded.toFixed(2)}
          </p>
        )}
        {reservationStatus === 'cancelled' && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            Η κράτηση έχει ακυρωθεί. Η ακύρωση δεν επιστρέφει χρήματα αυτόματα.
            Καταχωρίστε επιστροφή μόνο εφόσον έχει πράγματι πραγματοποιηθεί.
          </p>
        )}
        {credit > 0 && <p className="text-xs leading-5 text-sky-200/85">Έχουν εισπραχθεί €{credit.toFixed(2)} περισσότερα από την αξία της κράτησης. Δεν έχει καταχωριστεί αυτόματα επιστροφή χρημάτων.</p>}

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
                  <div className="flex shrink-0 items-center gap-2">
                    {getRefundableAmount(p) > 0 && (
                      <button type="button"
                        onClick={() => {
                          setRefundTarget(p); setRefundAmount(getRefundableAmount(p).toFixed(2));
                          setRefundMethod(p.method); setRefundReason(''); setRefundError('');
                        }}
                        className="rounded-lg border border-sky-400/30 px-2 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/15">
                        Επιστροφή
                      </button>
                    )}
                  {getRefundableAmount(p) === p.amount && (
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
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-blue-100/45 text-center py-2">Δεν έχουν καταχωρηθεί πληρωμές.</p>
        )}

        {refunds.length > 0 && (
          <div className="space-y-2 border-t border-[#2b5b85]/60 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-200">Ιστορικό επιστροφών χρημάτων</h4>
            {refunds.map(refund => (
              <div key={refund.id} className="rounded-lg border border-sky-400/20 bg-sky-500/5 p-3 text-sm">
                <p className="font-semibold text-sky-200">Επιστροφή €{refund.amount.toFixed(2)}</p>
                <p className="mt-1 text-xs text-blue-100/65">
                  {methodLabels[refund.method]} · {new Date(refund.created_at).toLocaleString('el-GR')} · {refund.reason}
                </p>
              </div>
            ))}
          </div>
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
              {amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0 && enteredCents > 0 && enteredCents < balanceCents && (
                <p className="mt-2 rounded-lg border border-sky-400/35 bg-sky-500/10 p-2 text-xs text-sky-200" role="status">
                  Μερική πληρωμή €{(enteredCents / 100).toFixed(2)}. Μετά την καταχώριση θα απομένουν €{((balanceCents - enteredCents) / 100).toFixed(2)}.
                </p>
              )}
              {willOverpay && Number(amount) > 0 && (
                <p className="mt-2 rounded-lg border border-amber-400/35 bg-amber-500/10 p-2 text-xs text-amber-200">
                  Το ποσό υπερβαίνει το υπόλοιπο. Με την καταχώριση θα προκύψουν €{projectedCredit.toFixed(2)} επιπλέον εισπραχθέντα. Θα ζητηθεί επιβεβαίωση.
                </p>
              )}
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
                onClick={() => handleSubmit()}
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
      {refundTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget && !refundSubmitting) setRefundTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title"
            className="w-full max-w-md rounded-2xl border border-sky-400/30 bg-[#0b2949] p-6 text-white shadow-2xl">
            <h2 id="refund-dialog-title" className="text-lg font-semibold">Καταχώριση επιστροφής χρημάτων</h2>
            <p className="mt-2 text-sm text-blue-100/80">
              Αρχική πληρωμή €{refundTarget.amount.toFixed(2)} · Διαθέσιμο για επιστροφή €{getRefundableAmount(refundTarget).toFixed(2)}
            </p>
            <p className="mt-2 text-xs text-amber-200">Καταχώρισε την επιστροφή μόνο αφού τα χρήματα έχουν πραγματικά επιστραφεί στον πελάτη.</p>
            <label className="mt-4 block text-xs text-blue-100/75" htmlFor="refund-amount">Ποσό επιστροφής (€)</label>
            <input id="refund-amount" type="number" min="0.01" step="0.01" max={getRefundableAmount(refundTarget)}
              value={refundAmount} onChange={e => setRefundAmount(e.target.value)} disabled={refundSubmitting}
              className="mt-1 w-full rounded-xl border border-[#2b5b85] bg-[#071d38] px-3 py-2 text-sm text-white" />
            <label className="mt-3 block text-xs text-blue-100/75" htmlFor="refund-method">Τρόπος επιστροφής</label>
            <select id="refund-method" value={refundMethod} onChange={e => setRefundMethod(e.target.value)} disabled={refundSubmitting}
              className="mt-1 w-full rounded-xl border border-[#2b5b85] bg-[#071d38] px-3 py-2 text-sm text-white">
              <option value="cash">Μετρητά</option>
              <option value="card">Κάρτα</option>
              <option value="transfer">Μεταφορά</option>
            </select>
            <label className="mt-3 block text-xs text-blue-100/75" htmlFor="refund-reason">Αιτιολογία (υποχρεωτική)</label>
            <textarea id="refund-reason" rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)}
              disabled={refundSubmitting} placeholder="Π.χ. Επιστροφή προκαταβολής λόγω ακύρωσης"
              className="mt-1 w-full rounded-xl border border-[#2b5b85] bg-[#071d38] p-3 text-sm text-white"/>
            {refundError && <p role="alert" className="mt-2 text-sm text-red-300">{refundError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRefundTarget(null)} disabled={refundSubmitting}
                className="rounded-xl border border-[#2b5b85] px-4 py-2.5 text-sm text-blue-100">Άκυρο</button>
              <button type="button" onClick={handleRefund} disabled={refundSubmitting || !refundAmount || refundReason.trim().length < 5}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {refundSubmitting ? 'Αποθήκευση...' : 'Καταχώριση επιστροφής'}
              </button>
            </div>
          </section>
        </div>
      )}
      {confirmOverpayment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020b18]/85 p-4 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget && !submitting) setConfirmOverpayment(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="overpayment-confirm-title"
            className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0b2949] p-6 text-white shadow-2xl">
            <h2 id="overpayment-confirm-title" className="text-lg font-semibold">Επιβεβαίωση υπερπληρωμής</h2>
            <p className="mt-3 text-sm leading-6 text-blue-100/85">
              Το υπόλοιπο της κράτησης είναι €{remaining.toFixed(2)}.
              Αν καταχωριστούν €{Number(amount).toFixed(2)}, θα υπάρχουν €{projectedCredit.toFixed(2)} επιπλέον εισπραχθέντα.
            </p>
            <p className="mt-2 text-xs text-amber-200">Η επιβεβαίωση καταγράφει είσπραξη, όχι επιστροφή χρημάτων.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={submitting} onClick={() => setConfirmOverpayment(false)}
                className="rounded-xl border border-[#2b5b85] px-4 py-2.5 text-sm font-medium text-blue-100">Διόρθωση ποσού</button>
              <button type="button" disabled={submitting} onClick={() => handleSubmit(true)}
                className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {submitting ? 'Καταχώριση...' : 'Καταχώριση παρ’ όλα αυτά'}
              </button>
            </div>
          </section>
        </div>
      )}
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
