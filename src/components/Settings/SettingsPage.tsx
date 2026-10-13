import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { clearCompanyCache, clearTermsCache, clearLogoCache, clearLightLogoCache, loadAppLogo, saveAppLogoPath, clearAppLogo, saveAppLogoLightPath, clearAppLogoLight, DEFAULT_CONTRACT_TERMS } from '../../lib/company';
import type { ContractTerm } from '../../lib/company';
import { useAuth } from '../../contexts/AuthContext';
import PageHero from '../Layout/PageHero';
import {
  CogIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CurrencyEuroIcon,
  DocumentTextIcon,
  BellIcon,
  LockClosedIcon,
  CheckIcon,
  ArrowPathIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_number: string;
  registration_number: string;
  contractHeader: string;
  contractSubheader: string;
}

interface FinancialSettings {
  currency: string;
  vat_rate: number;
  late_return_fee: number;
  cleaning_fee: number;
  fuel_charge_per_liter: number;
}

interface Station {
  id: string;
  name: string;
  name_en: string;
  address: string;
  active: boolean;
}

const SettingsPage: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_number: '',
    registration_number: '',
    contractHeader: '',
    contractSubheader: '',
  });

  const [stations, setStations] = useState<Station[]>([]);

  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>({
    currency: 'EUR',
    vat_rate: 24,
    late_return_fee: 10,
    cleaning_fee: 25,
    fuel_charge_per_liter: 1.5,
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [contractTerms, setContractTerms] = useState<ContractTerm[]>(DEFAULT_CONTRACT_TERMS);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoStoredPath, setLogoStoredPath] = useState<string | null>(null);
  const [lightLogoUrl, setLightLogoUrl] = useState<string | null>(null);
  const [lightLogoStoredPath, setLightLogoStoredPath] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [lightLogoUploading, setLightLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState(false);

  const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
  const MAX_LOGO_SIZE = 2 * 1024 * 1024;

  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['company', 'financial', 'contract_terms', 'app_logo', 'app_logo_light']);

      if (settingsError) throw settingsError;

      if (settingsData) {
        const companyRow = settingsData.find((r) => r.key === 'company');
        if (companyRow?.value) {
          const v = companyRow.value as Record<string, unknown>;
          setCompanySettings({
            name: (v.name as string) || '',
            address: (v.address as string) || '',
            phone: (v.phone as string) || '',
            email: (v.email as string) || '',
            website: (v.website as string) || '',
            tax_number: (v.taxNumber as string) || '',
            registration_number: (v.registrationNumber as string) || '',
            contractHeader: (v.contractHeader as string) || '',
            contractSubheader: (v.contractSubheader as string) || '',
          });
        }

        const financialRow = settingsData.find((r) => r.key === 'financial');
        if (financialRow?.value) {
          const v = financialRow.value as Record<string, unknown>;
          setFinancialSettings({
            currency: (v.currency as string) || 'EUR',
            vat_rate: (v.vat_rate as number) || 24,
            late_return_fee: (v.late_return_fee as number) || 10,
            cleaning_fee: (v.cleaning_fee as number) || 25,
            fuel_charge_per_liter: (v.fuel_charge_per_liter as number) || 1.5,
          });
        }

        const termsRow = settingsData.find((r) => r.key === 'contract_terms');
        if (termsRow?.value && Array.isArray(termsRow.value) && termsRow.value.length > 0) {
          setContractTerms(termsRow.value as ContractTerm[]);
        }

        const logoRow = settingsData.find((r) => r.key === 'app_logo');
        if (logoRow?.value && typeof logoRow.value === 'string') {
          setLogoStoredPath(logoRow.value as string);
          const { data: urlData } = supabase.storage.from('app-branding').getPublicUrl(logoRow.value as string);
          setLogoUrl(urlData?.publicUrl || null);
        } else {
          setLogoStoredPath(null);
          setLogoUrl(null);
        }

        const lightRow = settingsData.find((r) => r.key === 'app_logo_light');
        if (lightRow?.value && typeof lightRow.value === 'string') {
          setLightLogoStoredPath(lightRow.value as string);
          const { data: lightUrlData } = supabase.storage.from('app-branding').getPublicUrl(lightRow.value as string);
          setLightLogoUrl(lightUrlData?.publicUrl || null);
        } else {
          setLightLogoStoredPath(null);
          setLightLogoUrl(null);
        }
      }

      // Load stations
      const { data: stationsData, error: stationsError } = await supabase
        .from('stations')
        .select('id, name, name_en, address, active')
        .order('name');

      if (stationsError) throw stationsError;
      if (stationsData) {
        setStations(stationsData as Station[]);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Αποτυχία φόρτωσης ρυθμίσεων.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const companyPayload = {
        name: companySettings.name,
        address: companySettings.address,
        phone: companySettings.phone,
        email: companySettings.email,
        website: companySettings.website,
        taxNumber: companySettings.tax_number,
        registrationNumber: companySettings.registration_number,
        contractHeader: companySettings.contractHeader,
        contractSubheader: companySettings.contractSubheader,
      };

      const { error: companyError } = await supabase
        .from('settings')
        .upsert({ key: 'company', value: companyPayload, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (companyError) throw companyError;

      // Save financial settings
      const { error: financialError } = await supabase
        .from('settings')
        .upsert({ key: 'financial', value: financialSettings, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (financialError) throw financialError;

      // Save contract terms
      const { error: termsError } = await supabase
        .from('settings')
        .upsert({ key: 'contract_terms', value: contractTerms, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (termsError) throw termsError;

      setSaved(true);
      clearCompanyCache();
      clearTermsCache();
      clearLogoCache();
      clearLightLogoCache();
      window.dispatchEvent(new Event('company-settings-updated'));
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Αποτυχία αποθήκευσης ρυθμίσεων.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Εταιρικά Στοιχεία', icon: BuildingOfficeIcon },
    { id: 'stations', label: 'Σταθμοί', icon: MapPinIcon },
    { id: 'financial', label: 'Οικονομικά', icon: CurrencyEuroIcon },
    { id: 'documents', label: 'Έγγραφα', icon: DocumentTextIcon },
    { id: 'branding', label: 'Branding', icon: PhotoIcon },
    { id: 'notifications', label: 'Ειδοποιήσεις', icon: BellIcon },
    { id: 'security', label: 'Ασφάλεια', icon: LockClosedIcon },
  ];

  const renderCompanySettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Επωνυμία Εταιρείας</label>
          <input
            type="text"
            value={companySettings.name}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">ΑΦΜ</label>
          <input
            type="text"
            value={companySettings.tax_number}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, tax_number: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Διεύθυνση</label>
          <input
            type="text"
            value={companySettings.address}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, address: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Τηλέφωνο</label>
          <input
            type="text"
            value={companySettings.phone}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, phone: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Email</label>
          <input
            type="email"
            value={companySettings.email}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Website</label>
          <input
            type="text"
            value={companySettings.website}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, website: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Αριθμός Μητρώου</label>
          <input
            type="text"
            value={companySettings.registration_number}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, registration_number: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Επικεφαλίδα Συμβολαίου</label>
          <input
            type="text"
            value={companySettings.contractHeader}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, contractHeader: e.target.value }))}
            placeholder="π.χ. DEMO RENT A CAR"
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Υπότιτλος Συμβολαίου</label>
          <input
            type="text"
            value={companySettings.contractSubheader}
            onChange={(e) => setCompanySettings((prev) => ({ ...prev, contractSubheader: e.target.value }))}
            placeholder="π.χ. Chania, Crete"
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
      </div>
    </div>
  );

  const renderStationsSettings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">Σταθμοί Παραλαβής/Παράδοσης</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <ArrowPathIcon className="h-6 w-6 text-blue-100/55 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {stations.map((station) => (
            <div key={station.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-blue-100/65 mb-1">Όνομα (ΕΛ)</label>
                  <input
                    type="text"
                    value={station.name}
                    readOnly
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-100/65 mb-1">Όνομα (EN)</label>
                  <input
                    type="text"
                    value={station.name_en}
                    readOnly
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-100/65 mb-1">Διεύθυνση</label>
                  <input
                    type="text"
                    value={station.address}
                    readOnly
                    className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={station.active}
                      readOnly
                      className="rounded border-[#2b5b85]/80 bg-[#0b2949]/80 text-[#55a8ff] focus:ring-[#2f8cff]/50"
                    />
                    <span className="ml-2 text-sm text-blue-100/85">Ενεργός</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-blue-100/55">
        Οι σταθμοί ενημερώνονται από τη σελίδα Στόλου (απαιτείται επέκταση).
      </p>
    </div>
  );

  const renderFinancialSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Νόμισμα</label>
          <select
            value={financialSettings.currency}
            onChange={(e) => setFinancialSettings((prev) => ({ ...prev, currency: e.target.value }))}
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          >
            <option value="EUR">Euro (EUR)</option>
            <option value="USD">US Dollar (USD)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">ΦΠΑ (%)</label>
          <input
            type="number"
            value={financialSettings.vat_rate}
            onChange={(e) =>
              setFinancialSettings((prev) => ({ ...prev, vat_rate: parseFloat(e.target.value) || 0 }))
            }
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Χρέωση Καθυστέρησης (EUR/ώρα)</label>
          <input
            type="number"
            value={financialSettings.late_return_fee}
            onChange={(e) =>
              setFinancialSettings((prev) => ({
                ...prev,
                late_return_fee: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Χρέωση Καθαρισμού (EUR)</label>
          <input
            type="number"
            value={financialSettings.cleaning_fee}
            onChange={(e) =>
              setFinancialSettings((prev) => ({
                ...prev,
                cleaning_fee: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-100/65 mb-2">Χρέωση Καυσίμου (EUR/λίτρο)</label>
          <input
            type="number"
            step="0.01"
            value={financialSettings.fuel_charge_per_liter}
            onChange={(e) =>
              setFinancialSettings((prev) => ({
                ...prev,
                fuel_charge_per_liter: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          />
        </div>
      </div>
    </div>
  );

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Όλα τα πεδία είναι υποχρεωτικά.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες.');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password: newPassword,
      });
      if (updateError) throw updateError;
      setPasswordError('');
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αλλαγής κωδικού.';
      setPasswordError(msg || 'Αποτυχία αλλαγής κωδικού.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const renderSecuritySettings = () => (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-lg font-medium text-white">Αλλαγή Κωδικού Πρόσβασης</h3>
        <p className="text-sm text-blue-100/55 mt-1">Αλλάξτε τον κωδικό πρόσβασης του λογαριασμού σας.</p>
      </div>

      {passwordError && (
        <div className="rounded-md bg-red-950/45 border border-red-400/30 px-4 py-3 text-sm text-red-100">{passwordError}</div>
      )}

      {passwordSuccess && (
        <div className="rounded-md bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-300 flex items-center">
          <CheckIcon className="h-5 w-5 mr-2" />
          Ο κωδικός πρόσβασης άλλαξε επιτυχώς.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-blue-100/65 mb-2">Τρέχων Κωδικός</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          placeholder="Εισάγετε τρέχοντα κωδικό"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-blue-100/65 mb-2">Νέος Κωδικός</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          placeholder="Εισάγετε νέο κωδικό"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-blue-100/65 mb-2">Επιβεβαίωση Νέου Κωδικού</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
          placeholder="Επιβεβαιώστε τον νέο κωδικό"
        />
      </div>

      <button
        onClick={handlePasswordChange}
        disabled={passwordSaving}
        className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] disabled:opacity-50"
      >
        {passwordSaving ? (
          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <LockClosedIcon className="h-4 w-4 mr-2" />
        )}
        {passwordSaving ? 'Αλλαγή...' : 'Αλλαγή Κωδικού'}
      </button>
    </div>
  );

  const renderDocumentsSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Όροι Συμβολαίου Ενοικίασης</h3>
          <p className="text-sm text-blue-100/55 mt-1">Αγγλικό και Ελληνικό κείμενο για κάθε όρο. Οι όροι εμφανίζονται στο PDF σύμβολαιο με τη σειρά που ορίζετε.</p>
        </div>
        <button
          type="button"
          onClick={() => setContractTerms(prev => [...prev, { en: '', el: '' }])}
          className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Προσθήκη Όρου
        </button>
      </div>

      {contractTerms.length === 0 && (
        <p className="text-sm text-blue-100/55 text-center py-4">Δεν έχουν οριστεί όροι. Κάντε κλικ στο «Προσθήκη Όρου» για να ξεκινήσετε.</p>
      )}

      <div className="space-y-3">
        {contractTerms.map((term, index) => (
          <div key={index} className="rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#55a8ff]">Όρος {index + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setContractTerms(prev => {
                    if (index === 0) return prev;
                    const next = [...prev];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })}
                  className="p-1.5 rounded-lg text-blue-100/65 hover:text-white hover:bg-[#12375d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Μετακίνηση πάνω"
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={index === contractTerms.length - 1}
                  onClick={() => setContractTerms(prev => {
                    if (index === prev.length - 1) return prev;
                    const next = [...prev];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    return next;
                  })}
                  className="p-1.5 rounded-lg text-blue-100/65 hover:text-white hover:bg-[#12375d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Μετακίνηση κάτω"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setContractTerms(prev => prev.filter((_, i) => i !== index))}
                  className="p-1.5 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-950/40 transition-colors"
                  title="Διαγραφή"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-blue-100/55 mb-1">English</label>
                <textarea
                  value={term.en}
                  onChange={(e) => setContractTerms(prev => prev.map((t, i) => i === index ? { ...t, en: e.target.value } : t))}
                  rows={2}
                  className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#071d38]/90 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50 resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-100/55 mb-1">Ελληνικά</label>
                <textarea
                  value={term.el}
                  onChange={(e) => setContractTerms(prev => prev.map((t, i) => i === index ? { ...t, el: e.target.value } : t))}
                  rows={2}
                  className="w-full rounded-lg border border-[#2b5b85]/80 bg-[#071d38]/90 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50 resize-y"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setContractTerms(DEFAULT_CONTRACT_TERMS)}
        className="text-sm text-blue-100/55 hover:text-[#55a8ff] transition-colors"
      >
        Επαναφορά προεπιλεγμένων όρων
      </button>
    </div>
  );

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError('');
    setLogoSuccess(false);

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Μη αποδεκτός τύπος αρχείου. Επιτρέπονται PNG, JPG και SVG.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError('Το αρχείο ξεπερνά το όριο 2MB.');
      e.target.value = '';
      return;
    }

    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('app-branding')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      await saveAppLogoPath(path);
      setLogoStoredPath(path);
      const { data: urlData } = supabase.storage.from('app-branding').getPublicUrl(path);
      setLogoUrl(urlData?.publicUrl || null);

      clearLogoCache();
      clearLightLogoCache();
      window.dispatchEvent(new Event('company-settings-updated'));
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } catch (err) {
      console.error('Logo upload failed:', err);
      setLogoError('Αποτυχία μεταφόρτωσης λογοτύπου.');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!logoStoredPath) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      await clearAppLogo(logoStoredPath);
      setLogoStoredPath(null);
      setLogoUrl(null);
      clearLogoCache();
      clearLightLogoCache();
      window.dispatchEvent(new Event('company-settings-updated'));
    } catch (err) {
      console.error('Logo removal failed:', err);
      setLogoError('Αποτυχία διαγραφής λογοτύπου.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLightLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError('');
    setLogoSuccess(false);

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Μη αποδεκτός τύπος αρχείου. Επιτρέπονται PNG, JPG και SVG.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError('Το αρχείο ξεπερνά το όριο 2MB.');
      e.target.value = '';
      return;
    }

    setLightLogoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `logo-light-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('app-branding')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      await saveAppLogoLightPath(path);
      setLightLogoStoredPath(path);
      const { data: urlData } = supabase.storage.from('app-branding').getPublicUrl(path);
      setLightLogoUrl(urlData?.publicUrl || null);

      clearLightLogoCache();
      window.dispatchEvent(new Event('company-settings-updated'));
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } catch (err) {
      console.error('Light logo upload failed:', err);
      setLogoError('Αποτυχία μεταφόρτωσης λογοτύπου.');
    } finally {
      setLightLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleLightLogoRemove = async () => {
    if (!lightLogoStoredPath) return;
    setLightLogoUploading(true);
    setLogoError('');
    try {
      await clearAppLogoLight(lightLogoStoredPath);
      setLightLogoStoredPath(null);
      setLightLogoUrl(null);
      clearLightLogoCache();
      window.dispatchEvent(new Event('company-settings-updated'));
    } catch (err) {
      console.error('Light logo removal failed:', err);
      setLogoError('Αποτυχία διαγραφής λογοτύπου.');
    } finally {
      setLightLogoUploading(false);
    }
  };

  const renderBrandingSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium text-white">Λογότυπο Εφαρμογής</h3>
        <p className="text-sm text-blue-100/55 mt-1">
          Μεταφορτώστε το λογότυπο της εταιρείας σας. Υποστηρίζονται PNG, JPG και SVG. Μέγιστο μέγεθος 2MB.
        </p>
      </div>

      {logoError && (
        <div className="rounded-md bg-red-950/45 border border-red-400/30 px-4 py-3 text-sm text-red-100">{logoError}</div>
      )}

      {logoSuccess && (
        <div className="rounded-md bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-300 flex items-center">
          <CheckIcon className="h-5 w-5 mr-2" />
          Το λογότυπο ενημερώθηκε επιτυχώς.
        </div>
      )}

      {!isAdmin && (
        <div className="rounded-md bg-amber-500/15 border border-amber-400/30 px-4 py-3 text-sm text-amber-300">
          Μόνο οι διαχειριστές μπορούν να διαχειριστούν το λογότυπο.
        </div>
      )}

      {/* Standard logo */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#0b2949]/60 p-6">
        <h4 className="text-sm font-semibold text-blue-100/85 mb-3">Βασικό Λογότυπο</h4>
        <p className="text-xs text-blue-100/50 mb-4">Χρησιμοποιείται σε φωτεινά φόντα (π.χ. έγγραφα, αναφορές).</p>
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-[#1e4e7d]/60 bg-white p-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Standard logo"
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoUrl(null)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <PhotoIcon className="h-8 w-8" />
                <span className="text-xs">Χωρίς λογότυπο</span>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label
                className={`inline-flex cursor-pointer items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {logoUploading ? (
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PhotoIcon className="h-4 w-4 mr-2" />
                )}
                {logoUrl ? 'Αντικατάσταση' : 'Μεταφόρτωση'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  className="hidden"
                />
              </label>

              {logoUrl && (
                <button
                  onClick={handleLogoRemove}
                  disabled={logoUploading}
                  className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Αφαίρεση
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Light logo variant for dark backgrounds */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#0b2949]/60 p-6">
        <h4 className="text-sm font-semibold text-blue-100/85 mb-3">Φωτεινό Λογότυπο (για σκοτεινά φόντα)</h4>
        <p className="text-xs text-blue-100/50 mb-4">
          Χρησιμοποιείται στο header, sidebar και οθόνη σύνδεσης. Αν δεν οριστεί, χρησιμοποιείται το βασικό λογότυπο.
        </p>
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-[#1e4e7d]/60 bg-[#041a32] p-4">
            {lightLogoUrl ? (
              <img
                src={lightLogoUrl}
                alt="Light logo variant"
                className="max-h-full max-w-full object-contain"
                onError={() => setLightLogoUrl(null)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-blue-100/40">
                <PhotoIcon className="h-8 w-8" />
                <span className="text-xs">Χωρίς φωτεινό variant</span>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label
                className={`inline-flex cursor-pointer items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] ${lightLogoUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {lightLogoUploading ? (
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PhotoIcon className="h-4 w-4 mr-2" />
                )}
                {lightLogoUrl ? 'Αντικατάσταση' : 'Μεταφόρτωση'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLightLogoUpload}
                  disabled={lightLogoUploading}
                  className="hidden"
                />
              </label>

              {lightLogoUrl && (
                <button
                  onClick={handleLightLogoRemove}
                  disabled={lightLogoUploading}
                  className="inline-flex items-center rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Αφαίρεση
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-blue-100/40">
        Όταν δεν έχει οριστεί φωτεινό λογότυπο, η εφαρμογή χρησιμοποιεί το βασικό. Αν δεν υπάρχει ούτε βασικό, εμφανίζεται το προεπιλεγμένο εικονίδιο και το όνομα της εταιρείας.
      </p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'company':
        return renderCompanySettings();
      case 'stations':
        return renderStationsSettings();
      case 'financial':
        return renderFinancialSettings();
      case 'documents':
        return renderDocumentsSettings();
      case 'branding':
        return renderBrandingSettings();
      case 'notifications':
        return (
          <div className="text-center py-12">
            <BellIcon className="h-12 w-12 text-blue-100/45 mx-auto mb-4" />
            <p className="text-blue-100/55">Ρυθμίσεις ειδοποιήσεων θα υλοποιηθούν σύντομα</p>
          </div>
        );
      case 'security':
        return renderSecuritySettings();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="h-8 w-8 text-blue-100/55 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('settings')}
        subtitle="Ρυθμίσεις εταιρείας και εφαρμογής"
      />

      {error && (
        <div className="p-4 bg-red-950/45 border border-red-400/30 rounded-lg text-sm text-red-100">{error}</div>
      )}

      {saved && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-400/30 rounded-lg text-sm text-emerald-300 flex items-center">
          <CheckIcon className="h-5 w-5 mr-2" />
          Οι ρυθμίσεις αποθηκεύτηκαν επιτυχώς.
        </div>
      )}

      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
        {/* Tabs */}
        <div className="border-b border-[#1e4e7d]/70">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-[#2f8cff] text-[#55a8ff]'
                      : 'border-transparent text-blue-100/55 hover:text-white hover:border-[#55a8ff]'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">{renderContent()}</div>

        {/* Save Button — hidden on security tab (has its own submit) */}
        {activeTab !== 'security' && activeTab !== 'branding' && (
          <div className="px-4 sm:px-6 py-4 border-t border-[#1e4e7d]/70 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff] disabled:opacity-50"
            >
              {saving ? (
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CogIcon className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση Ρυθμίσεων'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
