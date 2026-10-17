import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PageHero from '../Layout/PageHero';
import { ArrowPathIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'agent';
  active: boolean | null;
  last_login: string | null;
  created_at: string | null;
}

const roleLabel: Record<ManagedUser['role'], string> = {
  admin: 'Admin — Ιδιοκτήτης',
  manager: 'Manager — Υπάλληλος',
  agent: 'Agent — Υπάλληλος',
};

const UserManagement: React.FC = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: requestError } = await supabase
        .from('users')
        .select('id,email,name,role,active,last_login,created_at')
        .order('created_at', { ascending: true });
      if (requestError) throw requestError;
      setUsers((data ?? []) as ManagedUser[]);
    } catch {
      setError('Δεν ήταν δυνατή η φόρτωση των χρηστών. Ελέγξτε τα δικαιώματα πρόσβασης.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') void loadUsers();
    else setLoading(false);
  }, [currentUser?.role, loadUsers]);

  if (currentUser?.role !== 'admin') {
    return <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-5 text-red-200">Μόνο ο Admin μπορεί να ανοίξει τη Διαχείριση χρηστών.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('users')}
        subtitle="Πραγματικοί λογαριασμοί χρηστών από το Supabase"
        actions={
          <button type="button" onClick={() => void loadUsers()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#2b5b85] bg-[#0b2949] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Ανανέωση
          </button>
        }
      />
      <p className="text-sm text-blue-100/70">
        Οι λογαριασμοί παρακάτω είναι πραγματικοί. Η εξατομικευμένη διαχείριση δικαιωμάτων
        θα ενεργοποιηθεί αφού συνδεθούν με ασφαλείς κανόνες πρόσβασης στη βάση.
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {loading ? (
        <p className="text-blue-100/75">Φόρτωση χρηστών...</p>
      ) : !error && users.length === 0 ? (
        <p className="text-blue-100/75">Δεν βρέθηκαν χρήστες.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {users.map((account) => (
            <section key={account.id} className="rounded-2xl border border-[#1e4e7d] bg-[#0b2949] p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <UserGroupIcon className="h-7 w-7 shrink-0 text-[#8ec7ff]" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">{account.name}</h3>
                  <p className="break-all text-sm text-blue-100/65">{account.email}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${account.active ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                  {account.active ? 'Ενεργός' : 'Ανενεργός'}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-[#2b5b85] pt-3 text-sm text-blue-100/85">
                <ShieldCheckIcon className="h-5 w-5 text-[#8ec7ff]" />
                {roleLabel[account.role] ?? account.role}
              </div>
              <p className="mt-2 text-xs text-blue-100/50">
                Δημιουργήθηκε: {account.created_at ? new Date(account.created_at).toLocaleDateString('el-GR') : '—'}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
