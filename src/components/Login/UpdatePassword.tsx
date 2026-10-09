import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { company } from '../../lib/company';
import { LockClosedIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const UpdatePassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) setErrorMsg('Η συνεδρία ανάκτησης δεν είναι έγκυρη. Παρακαλώ ζητήστε νέο email ανάκτησης.');
        }
      } catch {
        if (mounted) setErrorMsg('Προέκυψε σφάλμα κατά την επαλήθευση της συνεδρίας.');
      } finally {
        if (mounted) setVerifying(false);
      }
    };

    checkSession();

    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Όλα τα πεδία είναι υποχρεωτικά.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αλλαγής κωδικού.';
      setErrorMsg(msg || 'Αποτυχία αλλαγής κωδικού.');
    } finally {
      setSaving(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">Επαλήθευση συνεδρίας...</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckIcon className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Ο κωδικός άλλαξε επιτυχώς</h2>
            <p className="mt-2 text-sm text-gray-600">
              Θα ανακατευθυνθείτε στη σελίδα σύνδεσης...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {company.name}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ορισμός Νέου Κωδικού Πρόσβασης
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                Νέος Κωδικός
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Εισάγετε νέο κωδικό (ελάχ. 8 χαρακτήρες)"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Επιβεβαίωση Νέου Κωδικού
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Επιβεβαιώστε τον νέο κωδικό"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-md bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={saving}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Αποθήκευση...
                </>
              ) : (
                <>
                  <LockClosedIcon className="h-4 w-4 mr-2" />
                  Ορισμός Νέου Κωδικού
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;
