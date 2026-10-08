import { supabase } from './supabase';

export interface CompanyConfig {
  name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  taxNumber: string;
  registrationNumber: string;
  contractHeader: string;
  contractSubheader: string;
}

// Fallback defaults (used when database is not available)
const DEFAULT_CONFIG: CompanyConfig = {
  name: 'Demo Rent a Car',
  phone: '+30 28210 00000',
  email: 'info@demo-rentacar.gr',
  address: 'Χανιά, Κρήτη',
  website: 'www.demo-rentacar.gr',
  taxNumber: '000000000',
  registrationNumber: 'ΑΕ 00000',
  contractHeader: 'DEMO RENT A CAR',
  contractSubheader: 'Chania, Crete',
};

// Cached company config
let cachedConfig: CompanyConfig | null = null;

/**
 * Load company settings from database via RPC
 */
export async function loadCompanyConfig(): Promise<CompanyConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'company')
        .maybeSingle();

      if (!error && data) {
        const v = (data as { value: Record<string, unknown> }).value;
        cachedConfig = {
          name: (v.name as string) || DEFAULT_CONFIG.name,
          phone: (v.phone as string) || DEFAULT_CONFIG.phone,
          email: (v.email as string) || DEFAULT_CONFIG.email,
          address: (v.address as string) || DEFAULT_CONFIG.address,
          website: (v.website as string) || DEFAULT_CONFIG.website,
          taxNumber: (v.taxNumber as string) || DEFAULT_CONFIG.taxNumber,
          registrationNumber: (v.registrationNumber as string) || DEFAULT_CONFIG.registrationNumber,
          contractHeader: (v.contractHeader as string) || DEFAULT_CONFIG.contractHeader,
          contractSubheader: (v.contractSubheader as string) || DEFAULT_CONFIG.contractSubheader,
        };
        return cachedConfig;
      }
    }
  } catch (err) {
    console.error('Failed to load company config:', err);
  }

  return DEFAULT_CONFIG;
}

/**
 * Get company config (synchronous, returns cached or default)
 */
export function getCompanyConfig(): CompanyConfig {
  return cachedConfig || DEFAULT_CONFIG;
}

/**
 * Clear cached config (call after settings update)
 */
export function clearCompanyCache(): void {
  cachedConfig = null;
}

// Default export for backward compatibility
export const company = DEFAULT_CONFIG;
