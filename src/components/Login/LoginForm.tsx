import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { company } from '../../lib/company';
import { supabase } from '../../lib/supabase';
import { EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useAuth();

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await login(email, password);
    } catch {
      setErrorMsg('Λανθασμένο email ή κωδικός πρόσβασης.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');

    const emailToUse = forgotEmail || email;
    if (!emailToUse) {
      setForgotError('Παρακαλώ εισάγετε το email σας.');
      setForgotLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: 'https://tsakonakisj-earnwise-uvvy.bolt.host/update-password',
      });

      if (error) throw error;

      setForgotMsg('Στάλθηκε email ανάκτησης κωδικού. Ελέγξτε τα εισερχόμενά σας και ακολουθήστε τον σύνδεσμο για να ορίσετε νέο κωδικό.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αποστολής email ανάκτησης.';
      setForgotError(msg || 'Αποτυχία αποστολής email ανάκτησης.');
    } finally {
      setForgotLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {company.name}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Ανάκτηση Κωδικού Πρόσβασης
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="forgot-email"
                name="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Εισάγετε το email σας"
              />
              <p className="mt-2 text-xs text-gray-500">
                Θα λάβετε email με σύνδεσμο για να ορίσετε νέο κωδικό πρόσβασης.
              </p>
            </div>

            {forgotError && (
              <div className="rounded-md bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{forgotError}</p>
              </div>
            )}

            {forgotMsg && (
              <div className="rounded-md bg-green-50 px-4 py-3 flex items-start">
                <EnvelopeIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{forgotMsg}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={forgotLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {forgotLoading ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    Αποστολή...
                  </>
                ) : (
                  'Αποστολή Email Ανάκτησης'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setForgotMsg('');
                  setForgotError('');
                }}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Επιστροφή στη σύνδεση
              </button>
            </div>
          </form>
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
            Σύστημα Διαχείρισης Κρατήσεων
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Κωδικός</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Κωδικός πρόσβασης"
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
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Σύνδεση...' : 'Σύνδεση'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setShowForgot(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Ξέχασα τον κωδικό μου
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
