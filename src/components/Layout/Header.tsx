import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadCompanyConfig } from '../../lib/company';
import { Bars3Icon, ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    loadCompanyConfig().then((cfg) => setCompanyName(cfg.name));

    const onStorage = () => {
      loadCompanyConfig().then((cfg) => setCompanyName(cfg.name));
    };
    window.addEventListener('company-settings-updated', onStorage);
    return () => window.removeEventListener('company-settings-updated', onStorage);
  }, []);

  return (
    <header className="border-b border-[#1e4e7d]/70 bg-[#061a35]/90 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: hamburger + company name */}
          <div className="flex items-center min-w-0 flex-1">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="mr-3 flex-shrink-0 rounded-xl p-2 text-blue-100/65 transition-colors hover:bg-[#0b2949] hover:text-white lg:hidden"
                aria-label="Toggle menu"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            )}
            <div className="min-w-0 flex-shrink">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
                {companyName}
              </h1>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {/* Language Switcher */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'el' | 'en')}
                className="cursor-pointer appearance-none rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/80 py-2 pl-3 pr-9 text-sm text-blue-50 transition-colors hover:border-[#4b8fc7] focus:border-[#55a8ff] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]/50"
              >
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </select>
              <GlobeAltIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72b9ff]" />
            </div>

            {/* User Menu */}
            <div className="relative">
              <div className="flex items-center space-x-2.5 text-sm">
                <span className="hidden max-w-[120px] truncate font-medium text-blue-100/80 sm:block">
                  {user?.name}
                </span>
                <span className="inline-flex items-center rounded-full bg-[#1268f3]/20 px-2.5 py-0.5 text-xs font-semibold text-[#9bceff] ring-1 ring-inset ring-[#3f98ff]/40">
                  {user?.role}
                </span>
                <button
                  onClick={logout}
                  className="rounded-lg p-1.5 text-blue-100/45 transition-colors hover:bg-[#0b2949] hover:text-white"
                  aria-label="Logout"
                  title="Logout"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
