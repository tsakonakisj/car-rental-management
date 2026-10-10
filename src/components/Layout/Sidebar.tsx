import React, { useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadCompanyConfig } from '../../lib/company';
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
  const [companyName, setCompanyName] = React.useState('');

  useEffect(() => {
    loadCompanyConfig().then((cfg) => setCompanyName(cfg.name));
    const onStorage = () => loadCompanyConfig().then((cfg) => setCompanyName(cfg.name));
    window.addEventListener('company-settings-updated', onStorage);
    return () => window.removeEventListener('company-settings-updated', onStorage);
  }, []);

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
    <>
      <div className="border-b border-[#1e4e7d]/60 px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1268f3]/15 ring-1 ring-inset ring-[#3f98ff]/35">
            <TruckIcon className="h-6 w-6 text-[#4da3ff]" />
          </div>
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-white">{companyName}</span>
        </div>
      </div>
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
                  ? 'bg-[#1268f3]/20 text-white font-semibold shadow-[inset_0_0_0_1px_rgba(63,152,255,0.35)]'
                  : 'text-blue-100/65 hover:bg-[#0b2949] hover:text-white font-medium'
              } group flex items-center px-3 py-2.5 text-sm rounded-lg w-full transition-all duration-150 relative`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#2f8cff] shadow-[0_0_14px_rgba(47,140,255,0.7)]" />
              )}
              <Icon
                className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-[#55a8ff]' : 'text-blue-100/45 group-hover:text-[#8ec7ff]'
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </div>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden min-h-screen w-64 flex-shrink-0 border-r border-[#1e4e7d]/70 bg-[#041a32] lg:block">
        {navContent}
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#020b18]/75 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-64 transform border-r border-[#1e4e7d]/70 bg-[#041a32] shadow-[12px_0_40px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
