import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import PaymentPanel from './PaymentPanel';

interface Props {
  reservationId: string;
  additionalCharges?: number;
  onBalanceChange: (remaining: number | null) => void;
}
export default function HandoverPayments({ reservationId, additionalCharges = 0, onBalanceChange }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    onBalanceChange(null);
    setTotal(null);
    setError(false);
    (async () => {
      try {
        if (!supabase) throw new Error('No database');
        const { data, error } = await supabase.from('reservations').select('total_amount').eq('id', reservationId).single();
        const amount = Number(data?.total_amount);
        if (error || data?.total_amount == null || !Number.isFinite(amount) || amount < 0) throw error || new Error('Invalid total');
        if (!cancelled) setTotal(amount);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [reservationId, onBalanceChange]);
  if (total === null) return <p role="status" className="text-amber-200">{error ? 'Δεν φορτώθηκαν τα οικονομικά. Κλείστε και ανοίξτε ξανά τη φόρμα.' : 'Φόρτωση οικονομικών…'}</p>;
  return <PaymentPanel reservationId={reservationId} totalAmount={total}
    additionalCharges={additionalCharges} onBalanceChange={onBalanceChange} />;
}
