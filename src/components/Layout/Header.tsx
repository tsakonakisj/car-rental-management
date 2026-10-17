import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Bars3Icon, ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onToggleSidebar?: () => void;
  previewRole?: 'admin' | 'manager';
  onPreviewRoleChange?: (role: 'admin' | 'manager') => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, previewRole = 'admin', onPreviewRoleChange }) => {
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'admin';
  const selectedRole = isAdmin ? previewRole : 'manager';

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  const openPasswordChange = () => {
    setMenuOpen(false);
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSaved(false);
    setChangePassword(true);
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (password.length < 8) {
      setPasswordError('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordSaved(true);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Η αλλαγή κωδικού απέτυχε.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="relative z-30 border-b border-[#1e4e7d]/70 bg-[#061a35]/90 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center">
              {onToggleSidebar && (
                <button onClick={onToggleSidebar} className="mr-3 flex-shrink-0 rounded-xl p-2 text-blue-100/65 transition-colors hover:bg-[#0b2949] hover:text-white lg:hidden" aria-label="Toggle menu">
                  <Bars3Icon className="h-6 w-6" />
                </button>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center space-x-2 sm:space-x-4">
              <div className="relative">
                <select value={language} onChange={(e) => setLanguage(e.target.value as 'el' | 'en')} className="cursor-pointer appearance-none rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 py-2 pl-3 pr-9 text-sm text-blue-50 transition-colors hover:border-[#4b8fc7] focus:border-[#55a8ff] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50">
                  <option value="el">Ελληνικά</option>
                  <option value="en">English</option>
                </select>
                <GlobeAltIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72b9ff]" />
              </div>
              <div className="relative" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Μενού χρήστη" className="flex items-center gap-2 rounded-lg p-1.5 text-sm text-blue-100/80 transition-colors hover:bg-[#0b2949] hover:text-white">
                  <span className="hidden max-w-[120px] truncate font-medium sm:block">{user?.name}</span>
                  <span className="rounded-full bg-[#1268f3]/20 px-2.5 py-0.5 text-xs font-semibold text-[#9bceff] ring-1 ring-inset ring-[#3f98ff]/40">{isAdmin ? selectedRole : user?.role}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-[#2b5b85] bg-[#0b2949] p-1.5 text-sm text-white shadow-2xl">
                    {isAdmin && onPreviewRoleChange && (
                      <>
                        <button role="menuitemradio" aria-checked={selectedRole === 'admin'} onClick={() => { onPreviewRoleChange('admin'); setMenuOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-[#16436a]">Προβολή ως Admin {selectedRole === 'admin' ? '✓' : ''}</button>
                        <button role="menuitemradio" aria-checked={selectedRole === 'manager'} onClick={() => { onPreviewRoleChange('manager'); setMenuOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-[#16436a]">Προβολή ως Manager {selectedRole === 'manager' ? '✓' : ''}</button>
                        <div className="my-1 border-t border-[#2b5b85]" />
                      </>
                    )}
                    <button role="menuitem" onClick={openPasswordChange} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-[#16436a]">Αλλαγή κωδικού</button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); void logout(); }} className="w-full rounded-lg px-3 py-2.5 text-left text-red-300 hover:bg-[#16436a]">Αποσύνδεση</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      {changePassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-2xl border border-[#2b5b85] bg-[#0b2949] p-6 text-white shadow-2xl">
            <h2 id="change-password-title" className="mb-4 text-xl font-semibold">Αλλαγή κωδικού</h2>
            {passwordSaved ? (
              <div>
                <p className="mb-5 text-green-300">Ο κωδικός άλλαξε επιτυχώς.</p>
                <button onClick={() => setChangePassword(false)} className="rounded-lg bg-blue-600 px-5 py-2">Κλείσιμο</button>
              </div>
            ) : (
              <form onSubmit={submitPassword} className="space-y-4">
                <label className="block text-sm">Νέος κωδικός
                  <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#061a35] p-3 text-white" />
                </label>
                <label className="block text-sm">Επιβεβαίωση νέου κωδικού
                  <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#2b5b85] bg-[#061a35] p-3 text-white" />
                </label>
                {passwordError && <p role="alert" className="text-sm text-red-300">{passwordError}</p>}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setChangePassword(false)} className="rounded-lg border border-[#2b5b85] px-4 py-2">Ακύρωση</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default Header;
