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
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 font-medium'
              } group flex items-center px-3 py-2.5 text-sm rounded-lg w-full transition-all duration-150 relative`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-primary-600" />
              )}
              <Icon
                className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-neutral-400 group-hover:text-neutral-600'
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-neutral-50 min-h-screen border-r border-neutral-200 flex-shrink-0">
        {navContent}
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 left-0 z-50 w-64 h-full bg-neutral-50 border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:hidden shadow-xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
