import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PageHero from '../Layout/PageHero';
import { ArrowPathIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
type PermissionResource = 'bookings' | 'customers' | 'fleet' | 'pricing' | 'payments' | 'reports';
type PermissionSet = Record<PermissionResource, Record<PermissionAction, boolean>>;
interface ManagedUser {
  id: string; email: string; username?: string | null; name: string; role: 'admin' | 'manager';
  active: boolean | null; created_at: string | null;
}

const categories: { key: PermissionResource; title: string }[] = [
  { key: 'bookings', title: 'Κρατήσεις' },
  { key: 'customers', title: 'Πελάτες' },
  { key: 'fleet', title: 'Στόλος' },
  { key: 'pricing', title: 'Τιμές και σεζόν' },
  { key: 'payments', title: 'Πληρωμές και οικονομικά' },
  { key: 'reports', title: 'Αναφορές' },
];
const actions: { key: PermissionAction; title: string }[] = [
  { key: 'view', title: 'Προβολή' },
  { key: 'create', title: 'Προσθήκη' },
  { key: 'edit', title: 'Επεξεργασία' },
  { key: 'delete', title: 'Διαγραφή' },
];
const emptyPermissions = (): PermissionSet => ({
  bookings: { view: false, create: false, edit: false, delete: false },
  customers: { view: false, create: false, edit: false, delete: false },
  fleet: { view: false, create: false, edit: false, delete: false },
  pricing: { view: false, create: false, edit: false, delete: false },
  payments: { view: false, create: false, edit: false, delete: false },
  reports: { view: false, create: false, edit: false, delete: false },
});
const normalize = (raw: unknown): PermissionSet => {
  const defaults = emptyPermissions();
  if (!raw || typeof raw !== 'object') return defaults;
  const source = raw as Record<string, Record<string, unknown>>;
  for (const { key } of categories) {
    for (const { key: action } of actions) {
      defaults[key][action] = source[key]?.[action] === true;
    }
  }
  // Deleting bookings is currently reserved for Admin by a separate DB policy.
  defaults.bookings.delete = false;
  // Permanent vehicle deletion is reserved exclusively for Admin.
  defaults.fleet.delete = false;
  // Pricing configuration changes are always restricted to Admin.
  defaults.pricing.create = false;
  defaults.pricing.edit = false;
  defaults.pricing.delete = false;
  return defaults;
};

const UserManagement: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ManagedUser[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionSet>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PermissionSet>(emptyPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [employeeDialog, setEmployeeDialog] = useState<'create' | 'reset' | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeUsername, setEmployeeUsername] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { data: users, error: userError } = await supabase
        .from('users').select('id,email,username,name,role,active,created_at')
        .eq('active', true).order('created_at', { ascending: true });
      if (userError) throw userError;
      const { data: saved, error: permissionError } = await supabase
        .from('employee_permissions').select('user_id,permissions');
      if (permissionError) throw permissionError;
      setAccounts((users || []) as ManagedUser[]);
      const result: Record<string, PermissionSet> = {};
      for (const row of saved || []) result[row.user_id] = normalize(row.permissions);
      setPermissions(result);
    } catch {
      setError('Αποτυχία φόρτωσης χρηστών ή δικαιωμάτων από το Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') void reload();
    else setLoading(false);
  }, [user?.role, reload]);

  const savePermissions = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.from('employee_permissions')
        .upsert({ user_id: editingId, permissions: draft, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      setPermissions((current) => ({ ...current, [editingId]: draft }));
      setEditingId(null);
      setNotice('Τα δικαιώματα αποθηκεύτηκαν στο Supabase.');
    } catch {
      setError('Δεν αποθηκεύτηκαν τα δικαιώματα. Δεν εφαρμόστηκε η αλλαγή.');
    } finally {
      setSaving(false);
    }
  };

  const openEmployeeDialog = (mode: 'create' | 'reset', account?: ManagedUser) => {
    setEmployeeDialog(mode);
    setEmployeeId(account?.id ?? null);
    setEmployeeName('');
    setEmployeeUsername('');
    setEmployeePassword('');
    setShowEmployeePassword(false);
    setError('');
    setNotice('');
  };

  const manageEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (employeePassword.length < 8) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      return;
    }
    if (employeeDialog === 'create' && !/^[a-z][a-z0-9._-]{2,31}$/.test(employeeUsername.trim().toLowerCase())) {
      setError('Το username πρέπει να έχει 3–32 λατινικούς χαρακτήρες, αριθμούς, τελεία, παύλα ή κάτω παύλα και να αρχίζει από γράμμα.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data, error: requestError } = await supabase.functions.invoke('manage-employees', {
        body: employeeDialog === 'create'
          ? { operation: 'create', name: employeeName, username: employeeUsername, password: employeePassword }
          : { operation: 'reset_password', user_id: employeeId, password: employeePassword },
      });
      if (requestError || data?.error) throw new Error(data?.error || 'Αποτυχία επικοινωνίας με το Supabase');
      setEmployeeDialog(null);
      setEmployeePassword('');
      await reload();
      setNotice(employeeDialog === 'create' ? 'Ο υπάλληλος δημιουργήθηκε. Δώστε του το username και τον κωδικό που ορίσατε.' : 'Ο κωδικός του υπαλλήλου άλλαξε.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Η ενέργεια απέτυχε.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return <p role="alert" className="text-red-200">Μόνο ο Admin μπορεί να διαχειριστεί δικαιώματα.</p>;
  }

  return <div className="space-y-6">
    <PageHero title={t('users')} subtitle="Πραγματικοί λογαριασμοί και δικαιώματα ανά υπάλληλο" actions={
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openEmployeeDialog('create')} className="rounded-xl bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white">+ Νέος υπάλληλος</button>
        <button type="button" onClick={() => void reload()} disabled={loading} className="rounded-xl border border-[#2b5b85] bg-[#0b2949] px-4 py-2 text-sm text-white">
          <ArrowPathIcon className="mr-2 inline h-4 w-4" />Ανανέωση
        </button>
      </div>
    } />
    {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-green-400/40 bg-green-500/10 p-4 text-green-200">{notice}</p>}
    {loading ? <p className="text-blue-100/75">Φόρτωση...</p> :
      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((account) => <section key={account.id} className="rounded-2xl border border-[#1e4e7d] bg-[#0b2949] p-5">
          <div className="flex items-start gap-3">
            <UserGroupIcon className="h-7 w-7 shrink-0 text-[#8ec7ff]" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">{account.name}</h3>
              <p className="break-all text-sm text-blue-100/65">{account.role === 'admin' ? account.email : account.username ? `Username: ${account.username}` : 'Παλαιός λογαριασμός (χωρίς username)'}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-100/85">
            <ShieldCheckIcon className="h-5 w-5 text-[#8ec7ff]" />
            {account.role === 'admin' ? 'Admin — Διαχειριστής' : 'Manager — Υπάλληλος'}
          </div>
          {account.role === 'manager' ? <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => {
              setDraft(normalize(permissions[account.id]));
              setEditingId(account.id); setError(''); setNotice('');
            }} className="rounded-xl bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2478ff]">
              Διαχείριση δικαιωμάτων
            </button>
            <button type="button" onClick={() => openEmployeeDialog('reset', account)} className="rounded-xl border border-[#2b5b85] px-4 py-2 text-sm text-white">
              Νέος κωδικός
            </button>
          </div> : <p className="mt-3 text-xs text-blue-100/55">Ο Admin έχει όλα τα δικαιώματα.</p>}
        </section>)}
      </div>}
    {employeeDialog && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-3">
      <section role="dialog" aria-modal="true" aria-labelledby="staff-title" className="w-full max-w-md rounded-2xl border border-[#2b5b85] bg-[#0b2949] p-6 text-white shadow-2xl">
        <h2 id="staff-title" className="mb-4 text-xl font-semibold">{employeeDialog === 'create' ? 'Νέος υπάλληλος' : 'Αλλαγή κωδικού υπαλλήλου'}</h2>
        <form onSubmit={(event) => void manageEmployee(event)} className="space-y-4">
          {employeeDialog === 'create' && <>
            <label className="block text-sm">Ονοματεπώνυμο
              <input type="text" required minLength={2} maxLength={120} autoComplete="off" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#061a35] p-3 text-white" />
            </label>
            <label className="block text-sm">Username
              <input type="text" required minLength={3} maxLength={32} autoComplete="off" value={employeeUsername} onChange={(event) => setEmployeeUsername(event.target.value.toLowerCase())} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#061a35] p-3 text-white" />
            </label>
          </>}
          <label className="block text-sm">{employeeDialog === 'create' ? 'Κωδικός πρόσβασης' : 'Νέος κωδικός'}
            <div className="mt-1 flex overflow-hidden rounded-lg border border-[#2b5b85] bg-[#061a35]">
              <input type={showEmployeePassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={employeePassword} onChange={(event) => setEmployeePassword(event.target.value)} className="min-w-0 flex-1 bg-transparent p-3 text-white" />
              <button type="button" onClick={() => setShowEmployeePassword(!showEmployeePassword)} className="px-3 text-sm text-blue-100/75">{showEmployeePassword ? 'Απόκρυψη' : 'Εμφάνιση'}</button>
            </div>
          </label>
          <p className="text-xs text-blue-100/60">Ο κωδικός ορίζεται από τον Admin. Δεν αποστέλλεται email και ο υπάλληλος δεν χρειάζεται εγγραφή.</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={saving} onClick={() => { setEmployeeDialog(null); setEmployeePassword(''); setError(''); }} className="rounded-xl border border-[#2b5b85] px-4 py-2">Ακύρωση</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#1268f3] px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Αποθήκευση...' : employeeDialog === 'create' ? 'Δημιουργία' : 'Αλλαγή κωδικού'}</button>
          </div>
        </form>
      </section>
    </div>}
    {editingId && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3">
      <section role="dialog" aria-modal="true" aria-labelledby="permissions-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#2b5b85] bg-[#0b2949] p-4 text-white shadow-2xl sm:p-6">
        <h2 id="permissions-title" className="text-xl font-semibold">Δικαιώματα υπαλλήλου</h2>
        <p className="mt-1 text-sm text-blue-100/70">{accounts.find((a) => a.id === editingId)?.name}</p>
        <p className="mt-2 text-xs text-amber-200">Η διαγραφή κρατήσεων παραμένει διαθέσιμη μόνο στον Admin. Οι οικονομικές πληροφορίες μέσα σε κρατήσεις και στατιστικά χρειάζονται επιπλέον διαχωρισμό.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#2b5b85]"><th className="py-3 text-left">Ενότητα</th>
              {actions.map((a) => <th key={a.key} className="px-2 py-3 text-center">{a.title}</th>)}
            </tr></thead>
            <tbody>{categories.map((cat) => <tr key={cat.key} className="border-b border-[#2b5b85]/50">
              <th className="py-3 text-left font-medium">{cat.title}</th>
              {actions.map((action) => {
                const disabled = ((cat.key === 'bookings' || cat.key === 'fleet') && action.key === 'delete') || (cat.key === 'reports' && action.key !== 'view') || (cat.key === 'pricing' && action.key !== 'view');
                return <td key={action.key} className="px-2 text-center">
                  <input type="checkbox" aria-label={cat.title + ' ' + action.title} disabled={disabled} checked={!disabled && draft[cat.key][action.key]}
                    onChange={(event) => setDraft((old) => ({ ...old, [cat.key]: { ...old[cat.key], [action.key]: event.target.checked } }))}
                    className="h-4 w-4 accent-blue-500 disabled:opacity-25" />
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={() => setEditingId(null)} className="rounded-xl border border-[#2b5b85] px-4 py-2">Ακύρωση</button>
          <button type="button" disabled={saving} onClick={() => void savePermissions()} className="rounded-xl bg-[#1268f3] px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
        </div>
      </section>
    </div>}
  </div>;
};

export default UserManagement;
