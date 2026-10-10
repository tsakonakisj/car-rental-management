import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { company } from '../../lib/company';
import PageHero from '../Layout/PageHero';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'agent' | 'manager' | 'admin';
  active: boolean;
  last_login?: string;
  created_at: string;
}

const UserManagement: React.FC = () => {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);

  // Mock data
  const users: User[] = [
    {
      id: '1',
      email: `admin@${company.email.split('@')[1]}`,
      name: 'Διαχειριστής Συστήματος',
      role: 'admin',
      active: true,
      last_login: '2025-01-15T10:30:00',
      created_at: '2024-01-01T00:00:00'
    },
    {
      id: '2',
      email: `manager@${company.email.split('@')[1]}`,
      name: 'Μάνατζερ Καταστήματος',
      role: 'manager',
      active: true,
      last_login: '2025-01-15T09:15:00',
      created_at: '2024-02-15T00:00:00'
    },
    {
      id: '3',
      email: `agent1@${company.email.split('@')[1]}`,
      name: 'Πράκτορας 1',
      role: 'agent',
      active: true,
      last_login: '2025-01-14T16:45:00',
      created_at: '2024-03-01T00:00:00'
    },
    {
      id: '4',
      email: `agent2@${company.email.split('@')[1]}`,
      name: 'Πράκτορας 2',
      role: 'agent',
      active: false,
      created_at: '2024-06-01T00:00:00'
    }
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40';
      case 'manager': return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
      case 'agent': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40';
      default: return 'bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Διαχειριστής';
      case 'manager': return 'Μάνατζερ';
      case 'agent': return 'Πράκτορας';
      default: return role;
    }
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'admin':
        return ['Πλήρη δικαιώματα', 'Διαχείριση χρηστών', 'Ρυθμίσεις συστήματος'];
      case 'manager':
        return ['Κρατήσεις', 'Αναφορές', 'Τιμές & Σεζόν', 'Στόλος'];
      case 'agent':
        return ['Κρατήσεις', 'Check-in/out', 'Πελάτες'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        title={t('users')}
        subtitle="Διαχείριση χρηστών και δικαιωμάτων"
        actions={(
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center rounded-xl border border-transparent bg-[#1268f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(18,104,243,0.28)] transition-colors hover:bg-[#2478ff]"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Νέος Χρήστης
          </button>
        )}
      />

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {users.map((user) => (
          <div key={user.id} className="rounded-2xl border border-[#1e4e7d]/70 bg-[linear-gradient(145deg,rgba(11,42,75,0.96),rgba(5,24,48,0.98))] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <UserGroupIcon className="h-8 w-8 text-blue-100/45 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-white">{user.name}</h3>
                    <p className="text-sm text-blue-100/65">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    <ShieldCheckIcon className="h-3 w-3 mr-1" />
                    {getRoleLabel(user.role)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.active ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/40' : 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/40'
                  }`}>
                    {user.active ? 'Ενεργός' : 'Ανενεργός'}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-blue-100/85 mb-2">Δικαιώματα:</h4>
                <div className="flex flex-wrap gap-1">
                  {getRolePermissions(user.role).map((permission, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/15 text-[#8ec7ff] ring-1 ring-inset ring-blue-400/40"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-blue-100/55">Δημιουργήθηκε:</span>
                  <p className="font-medium text-blue-50">
                    {new Date(user.created_at).toLocaleDateString('el-GR')}
                  </p>
                </div>
                <div>
                  <span className="text-blue-100/55">Τελευταία σύνδεση:</span>
                  <p className="font-medium text-blue-50">
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleDateString('el-GR')
                      : 'Ποτέ'
                    }
                  </p>
                </div>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white">
                  <EyeIcon className="h-4 w-4 mr-1" />
                  Προβολή
                </button>
                <button className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#2b5b85]/80 bg-[#0b2949]/75 px-3 py-2 text-sm font-medium text-blue-100/85 transition-colors hover:border-[#55a8ff] hover:bg-[#12375d] hover:text-white">
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Επεξεργασία
                </button>
                <button className="inline-flex items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/25">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Role Descriptions */}
      <div className="rounded-2xl border border-[#1e4e7d]/70 bg-[#071d38]/90 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="px-6 py-4 border-b border-[#1e4e7d]/70">
          <h2 className="text-lg font-medium text-white tracking-[-0.02em]">Περιγραφή Ρόλων</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-red-400/40 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <ShieldCheckIcon className="h-6 w-6 text-red-300 mr-2" />
                <h3 className="font-medium text-red-300">Διαχειριστής (Admin)</h3>
              </div>
              <ul className="text-sm text-blue-100/65 space-y-1">
                <li>• Πλήρη πρόσβαση σε όλες τις λειτουργίες</li>
                <li>• Διαχείριση χρηστών και ρόλων</li>
                <li>• Ρυθμίσεις συστήματος</li>
                <li>• Audit logs</li>
              </ul>
            </div>
            
            <div className="border border-[#2b5b85]/80 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <ShieldCheckIcon className="h-6 w-6 text-[#55a8ff] mr-2" />
                <h3 className="font-medium text-[#8ec7ff]">Μάνατζερ (Manager)</h3>
              </div>
              <ul className="text-sm text-blue-100/65 space-y-1">
                <li>• Όλες οι λειτουργίες Agent</li>
                <li>• Αναφορές και στατιστικά</li>
                <li>• Διαχείριση τιμών και σεζόν</li>
                <li>• Διαχείριση στόλου</li>
              </ul>
            </div>
            
            <div className="border border-emerald-400/40 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <ShieldCheckIcon className="h-6 w-6 text-emerald-300 mr-2" />
                <h3 className="font-medium text-emerald-300">Πράκτορας (Agent)</h3>
              </div>
              <ul className="text-sm text-blue-100/65 space-y-1">
                <li>• Δημιουργία κρατήσεων</li>
                <li>• Check-in/Check-out</li>
                <li>• Διαχείριση πελατών</li>
                <li>• Έκδοση συμβολαίων</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;