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

export interface ContractTerm {
  en: string;
  el: string;
}

export const DEFAULT_CONTRACT_TERMS: ContractTerm[] = [
  { en: 'The vehicle is delivered to the renter in the condition stated above.', el: 'Το όχημα παραδίδεται στον ενοικιαστή στην κατάσταση που αναγράφεται παραπάνω.' },
  { en: 'Vehicle must be returned with the same fuel level. Shortfall will be charged.', el: 'Το όχημα πρέπει να επιστραφεί με το ίδιο επίπεδο καυσίμου. Τυχόν έλλειψη χρεώνεται.' },
  { en: 'Renter is liable for all damage during rental up to the self risk amount.', el: 'Ο ενοικιαστής ευθύνεται πλήρως για κάθε ζημιά κατά την ενοικίαση πέραν του self risk.' },
  { en: 'Late returns are charged per hour according to company rates.', el: 'Κθυστερημένη επιστροφή χρεώνεται ανά ώρα σύμφωνα με τα τιμολόγια της εταιρείας.' },
  { en: 'Smoking and pets are strictly prohibited.', el: 'Απαγορεύεται το κάπνισμα και η μεταφορά ζώων.' },
  { en: 'In case of accident, notify the company and authorities immediately.', el: 'Σε περίπτωση ατυχήματος ειδοποιήστε άμεσα την εταιρεία και τις αρχές.' },
  { en: 'Driving under the influence of alcohol or drugs is strictly forbidden.', el: 'Απαγορεύεται η οδήγηση υπό την επήρεια αλκοόλ ή ναρκωτικών.' },
];

let cachedTerms: ContractTerm[] | null = null;

export async function loadContractTerms(): Promise<ContractTerm[]> {
  if (cachedTerms) return cachedTerms;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'contract_terms')
        .maybeSingle();

      if (!error && data) {
        const v = (data as { value: unknown }).value;
        if (Array.isArray(v) && v.length > 0) {
          cachedTerms = v as ContractTerm[];
          return cachedTerms;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load contract terms:', err);
  }

  return DEFAULT_CONTRACT_TERMS;
}

export function clearTermsCache(): void {
  cachedTerms = null;
}

// Default export for backward compatibility
export const company = DEFAULT_CONFIG;
