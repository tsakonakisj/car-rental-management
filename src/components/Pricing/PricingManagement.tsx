import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { pricingService, vehicleService, insuranceService } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
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
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface SeasonFormData {
  name: string;
  priority: number;
  periods: Array<{ start_date: string; end_date: string }>;
}

const dateFromMonthDay = (month: number | null | undefined, day: number | null | undefined): string => {
  if (!month || !day) return '';
  return `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseDateParts = (dateStr: string): { month: number; day: number } | null => {
  const parts = dateStr.split('T')[0].split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!month || !day) return null;
  return { month, day };
};

const PricingManagement: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [pricingRights, setPricingRights] = useState({ create: false, edit: false, delete: false });
  const canCreate = user?.role === 'admin' || (user?.role === 'manager' && pricingRights.create);
  const canEdit = user?.role === 'admin' || (user?.role === 'manager' && pricingRights.edit);
  const canDelete = user?.role === 'admin' || (user?.role === 'manager' && pricingRights.delete);

  useEffect(() => {
    if (user?.role !== 'manager') {
      setPricingRights({ create: false, edit: false, delete: false });
      return;
    }
    let active = true;
    setPricingRights({ create: false, edit: false, delete: false });
    supabase.from('employee_permissions').select('permissions').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        const p = data?.permissions as { pricing?: { create?: boolean; edit?: boolean; delete?: boolean } } | undefined;
        setPricingRights({
          create: p?.pricing?.create === true,
          edit: p?.pricing?.edit === true,
          delete: p?.pricing?.delete === true,
        });
      });
    return () => { active = false; };
  }, [user?.id, user?.role]);

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
  const [editSeasonForm, setEditSeasonForm] = useState<SeasonFormData | null>(null);
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
        (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
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
    if (getRate(category, seasonId) === null ? !canCreate : !canEdit) return;
    const current = getRate(category, seasonId);
    setEditCell({ category, seasonId });
    setEditValue(current !== null ? String(current) : '');
  };

  const cancelEdit = () => {
    setEditCell(null);
    setEditValue('');
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveEdit = async () => {
    if (!editCell || (getRate(editCell.category, editCell.seasonId) === null ? !canCreate : !canEdit)) return;
    const rate = parseFloat(editValue);
    if (isNaN(rate) || rate < 0) {
      setSaveError('Μη έγκυρη τιμή.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await pricingService.upsertRate(editCell.category, editCell.seasonId, rate);
      await loadData();
      setSaveStatus({ category: editCell.category, seasonId: editCell.seasonId, ok: true });
      setEditCell(null);
      setEditValue('');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus({ category: editCell.category, seasonId: editCell.seasonId, ok: false });
      setSaveError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης τιμής.');
      setTimeout(() => { setSaveStatus(null); setSaveError(null); }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const saveExtraEdit = async () => {
    if (!canEdit) return;
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

  const [seasonEditError, setSeasonEditError] = useState<string | null>(null);

  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [deletingSeason, setDeletingSeason] = useState(false);
  const [seasonDeleteError, setSeasonDeleteError] = useState<string | null>(null);

  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState<SeasonFormData | null>(null);
  const [newSeasonError, setNewSeasonError] = useState<string | null>(null);
  const [savingNewSeason, setSavingNewSeason] = useState(false);

  const [insuranceToDelete, setInsuranceToDelete] = useState<InsuranceType | null>(null);
  const [deletingInsurance, setDeletingInsurance] = useState(false);
  const [insuranceDeleteError, setInsuranceDeleteError] = useState<string | null>(null);

  const [extraToDelete, setExtraToDelete] = useState<ExtraType | null>(null);
  const [deletingExtra, setDeletingExtra] = useState(false);
  const [extraDeleteError, setExtraDeleteError] = useState<string | null>(null);

  const [showNewInsuranceForm, setShowNewInsuranceForm] = useState(false);
  const [newInsuranceForm, setNewInsuranceForm] = useState<{ name: string; name_en: string; daily_rate: number } | null>(null);
  const [newInsuranceError, setNewInsuranceError] = useState<string | null>(null);
  const [savingNewInsurance, setSavingNewInsurance] = useState(false);

  const [showNewExtraForm, setShowNewExtraForm] = useState(false);
  const [newExtraForm, setNewExtraForm] = useState<{ name: string; name_en: string; type: 'daily' | 'one-time'; price: number } | null>(null);
  const [newExtraError, setNewExtraError] = useState<string | null>(null);
  const [savingNewExtra, setSavingNewExtra] = useState(false);

  const handleDeleteSeason = async () => {
    if (!canDelete) return;
    if (!seasonToDelete) return;
    setDeletingSeason(true);
    setSeasonDeleteError(null);
    try {
      await pricingService.deactivateSeason(seasonToDelete.id);
      setSeasonToDelete(null);
      await loadData();
    } catch (err) {
      setSeasonDeleteError(err instanceof Error ? err.message : 'Αποτυχία διαγραφής σεζόν.');
    } finally {
      setDeletingSeason(false);
    }
  };

  const handleDeleteInsurance = async () => {
    if (!canDelete) return;
    if (!insuranceToDelete) return;
    setDeletingInsurance(true);
    setInsuranceDeleteError(null);
    try {
      await insuranceService.deactivateInsurance(insuranceToDelete.id);
      setInsuranceToDelete(null);
      await loadData();
    } catch (err) {
      setInsuranceDeleteError(err instanceof Error ? err.message : 'Αποτυχία διαγραφής ασφάλειας.');
    } finally {
      setDeletingInsurance(false);
    }
  };

  const handleDeleteExtra = async () => {
    if (!canDelete) return;
    if (!extraToDelete) return;
    setDeletingExtra(true);
    setExtraDeleteError(null);
    try {
      await pricingService.deactivateExtra(extraToDelete.id);
      setExtraToDelete(null);
      await loadData();
    } catch (err) {
      setExtraDeleteError(err instanceof Error ? err.message : 'Αποτυχία διαγραφής έξτρα.');
    } finally {
      setDeletingExtra(false);
    }
  };

  const saveNewInsurance = async () => {
    if (!canCreate) return;
    if (!newInsuranceForm) return;
    if (!newInsuranceForm.name?.trim()) {
      setNewInsuranceError('Το όνομα είναι υποχρεωτικό.');
      return;
    }
    if (!newInsuranceForm.name_en?.trim()) {
      setNewInsuranceError('Το όνομα (EN) είναι υποχρεωτικό.');
      return;
    }
    setSavingNewInsurance(true);
    setNewInsuranceError(null);
    try {
      await insuranceService.createInsurance({
        name: newInsuranceForm.name,
        name_en: newInsuranceForm.name_en,
        daily_rate: newInsuranceForm.daily_rate,
      });
      setShowNewInsuranceForm(false);
      setNewInsuranceForm(null);
      await loadData();
    } catch (err) {
      setNewInsuranceError(err instanceof Error ? err.message : 'Αποτυχία δημιουργίας ασφάλειας.');
    } finally {
      setSavingNewInsurance(false);
    }
  };

  const saveNewExtra = async () => {
    if (!canCreate) return;
    if (!newExtraForm) return;
    if (!newExtraForm.name?.trim()) {
      setNewExtraError('Το όνομα είναι υποχρεωτικό.');
      return;
    }
    if (!newExtraForm.name_en?.trim()) {
      setNewExtraError('Το όνομα (EN) είναι υποχρεωτικό.');
      return;
    }
    setSavingNewExtra(true);
    setNewExtraError(null);
    try {
      await pricingService.createExtra({
        name: newExtraForm.name,
        name_en: newExtraForm.name_en,
        type: newExtraForm.type,
        price: newExtraForm.price,
      });
      setShowNewExtraForm(false);
      setNewExtraForm(null);
      await loadData();
    } catch (err) {
      setNewExtraError(err instanceof Error ? err.message : 'Αποτυχία δημιουργίας έξτρα.');
    } finally {
      setSavingNewExtra(false);
    }
  };

  const startSeasonEdit = (season: Season) => {
    if (!canEdit) return;
    setEditingSeasonId(season.id);
    setSeasonEditError(null);
    const periods: Array<{ start_date: string; end_date: string }> = [
      { start_date: season.start_date?.split('T')[0] || '', end_date: season.end_date?.split('T')[0] || '' },
    ];
    if (season.start_month_2 != null && season.end_month_2 != null) {
      periods.push({
        start_date: dateFromMonthDay(season.start_month_2, season.start_day_2),
        end_date: dateFromMonthDay(season.end_month_2, season.end_day_2),
      });
    }
    if (season.start_month_3 != null && season.end_month_3 != null) {
      periods.push({
        start_date: dateFromMonthDay(season.start_month_3, season.start_day_3),
        end_date: dateFromMonthDay(season.end_month_3, season.end_day_3),
      });
    }
    setEditSeasonForm({
      name: season.name,
      priority: season.priority ?? 0,
      periods,
    });
  };

  const cancelSeasonEdit = () => {
    setEditingSeasonId(null);
    setEditSeasonForm(null);
  };

  const saveNewSeason = async () => {
    if (!canCreate) return;
    if (!newSeasonForm) return;
    if (!newSeasonForm.name?.trim()) {
      setNewSeasonError('Το όνομα είναι υποχρεωτικό.');
      return;
    }
    const firstPeriod = newSeasonForm.periods[0];
    if (!firstPeriod || !firstPeriod.start_date || !firstPeriod.end_date) {
      setNewSeasonError('Η πρώτη περίοδος είναι υποχρεωτική.');
      return;
    }
    setSavingNewSeason(true);
    setNewSeasonError(null);
    try {
      const p1Start = parseDateParts(firstPeriod.start_date);
      const p1End = parseDateParts(firstPeriod.end_date);
      if (!p1Start || !p1End) {
        setNewSeasonError('Μη έγκυρες ημερομηνίες.');
        setSavingNewSeason(false);
        return;
      }
      const createData: Parameters<typeof pricingService.createSeason>[0] = {
        name: newSeasonForm.name,
        start_date: firstPeriod.start_date.split('T')[0],
        end_date: firstPeriod.end_date.split('T')[0],
        priority: newSeasonForm.priority,
        start_month: p1Start.month,
        start_day: p1Start.day,
        end_month: p1End.month,
        end_day: p1End.day,
      };
      if (newSeasonForm.periods[1]?.start_date && newSeasonForm.periods[1]?.end_date) {
        const p2Start = parseDateParts(newSeasonForm.periods[1].start_date);
        const p2End = parseDateParts(newSeasonForm.periods[1].end_date);
        if (p2Start && p2End) {
          createData.start_month_2 = p2Start.month;
          createData.start_day_2 = p2Start.day;
          createData.end_month_2 = p2End.month;
          createData.end_day_2 = p2End.day;
        }
      }
      if (newSeasonForm.periods[2]?.start_date && newSeasonForm.periods[2]?.end_date) {
        const p3Start = parseDateParts(newSeasonForm.periods[2].start_date);
        const p3End = parseDateParts(newSeasonForm.periods[2].end_date);
        if (p3Start && p3End) {
          createData.start_month_3 = p3Start.month;
          createData.start_day_3 = p3Start.day;
          createData.end_month_3 = p3End.month;
          createData.end_day_3 = p3End.day;
        }
      }
      await pricingService.createSeason(createData);
      setShowNewSeasonForm(false);
      setNewSeasonForm(null);
      await loadData();
    } catch (err) {
      setNewSeasonError(err instanceof Error ? err.message : 'Αποτυχία δημιουργίας σεζόν.');
    } finally {
      setSavingNewSeason(false);
    }
  };

  const saveSeasonEdit = async () => {
    if (!canEdit) return;
    if (!editingSeasonId || !editSeasonForm) return;
    if (!editSeasonForm.name?.trim()) {
      setSeasonEditError('Το όνομα είναι υποχρεωτικό.');
      return;
    }
    const firstPeriod = editSeasonForm.periods[0];
    if (!firstPeriod || !firstPeriod.start_date || !firstPeriod.end_date) {
      setSeasonEditError('Η πρώτη περίοδος είναι υποχρεωτική.');
      return;
    }
    setSavingSeason(true);
    setSeasonEditError(null);
    try {
      const updates: Partial<Season> = {
        name: editSeasonForm.name,
        priority: editSeasonForm.priority,
      };

      const p1Start = parseDateParts(firstPeriod.start_date);
      const p1End = parseDateParts(firstPeriod.end_date);
      if (!p1Start || !p1End) {
        setSeasonEditError('Μη έγκυρες ημερομηνίες περιόδου 1.');
        setSavingSeason(false);
        return;
      }
      updates.start_date = firstPeriod.start_date.split('T')[0];
      updates.end_date = firstPeriod.end_date.split('T')[0];
      updates.start_month = p1Start.month;
      updates.start_day = p1Start.day;
      updates.end_month = p1End.month;
      updates.end_day = p1End.day;

      if (editSeasonForm.periods[1]?.start_date && editSeasonForm.periods[1]?.end_date) {
        const p2Start = parseDateParts(editSeasonForm.periods[1].start_date);
        const p2End = parseDateParts(editSeasonForm.periods[1].end_date);
        if (p2Start && p2End) {
          updates.start_month_2 = p2Start.month;
          updates.start_day_2 = p2Start.day;
          updates.end_month_2 = p2End.month;
          updates.end_day_2 = p2End.day;
        }
      } else {
        updates.start_month_2 = null;
        updates.start_day_2 = null;
        updates.end_month_2 = null;
        updates.end_day_2 = null;
      }

      if (editSeasonForm.periods[2]?.start_date && editSeasonForm.periods[2]?.end_date) {
        const p3Start = parseDateParts(editSeasonForm.periods[2].start_date);
        const p3End = parseDateParts(editSeasonForm.periods[2].end_date);
        if (p3Start && p3End) {
          updates.start_month_3 = p3Start.month;
          updates.start_day_3 = p3Start.day;
          updates.end_month_3 = p3End.month;
          updates.end_day_3 = p3End.day;
        }
      } else {
        updates.start_month_3 = null;
        updates.start_day_3 = null;
        updates.end_month_3 = null;
        updates.end_day_3 = null;
      }

      await pricingService.updateSeason(editingSeasonId, updates);
      await loadData();
      setEditingSeasonId(null);
      setEditSeasonForm(null);
    } catch (err) {
      setSeasonEditError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης σεζόν.');
    } finally {
      setSavingSeason(false);
    }
  };

  const startInsuranceEdit = (insurance: InsuranceType) => {
    if (!canEdit) return;
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
    if (!canEdit) return;
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
    const parts: string[] = [];
    if (s.start_month && s.end_month) {
      parts.push(`${s.start_day ?? 1}/${s.start_month} - ${s.end_day ?? 31}/${s.end_month}`);
    }
    if (s.start_month_2 && s.end_month_2) {
      parts.push(`${s.start_day_2 ?? 1}/${s.start_month_2} - ${s.end_day_2 ?? 31}/${s.end_month_2}`);
    }
    if (s.start_month_3 && s.end_month_3) {
      parts.push(`${s.start_day_3 ?? 1}/${s.start_month_3} - ${s.end_day_3 ?? 31}/${s.end_month_3}`);
    }
    if (parts.length > 0) return parts.join(', ');
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
            {canCreate && <button
              onClick={() => {
                setShowNewSeasonForm(true);
                setNewSeasonForm({ name: '', priority: 0, periods: [{ start_date: '', end_date: '' }] });
                setNewSeasonError(null);
              }}
              className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Σεζόν
            </button>}
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
                        <label className="block text-xs text-blue-100/55 mb-1">Προτεραιότητα</label>
                        <input
                          type="number"
                          value={editSeasonForm.priority ?? 0}
                          onChange={e => setEditSeasonForm({ ...editSeasonForm, priority: parseInt(e.target.value, 10) || 0 })}
                          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                        />
                      </div>
                    </div>
                    {editSeasonForm.periods.map((period, pIdx) => (
                      <div key={pIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-xs text-blue-100/55 mb-1">Περίοδος {pIdx + 1} — Έναρξη</label>
                          <input
                            type="date"
                            value={period.start_date ? period.start_date.split('T')[0] : ''}
                            onChange={e => {
                              const periods = [...editSeasonForm.periods];
                              periods[pIdx] = { ...periods[pIdx], start_date: e.target.value };
                              setEditSeasonForm({ ...editSeasonForm, periods });
                            }}
                            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                          />
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="block text-xs text-blue-100/55 mb-1">Περίοδος {pIdx + 1} — Λήξη</label>
                            <input
                              type="date"
                              value={period.end_date ? period.end_date.split('T')[0] : ''}
                              onChange={e => {
                                const periods = [...editSeasonForm.periods];
                                periods[pIdx] = { ...periods[pIdx], end_date: e.target.value };
                                setEditSeasonForm({ ...editSeasonForm, periods });
                              }}
                              className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                            />
                          </div>
                          {pIdx > 0 && (
                            <button
                              onClick={() => setEditSeasonForm({ ...editSeasonForm, periods: editSeasonForm.periods.filter((_, i) => i !== pIdx) })}
                              className="flex-shrink-0 inline-flex items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-2 text-red-300 transition-colors hover:bg-red-500/25"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {editSeasonForm.periods.length < 3 && (
                      <button
                        onClick={() => setEditSeasonForm({ ...editSeasonForm, periods: [...editSeasonForm.periods, { start_date: '', end_date: '' }] })}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                      >
                        <PlusIcon className="h-3 w-3 mr-1" />
                        Προσθήκη Περιόδου
                      </button>
                    )}
                    {seasonEditError && (
                      <p className="text-xs text-red-400">{seasonEditError}</p>
                    )}
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
                    {canEdit && <button
                      onClick={() => startSeasonEdit(season)}
                      className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                    >
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Επεξεργασία
                    </button>}
                    {canDelete && <button
                      onClick={() => {
                        setSeasonDeleteError(null);
                        setSeasonToDelete(season);
                      }}
                      className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>}
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
          {saveError && (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {saveError}
            </div>
          )}
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
                              disabled={rate === null ? !canCreate : !canEdit}
                              onClick={() => startEdit(category, season.id)}
                              className="inline-flex items-center group disabled:cursor-default"
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
            {canCreate && <button
              onClick={() => {
                setShowNewInsuranceForm(true);
                setNewInsuranceForm({ name: '', name_en: '', daily_rate: 0 });
                setNewInsuranceError(null);
              }}
              className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Ασφάλεια
            </button>}
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
                      {canEdit && <button
                        onClick={() => startInsuranceEdit(insurance)}
                        className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                      >
                        <PencilIcon className="h-3 w-3 mr-1" />
                        Επεξεργασία
                      </button>}
                      {canDelete && <button
                        onClick={() => {
                          setInsuranceDeleteError(null);
                          setInsuranceToDelete(insurance);
                        }}
                        className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>}
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
            {canCreate && <button
              onClick={() => {
                setShowNewExtraForm(true);
                setNewExtraForm({ name: '', name_en: '', type: 'daily', price: 0 });
                setNewExtraError(null);
              }}
              className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέο Έξτρα
            </button>}
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
                        {canEdit && <button
                          onClick={() => {
                            setEditingExtraId(extra.id);
                            setEditExtraForm({ name: extra.name, name_en: extra.name_en, type: extra.type, price: extra.price });
                          }}
                          className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-2 py-1 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                        >
                          <PencilIcon className="h-3 w-3 mr-1" />
                          Επεξεργασία
                        </button>}
                        {canDelete && <button
                          onClick={() => {
                            setExtraDeleteError(null);
                            setExtraToDelete(extra);
                          }}
                          className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>}
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

      {canCreate && showNewSeasonForm && newSeasonForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-white mb-4">Νέα Σεζόν</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                  <input
                    type="text"
                    value={newSeasonForm.name || ''}
                    onChange={e => setNewSeasonForm({ ...newSeasonForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-100/55 mb-1">Προτεραιότητα</label>
                  <input
                    type="number"
                    value={newSeasonForm.priority ?? 0}
                    onChange={e => setNewSeasonForm({ ...newSeasonForm, priority: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
              </div>
              {newSeasonForm.periods.map((period, pIdx) => (
                <div key={pIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-xs text-blue-100/55 mb-1">Περίοδος {pIdx + 1} — Έναρξη</label>
                    <input
                      type="date"
                      value={period.start_date ? period.start_date.split('T')[0] : ''}
                      onChange={e => {
                        const periods = [...newSeasonForm.periods];
                        periods[pIdx] = { ...periods[pIdx], start_date: e.target.value };
                        setNewSeasonForm({ ...newSeasonForm, periods });
                      }}
                      className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-blue-100/55 mb-1">Περίοδος {pIdx + 1} — Λήξη</label>
                      <input
                        type="date"
                        value={period.end_date ? period.end_date.split('T')[0] : ''}
                        onChange={e => {
                          const periods = [...newSeasonForm.periods];
                          periods[pIdx] = { ...periods[pIdx], end_date: e.target.value };
                          setNewSeasonForm({ ...newSeasonForm, periods });
                        }}
                        className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                      />
                    </div>
                    {pIdx > 0 && (
                      <button
                        onClick={() => setNewSeasonForm({ ...newSeasonForm, periods: newSeasonForm.periods.filter((_, i) => i !== pIdx) })}
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15 px-2 py-2 text-red-300 transition-colors hover:bg-red-500/25"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {newSeasonForm.periods.length < 3 && (
                <button
                  onClick={() => setNewSeasonForm({ ...newSeasonForm, periods: [...newSeasonForm.periods, { start_date: '', end_date: '' }] })}
                  className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-1.5 text-xs font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white"
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Προσθήκη Περιόδου
                </button>
              )}
              {newSeasonError && (
                <p className="text-xs text-red-400">{newSeasonError}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowNewSeasonForm(false);
                  setNewSeasonForm(null);
                  setNewSeasonError(null);
                }}
                disabled={savingNewSeason}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={saveNewSeason}
                disabled={savingNewSeason}
                className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
              >
                {savingNewSeason ? 'Αποθήκευση...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canCreate && showNewInsuranceForm && newInsuranceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6">
            <h3 className="text-base font-semibold text-white mb-4">Νέα Ασφάλεια</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                <input
                  type="text"
                  value={newInsuranceForm.name || ''}
                  onChange={e => setNewInsuranceForm({ ...newInsuranceForm, name: e.target.value })}
                  className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-100/55 mb-1">Όνομα (EN)</label>
                <input
                  type="text"
                  value={newInsuranceForm.name_en || ''}
                  onChange={e => setNewInsuranceForm({ ...newInsuranceForm, name_en: e.target.value })}
                  className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-100/55 mb-1">Ημερήσιο Τέλος (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newInsuranceForm.daily_rate ?? 0}
                  onChange={e => setNewInsuranceForm({ ...newInsuranceForm, daily_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                />
              </div>
              {newInsuranceError && (
                <p className="text-xs text-red-400">{newInsuranceError}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowNewInsuranceForm(false);
                  setNewInsuranceForm(null);
                  setNewInsuranceError(null);
                }}
                disabled={savingNewInsurance}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={saveNewInsurance}
                disabled={savingNewInsurance}
                className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
              >
                {savingNewInsurance ? 'Αποθήκευση...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canCreate && showNewExtraForm && newExtraForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6">
            <h3 className="text-base font-semibold text-white mb-4">Νέο Έξτρα</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-blue-100/55 mb-1">Όνομα</label>
                <input
                  type="text"
                  value={newExtraForm.name || ''}
                  onChange={e => setNewExtraForm({ ...newExtraForm, name: e.target.value })}
                  className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-100/55 mb-1">Όνομα (EN)</label>
                <input
                  type="text"
                  value={newExtraForm.name_en || ''}
                  onChange={e => setNewExtraForm({ ...newExtraForm, name_en: e.target.value })}
                  className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-100/55 mb-1">Τύπος</label>
                  <select
                    value={newExtraForm.type || 'daily'}
                    onChange={e => setNewExtraForm({ ...newExtraForm, type: e.target.value as ExtraType['type'] })}
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
                    value={newExtraForm.price ?? 0}
                    onChange={e => setNewExtraForm({ ...newExtraForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
              </div>
              {newExtraError && (
                <p className="text-xs text-red-400">{newExtraError}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowNewExtraForm(false);
                  setNewExtraForm(null);
                  setNewExtraError(null);
                }}
                disabled={savingNewExtra}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={saveNewExtra}
                disabled={savingNewExtra}
                className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2478ff] disabled:opacity-50"
              >
                {savingNewExtra ? 'Αποθήκευση...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDelete && seasonToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 rounded-xl bg-red-500/15 p-2 ring-1 ring-inset ring-red-400/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Διαγραφή Σεζόν</h3>
                <p className="text-sm text-blue-100/65 mt-1">
                  Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε τη σεζόν <span className="font-medium text-white">«{seasonToDelete.name}»</span>;
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-100/45 mb-4">
              Η σεζόν θα απενεργοποιηθεί και θα αφαιρεθεί από τη λίστα. Οι υπάρχουσες κρατήσεις και τιμές διατηρούνται.
            </p>
            {seasonDeleteError && (
              <p className="text-xs text-red-400 mb-4">{seasonDeleteError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setSeasonToDelete(null);
                  setSeasonDeleteError(null);
                }}
                disabled={deletingSeason}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={handleDeleteSeason}
                disabled={deletingSeason}
                className="inline-flex items-center rounded-xl border border-transparent bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deletingSeason ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDelete && insuranceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 rounded-xl bg-red-500/15 p-2 ring-1 ring-inset ring-red-400/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Διαγραφή Ασφάλειας</h3>
                <p className="text-sm text-blue-100/65 mt-1">
                  Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε την ασφάλεια <span className="font-medium text-white">«{insuranceToDelete.name}»</span>;
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-100/45 mb-4">
              Η ασφάλεια θα απενεργοποιηθεί και δεν θα είναι διαθέσιμη για νέες κρατήσεις. Οι υπάρχουσες κρατήσεις διατηρούνται.
            </p>
            {insuranceDeleteError && (
              <p className="text-xs text-red-400 mb-4">{insuranceDeleteError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setInsuranceToDelete(null);
                  setInsuranceDeleteError(null);
                }}
                disabled={deletingInsurance}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={handleDeleteInsurance}
                disabled={deletingInsurance}
                className="inline-flex items-center rounded-xl border border-transparent bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deletingInsurance ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDelete && extraToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.98),rgba(5,24,48,0.99))] shadow-[0_18px_45px_rgba(0,0,0,0.4)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 rounded-xl bg-red-500/15 p-2 ring-1 ring-inset ring-red-400/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Διαγραφή Έξτρα</h3>
                <p className="text-sm text-blue-100/65 mt-1">
                  Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε το έξτρα <span className="font-medium text-white">«{extraToDelete.name}»</span>;
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-100/45 mb-4">
              Το έξτρα θα απενεργοποιηθεί και δεν θα είναι διαθέσιμο για νέες κρατήσεις. Οι υπάρχουσες κρατήσεις διατηρούνται.
            </p>
            {extraDeleteError && (
              <p className="text-xs text-red-400 mb-4">{extraDeleteError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setExtraToDelete(null);
                  setExtraDeleteError(null);
                }}
                disabled={deletingExtra}
                className="inline-flex items-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-4 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:bg-[#12375d]"
              >
                Άκυρο
              </button>
              <button
                onClick={handleDeleteExtra}
                disabled={deletingExtra}
                className="inline-flex items-center rounded-xl border border-transparent bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deletingExtra ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingManagement;
