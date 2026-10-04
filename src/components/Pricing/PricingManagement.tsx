import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { pricingService, vehicleService } from '../../lib/database';
import type { Season, Pricing } from '../../types';
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
        <ArrowPathIcon className="h-6 w-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-gray-500">Φόρτωση...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Δοκιμάστε ξανά
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{t('pricing')}</h1>
        <button
          onClick={loadData}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Ανανέωση
        </button>
      </div>

      {/* Seasons */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Σεζόν</h2>
            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Σεζόν
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {seasons.map((season) => (
              <div key={season.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{season.name}</h3>
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    #{season.priority ?? 0}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-600 mb-3">
                  <CalendarDaysIcon className="h-4 w-4 mr-1" />
                  {formatSeasonRange(season)}
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 inline-flex items-center justify-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                    <PencilIcon className="h-3 w-3 mr-1" />
                    Επεξεργασία
                  </button>
                  <button className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50">
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Matrix */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Τιμές ανά Κατηγορία & Σεζόν</h2>
          <p className="text-sm text-gray-500 mt-1">
            Κάντε κλικ σε ένα κελί για να εισάγετε ή να τροποποιήσετε την τιμή.
          </p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 text-sm font-medium text-gray-500">Κατηγορία</th>
                  {seasons.map((season) => (
                    <th key={season.id} className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {season.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="py-4 pr-4 text-sm font-medium text-gray-900">{category}</td>
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
                                className="w-20 text-center border border-blue-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="—"
                              />
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
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
                                  <CurrencyEuroIcon className="h-4 w-4 text-green-600 mr-1" />
                                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {rate.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1">/ημέρα</span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-300 group-hover:text-blue-500 group-hover:underline transition-colors">
                                  — Κλικ για προσθήκη
                                </span>
                              )}
                              {status && (
                                <span className={`ml-2 text-xs ${status.ok ? 'text-green-600' : 'text-red-600'}`}>
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
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Ασφάλεια</h2>
            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέα Ασφάλεια
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Βασική Ασφάλεια</h3>
              <p className="text-sm text-gray-600 mb-3">Περιλαμβάνεται στην τιμή</p>
              <div className="text-2xl font-bold text-green-600">€0/ημέρα</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Πλήρης Ασφάλεια</h3>
              <p className="text-sm text-gray-600 mb-3">Χωρίς απαλλαγή</p>
              <div className="text-2xl font-bold text-blue-600">€15/ημέρα</div>
            </div>
          </div>
        </div>
      </div>

      {/* Extras */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Έξτρα</h2>
            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="h-4 w-4 mr-1" />
              Νέο Έξτρα
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extras.map((extra) => (
              <div key={extra.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{extra.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    extra.type === 'daily' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {extra.type === 'daily' ? 'Ημερήσιο' : 'Εφάπαξ'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{extra.name_en}</p>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    €{extra.price}/{extra.type === 'daily' ? 'ημέρα' : 'εφάπαξ'}
                  </div>
                  <div className="flex space-x-2">
                    <button className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Επεξεργασία
                    </button>
                    <button className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50">
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
