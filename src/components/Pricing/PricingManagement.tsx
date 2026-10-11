import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { pricingService, vehicleService, insuranceService } from '../../lib/database';
import type { Season, Pricing, Extra as ExtraType, Insurance as InsuranceType } from '../../types';
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

  const [extras, setExtras] = useState<ExtraType[]>([]);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [editExtraForm, setEditExtraForm] = useState<Partial<ExtraType> | null>(null);
  const [savingExtra, setSavingExtra] = useState(false);

  const [insurances, setInsurances] = useState<InsuranceType[]>([]);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [editInsuranceForm, setEditInsuranceForm] = useState<Partial<InsuranceType> | null>(null);
  const [savingInsurance, setSavingInsurance] = useState(false);

  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editSeasonForm, setEditSeasonForm] = useState<Partial<Season> | null>(null);
  const [savingSeason, setSavingSeason] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seasonData, pricingData, vehicles, extrasData, insuranceData] = await Promise.all([
        pricingService.getSeasons(),
        pricingService.getPricing(),
        vehicleService.getAll(),
        pricingService.getExtras(),
        insuranceService.getAll(),
      ]);
      setExtras(extrasData);
      setInsurances(insuranceData);

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

  const saveExtraEdit = async () => {
    if (!editingExtraId || !editExtraForm) return;
    const price = parseFloat(String(editExtraForm.price));
    if (isNaN(price) || price < 0) return;
    setSavingExtra(true);
    try {
      await pricingService.updateExtra(editingExtraId, {
        name: editExtraForm.name,
        name_en: editExtraForm.name_en,
        type: editExtraForm.type,
        price,
      });
      setExtras(prev => prev.map(e => e.id === editingExtraId ? { ...e, name: editExtraForm.name!, name_en: editExtraForm.name_en!, type: editExtraForm.type as Extra['type'], price } : e));
      setEditingExtraId(null);
      setEditExtraForm(null);
    } catch (err) {
      console.error('Failed to update extra:', err);
    } finally {
      setSavingExtra(false);
    }
  };

  const cancelExtraEdit = () => {
    setEditingExtraId(null);
    setEditExtraForm(null);
  };

  const startSeasonEdit = (season: Season) => {
    setEditingSeasonId(season.id);
    setEditSeasonForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      multiplier: season.multiplier,
      start_month: season.start_month,
      start_day: season.start_day,
      end_month: season.end_month,
      end_day: season.end_day,
      priority: season.priority,
    });
  };

  const cancelSeasonEdit = () => {
    setEditingSeasonId(null);
    setEditSeasonForm(null);
  };

  const saveSeasonEdit = async () => {
    if (!editingSeasonId || !editSeasonForm) return;
    setSavingSeason(true);
    try {
      await pricingService.updateSeason(editingSeasonId, editSeasonForm);
      setSeasons(prev => prev.map(s => s.id === editingSeasonId ? { ...s, ...editSeasonForm } as Season : s));
      setEditingSeasonId(null);
      setEditSeasonForm(null);
    } catch (err) {
      console.error('Failed to update season:', err);
    } finally {
      setSavingSeason(false);
    }
  };

  const startInsuranceEdit = (insurance: InsuranceType) => {
    setEditingInsuranceId(insurance.id);
    setEditInsuranceForm({
      name: insurance.name,
      name_en: insurance.name_en,
      daily_rate: insurance.daily_rate,
    });
  };

  const cancelInsuranceEdit = () => {
    setEditingInsuranceId(null);
    setEditInsuranceForm(null);
  };

  const saveInsuranceEdit = async () => {
    if (!editingInsuranceId || !editInsuranceForm) return;
    const rate = parseFloat(String(editInsuranceForm.daily_rate));
    if (isNaN(rate) || rate < 0) return;
    setSavingInsurance(true);
    try {
      await insuranceService.updateInsurance(editingInsuranceId, {
        name: editInsuranceForm.name,
        name_en: editInsuranceForm.name_en,
        daily_rate: rate,
      });
      setInsurances(prev => prev.map(i => i.id === editingInsuranceId ? { ...i, name: editInsuranceForm.name!, name_en: editInsuranceForm.name_en!, daily_rate: rate } : i));
      setEditingInsuranceId(null);
      setEditInsuranceForm(null);
    } catch (err) {
      console.error('Failed to update insurance:', err);
    } finally {
      setSavingInsurance(false);
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
            {seasons.map((season) => {
              const isEditingSeason = editingSeasonId === season.id;
              return (
              <div key={season.id} className={`rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4 ${isEditingSeason ? 'md:col-span-2 lg:col-span-4' : ''}`}>
                {isEditingSeason && editSeasonForm ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                        <input
                          type="text"
                          value={editSeasonForm.name || ''}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, name: e.target.value })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Ημ. Έναρξης</label>
                        <input
                          type="date"
                          value={editSeasonForm.start_date ? editSeasonForm.start_date.split('T')[0] : ''}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, start_date: e.target.value })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Ημ. Λήξης</label>
                        <input
                          type="date"
                          value={editSeasonForm.end_date ? editSeasonForm.end_date.split('T')[0] : ''}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, end_date: e.target.value })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Προτεραιότητα</label>
                        <input
                          type="number"
                          value={editSeasonForm.priority ?? 0}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, priority: parseInt(e.target.value) })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Πολλαπλασιαστής</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editSeasonForm.multiplier ?? 1}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, multiplier: parseFloat(e.target.value) })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelSeasonEdit}
                        disabled={savingSeason}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-xs font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
                      >
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Άκυρο
                      </button>
                      <button
                        onClick={saveSeasonEdit}
                        disabled={savingSeason}
                        className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
                      >
                        <CheckIcon className="h-3 w-3 mr-1" />
                        {savingSeason ? 'Αποθήκευση...' : 'Αποθήκευση'}
                      </button>
                    </div>
                  </div>
                ) : (
                <>
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
                    <button
                      onClick={() => startSeasonEdit(season)}
                      className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    >
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Επεξεργασία
                    </button>
                    <button className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25">
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                </>
                )}
              </div>
              );
            })}
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
            {insurances.map((insurance) => {
              const isEditingInsurance = editingInsuranceId === insurance.id;
              return (
              <div key={insurance.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                {isEditingInsurance && editInsuranceForm ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                      <input
                        type="text"
                        value={editInsuranceForm.name || ''}
                        onChange={e => setEditInsuranceForm({ ...editInsuranceForm, name: e.target.value })}
                        className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-100/55 mb-1">Όνομα (EN)</label>
                      <input
                        type="text"
                        value={editInsuranceForm.name_en || ''}
                        onChange={e => setEditInsuranceForm({ ...editInsuranceForm, name_en: e.target.value })}
                        className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-100/55 mb-1">Ημερήσιο Τέλος (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editInsuranceForm.daily_rate ?? 0}
                        onChange={e => setEditInsuranceForm({ ...editInsuranceForm, daily_rate: parseFloat(e.target.value) })}
                        className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelInsuranceEdit}
                        disabled={savingInsurance}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-xs font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
                      >
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Άκυρο
                      </button>
                      <button
                        onClick={saveInsuranceEdit}
                        disabled={savingInsurance}
                        className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
                      >
                        <CheckIcon className="h-3 w-3 mr-1" />
                        {savingInsurance ? 'Αποθήκευση...' : 'Αποθήκευση'}
                      </button>
                    </div>
                  </div>
                ) : (
                <>
                  <h3 className="font-medium text-white mb-2">{insurance.name}</h3>
                  <p className="text-sm text-blue-100/65 mb-3">{insurance.name_en}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-emerald-400">
                      €{Number(insurance.daily_rate || 0).toFixed(0)}/ημέρα
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startInsuranceEdit(insurance)}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                      >
                        <PencilIcon className="h-3 w-3 mr-1" />
                        Επεξεργασία
                      </button>
                      <button className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25">
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </>
                )}
              </div>
              );
            })}
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
            {extras.map((extra) => {
              const isEditingExtra = editingExtraId === extra.id;
              return (
              <div key={extra.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
                {isEditingExtra && editExtraForm ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                        <input
                          type="text"
                          value={editExtraForm.name || ''}
                          onChange={e => setEditExtraForm({ ...editExtraForm, name: e.target.value })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-100/55 mb-1">Όνομα (EN)</label>
                        <input
                          type="text"
                          value={editExtraForm.name_en || ''}
                          onChange={e => setEditExtraForm({ ...editExtraForm, name_en: e.target.value })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-blue-100/55 mb-1">Τύπος</label>
                          <select
                            value={editExtraForm.type || 'daily'}
                            onChange={e => setEditExtraForm({ ...editExtraForm, type: e.target.value as Extra['type'] })}
                            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                          >
                            <option value="daily">Ημερήσιο</option>
                            <option value="one-time">Εφάπαξ</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-blue-100/55 mb-1">Τιμή (€)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editExtraForm.price ?? 0}
                            onChange={e => setEditExtraForm({ ...editExtraForm, price: parseFloat(e.target.value) })}
                            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelExtraEdit}
                        disabled={savingExtra}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-xs font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
                      >
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Άκυρο
                      </button>
                      <button
                        onClick={saveExtraEdit}
                        disabled={savingExtra}
                        className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
                      >
                        <CheckIcon className="h-3 w-3 mr-1" />
                        {savingExtra ? 'Αποθήκευση...' : 'Αποθήκευση'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                        <button
                          onClick={() => {
                            setEditingExtraId(extra.id);
                            setEditExtraForm({ name: extra.name, name_en: extra.name_en, type: extra.type, price: extra.price });
                          }}
                          className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                        >
                          <PencilIcon className="h-3 w-3 mr-1" />
                          Επεξεργασία
                        </button>
                        <button className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25">
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingManagement;
