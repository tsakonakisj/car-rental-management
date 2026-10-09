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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: hamburger + company name */}
          <div className="flex items-center min-w-0 flex-1">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden flex-shrink-0 mr-3 p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label="Toggle menu"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            )}
            <div className="min-w-0 flex-shrink">
              <h1 className="text-lg sm:text-xl font-bold text-blue-600 truncate">
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
                className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </select>
              <GlobeAltIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* User Menu */}
            <div className="relative">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-700 hidden sm:block truncate max-w-[120px]">
                  {user?.name}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user?.role}
                </span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Logout"
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
