import React, { useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  TruckIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon
} from '@heroicons/react/24/outline';

export type AppRole = 'admin' | 'manager' | 'agent';

const ROLE_TAB_ACCESS: Record<AppRole, string[]> = {
  admin: ['dashboard', 'bookings', 'customers', 'fleet', 'pricing', 'reports', 'users', 'settings'],
  manager: ['dashboard', 'bookings', 'customers', 'fleet', 'pricing', 'reports'],
  agent: ['dashboard', 'bookings', 'customers', 'fleet'],
};

export function isTabAllowed(role: string | undefined, tab: string): boolean {
  if (!role) return false;
  const allowed = ROLE_TAB_ACCESS[role as AppRole];
  return allowed ? allowed.includes(tab) : false;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, mobileOpen = false, onCloseMobile }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const allMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: HomeIcon },
    { id: 'bookings', label: t('bookings'), icon: CalendarDaysIcon },
    { id: 'customers', label: t('customers'), icon: UsersIcon },
    { id: 'fleet', label: t('fleet'), icon: TruckIcon },
    { id: 'pricing', label: t('pricing'), icon: CurrencyEuroIcon },
    { id: 'reports', label: t('reports'), icon: ChartBarIcon },
    { id: 'users', label: t('users'), icon: UserGroupIcon },
    { id: 'settings', label: t('settings'), icon: CogIcon },
  ];

  const menuItems = allMenuItems.filter((item) => isTabAllowed(user?.role, item.id));

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    onCloseMobile?.();
  };

  const navContent = (
    <nav className="mt-6 px-3">
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`${
                activeTab === item.id
                  ? 'bg-blue-50 border-r-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — unchanged */}
      <div className="hidden lg:block w-64 bg-gray-50 min-h-screen border-r border-gray-200 flex-shrink-0">
        {navContent}
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 left-0 z-50 w-64 h-full bg-gray-50 border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
