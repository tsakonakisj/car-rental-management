import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { pricingService, vehicleService } from '../../lib/database';
import type { Season, Pricing } from '../../types';
import PageHero from '../Layout/PageHero';
import {
  CurrencyEuroIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CalendarDaysIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Extra {
  id: string;
  name: string;
  name_en: string;
  type: 'daily' | 'one-time';
  price: number;
}

const PricingManagement: React.FC = () => {
  const { t } = useLanguage();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{ category: string; seasonId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ category: string; seasonId: string; ok: boolean } | null>(null);

  const [extras] = useState<Extra[]>([
    { id: '1', name: 'Παιδικό Κάθισμα', name_en: 'Child Seat', type: 'daily', price: 5 },
    { id: '2', name: 'Δεύτερος Οδηγός', name_en: 'Additional Driver', type: 'one-time', price: 25 },
    { id: '3', name: 'GPS', name_en: 'GPS Navigation', type: 'daily', price: 8 },
    { id: '4', name: 'Φορτιστής Κινητού', name_en: 'Phone Charger', type: 'daily', price: 3 }
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seasonData, pricingData, vehicles] = await Promise.all([
        pricingService.getSeasons(),
        pricingService.getPricing(),
        vehicleService.getAll(),
      ]);

      const sortedSeasons = [...seasonData].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      );
      setSeasons(sortedSeasons);
      setPricing(pricingData);

      const uniqueCats = Array.from(new Set(vehicles.map(v => v.category))).sort();
      setCategories(uniqueCats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRate = (category: string, seasonId: string): number | null => {
    const row = pricing.find(p => p.category === category && p.season_id === seasonId);
    return row ? Number(row.daily_rate) : null;
  };

  const startEdit = (category: string, seasonId: string) => {
    const current = getRate(category, seasonId);
    setEditCell({ category, seasonId });
    setEditValue(current !== null ? String(current) : '');
  };

  const cancelEdit = () => {
    setEditCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const rate = parseFloat(editValue);
    if (isNaN(rate) || rate < 0) return;

    setSaving(true);
    try {
      await pricingService.upsertRate(editCell.category, editCell.seasonId, rate);
      setPricing(prev => {
        const idx = prev.findIndex(
          p => p.category === editCell.category && p.season_id === editCell.seasonId
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], daily_rate: rate };
          return updated;
        }
        return [...prev, { id: Date.now().toString(), category: editCell.category, daily_rate: rate, season_id: editCell.seasonId }];
      });
      setSaveStatus({ category: editCell.category, seasonId: editCell.seasonId, ok: true });
      setEditCell(null);
      setEditValue('');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus({ category: editCell.category, seasonId: editCell.seasonId, ok: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const formatSeasonRange = (s: Season): string => {
    if (s.start_month && s.end_month) {
      const start = `${s.start_day ?? 1}/${s.start_month}`;
      const end = `${s.end_day ?? 31}/${s.end_month}`;
      return `${start} - ${end}`;
    }
    return `${new Date(s.start_date).toLocaleDateString('el-GR')} - ${new Date(s.end_date).toLocaleDateString('el-GR')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="h-6 w-6 text-blue-100/45 animate-spin" />
        <span className="ml-2 text-blue-100/55">Φόρτωση...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/45 border border-red-400/30 rounded-2xl p-6">
        <p className="text-sm text-red-100">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/25"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Δοκιμάστε ξανά
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        title={t('pricing')}
        subtitle="Διαχείριση τιμών και εποχών"
        actions={(
          <button
            onClick={loadData}
            className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Ανανέωση
          </button>
        )}
      />

      {/* Seasons */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Σεζόν</h2>
            <button className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Σεζόν
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {seasons.map((season) => (
              <div key={season.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white">{season.name}</h3>
                  <span className="text-xs font-medium text-blue-100/70 bg-slate-500/15 ring-1 ring-inset ring-slate-400/35 px-2 py-0.5 rounded">
                    #{season.priority ?? 0}
                  </span>
                </div>
                <div className="flex items-center text-sm text-blue-100/65 mb-3">
                  <CalendarDaysIcon className="h-4 w-4 mr-1" />
                  {formatSeasonRange(season)}
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white">
                    <PencilIcon className="h-3 w-3 mr-1" />
                    Επεξεργασία
                  </button>
                  <button className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25">
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Matrix */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <h2 className="text-base font-semibold text-white">Τιμές ανά Κατηγορία & Σεζόν</h2>
          <p className="text-sm text-blue-100/55 mt-1">
            Κάντε κλικ σε ένα κελί για να εισάγετε ή να τροποποιήσετε την τιμή.
          </p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#1e4e7d]/70">
                  <th className="text-left py-3 pr-4 text-sm font-medium text-blue-100/55">Κατηγορία</th>
                  {seasons.map((season) => (
                    <th key={season.id} className="text-center py-3 px-4 text-sm font-medium text-blue-100/55">
                      {season.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e4e7d]/70">
                {categories.map((category) => (
                  <tr key={category} className="hover:bg-[#0b2949]/40">
                    <td className="py-4 pr-4 text-sm font-medium text-white">{category}</td>
                    {seasons.map((season) => {
                      const rate = getRate(category, season.id);
                      const isEditing =
                        editCell?.category === category && editCell?.seasonId === season.id;
                      const status = saveStatus?.category === category && saveStatus?.seasonId === season.id
                        ? saveStatus
                        : null;

                      return (
                        <td key={season.id} className="text-center py-4 px-4">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                                className="w-20 text-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                                placeholder="—"
                              />
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="p-1 text-emerald-400 hover:bg-emerald-500/15 rounded transition-colors"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="p-1 text-blue-100/45 hover:bg-[#0b2949]/60 rounded transition-colors"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(category, season.id)}
                              className="inline-flex items-center group"
                            >
                              {rate !== null ? (
                                <>
                                  <CurrencyEuroIcon className="h-4 w-4 text-emerald-400 mr-1" />
                                  <span className="text-sm font-medium text-white group-hover:text-[#55a8ff] transition-colors">
                                    {rate.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-blue-100/55 ml-1">/ημέρα</span>
                                </>
                              ) : (
                                <span className="text-sm text-blue-100/45 group-hover:text-[#55a8ff] group-hover:underline transition-colors">
                                  — Κλικ για προσθήκη
                                </span>
                              )}
                              {status && (
                                <span className={`ml-2 text-xs ${status.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {status.ok ? '✓' : '✗'}
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Insurance Rates */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Ασφάλεια</h2>
            <button className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Ασφάλεια
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
              <h3 className="font-medium text-white mb-2">Βασική Ασφάλεια</h3>
              <p className="text-sm text-blue-100/65 mb-3">Περιλαμβάνεται στην τιμή</p>
              <div className="text-2xl font-bold text-emerald-400">€0/ημέρα</div>
            </div>
            <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
              <h3 className="font-medium text-white mb-2">Πλήρης Ασφάλεια</h3>
              <p className="text-sm text-blue-100/65 mb-3">Χωρίς απαλλαγή</p>
              <div className="text-2xl font-bold text-[#55a8ff]">€15/ημέρα</div>
            </div>
          </div>
        </div>
      </div>

      {/* Extras */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Έξτρα</h2>
            <button className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέο Έξτρα
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extras.map((extra) => (
              <div key={extra.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{extra.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    extra.type === 'daily' ? 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40' : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40'
                  }`}>
                    {extra.type === 'daily' ? 'Ημερήσιο' : 'Εφάπαξ'}
                  </span>
                </div>
                <p className="text-sm text-blue-100/65 mb-3">{extra.name_en}</p>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-emerald-400">
                    €{extra.price}/{extra.type === 'daily' ? 'ημέρα' : 'εφάπαξ'}
                  </div>
                  <div className="flex space-x-2">
                    <button className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white">
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Επεξεργασία
                    </button>
                    <button className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25">
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingManagement;
