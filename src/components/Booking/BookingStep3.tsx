import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { insuranceService, pricingService } from '../../lib/database';
import type { Insurance, Extra } from '../../types';

interface Pricing {
  days: number;
  rate: number;
  dailyTotal: number;
  insuranceTotal: number;
  extrasTotal: number;
  grandTotal: number;
}

interface BookingStep3Props {
  data: any;
  pricing: Pricing;
  updateData: (data: any) => void;
}

const BookingStep3: React.FC<BookingStep3Props> = ({ data, pricing, updateData }) => {
  const { t } = useLanguage();
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [insData, extData] = await Promise.all([
          insuranceService.getAll(),
          pricingService.getExtras()
        ]);
        if (cancelled) return;
        setInsurances(insData);
        setExtras(extData);
      } catch (err) {
        console.error('Failed to load insurance/extras:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-select first insurance when data loads if none selected
  useEffect(() => {
    if (insurances.length > 0 && !data.insuranceType) {
      const first = insurances[0];
      updateData({
        insuranceType: first.name,
        insuranceRate: Number(first.daily_rate) || 0,
        insuranceId: first.id
      });
    }
  }, [insurances, data.insuranceType]);

  const updateCustomer = (field: string, value: string) => {
    updateData({
      customer: {
        ...data.customer,
        [field]: value
      }
    });
  };

  const updateExtra = (extraId: string, quantity: number) => {
    const current = { ...data.extras };
    if (quantity <= 0) {
      delete current[extraId];
    } else {
      current[extraId] = quantity;
    }
    updateData({ extras: current });
  };

  const selectInsurance = (ins: Insurance) => {
    updateData({
      insuranceType: ins.name,
      insuranceRate: Number(ins.daily_rate) || 0,
      insuranceId: ins.id
    });
  };

  const selectedInsurance = insurances.find(i => i.id === data.insuranceId);

  return (
    <div className="space-y-8">
      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-medium text-white tracking-[-0.02em] mb-4">{t('customerInfo')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder={t('name')}
            value={data.customer?.name || ''}
            onChange={(e) => updateCustomer('name', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <input
            type="tel"
            placeholder={t('phone')}
            value={data.customer?.phone || ''}
            onChange={(e) => updateCustomer('phone', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <input
            type="email"
            placeholder={t('email')}
            value={data.customer?.email || ''}
            onChange={(e) => updateCustomer('email', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <input
            type="text"
            placeholder={t('country')}
            value={data.customer?.country || ''}
            onChange={(e) => updateCustomer('country', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <input
            type="text"
            placeholder={t('licenseNumber')}
            value={data.customer?.licenseNumber || ''}
            onChange={(e) => updateCustomer('licenseNumber', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <input
            type="date"
            placeholder={t('birthDate')}
            value={data.customer?.birthDate || ''}
            onChange={(e) => updateCustomer('birthDate', e.target.value)}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
          <div>
            <label className="block text-sm font-medium text-blue-100/65 mb-1">Πηγή Κράτησης</label>
            <select
              value={data.customer?.source || 'store'}
              onChange={(e) => updateCustomer('source', e.target.value)}
              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
            >
              <option value="store">Κατάστημα</option>
              <option value="phone">Τηλέφωνο</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Ιστοσελίδα</option>
              <option value="repeat">Επαναλαμβανόμενος Πελάτης</option>
              <option value="other">Άλλο</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h3 className="text-lg font-medium text-white tracking-[-0.02em] mb-4">{t('pricingSection')}</h3>

        <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4 space-y-4 text-blue-50">
          <div className="flex justify-between">
            <span>{t('dailyRate')} ({pricing.days} {t('days')})</span>
            <span>€{pricing.dailyTotal.toFixed(2)}</span>
          </div>

          {/* Insurance from DB */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span>{t('insurance')}</span>
            </div>
            {loading ? (
              <div className="text-sm text-blue-100/55">Φόρτωση ασφαλίσεων...</div>
            ) : insurances.length === 0 ? (
              <div className="text-sm text-blue-100/55">Δεν βρέθηκαν ασφαλίσεις</div>
            ) : (
              <div className="space-y-2">
                {insurances.map(ins => (
                  <label key={ins.id} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="insurance"
                      checked={data.insuranceId === ins.id}
                      onChange={() => selectInsurance(ins)}
                      className="mr-2"
                    />
                    <span className="flex-1">{ins.name}</span>
                    <span className="text-sm text-blue-100/65">
                      €{Number(ins.daily_rate).toFixed(2)}/ημέρα
                    </span>
                  </label>
                ))}
                {selectedInsurance && Number(selectedInsurance.daily_rate) > 0 && (
                  <div className="flex justify-between text-sm pl-6">
                    <span>{selectedInsurance.name} ({pricing.days} ημέρες)</span>
                    <span>€{pricing.insuranceTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extras from DB */}
          <div>
            <h4 className="font-medium text-blue-50 mb-2">{t('extras')}</h4>
            {loading ? (
              <div className="text-sm text-blue-100/55">Φόρτωση έξτρα...</div>
            ) : extras.length === 0 ? (
              <div className="text-sm text-blue-100/55">Δεν βρέθηκαν έξτρα</div>
            ) : (
              extras.map(extra => (
                <div key={extra.id} className="flex items-center justify-between mb-2">
                  <span>{extra.name}</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={data.extras?.[extra.id] || 0}
                      onChange={(e) => updateExtra(extra.id, parseInt(e.target.value) || 0)}
                      className="w-16 rounded-lg border border-[#2b5b85]/80 bg-[#0b2949]/80 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                    />
                    <span className="text-sm text-blue-100/65">
                      €{Number(extra.price).toFixed(2)}/{extra.type === 'daily' ? 'ημέρα' : 'εφάπαξ'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[#1e4e7d]/70 pt-4">
            <div className="flex justify-between font-bold text-lg text-white">
              <span>{t('total')}</span>
              <span>€{pricing.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-blue-100/65 mb-2">
          {t('notes')}
        </label>
        <textarea
          value={data.notes || ''}
          onChange={(e) => updateData({ notes: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          placeholder="Επιπλέον σημειώσεις..."
        />
      </div>
    </div>
  );
};

export default BookingStep3;
