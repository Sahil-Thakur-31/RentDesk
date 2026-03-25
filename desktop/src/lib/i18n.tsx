import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { appStorage } from './appStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const STORAGE_KEY = 'rentdesk_language';
const TRANSLATION_CACHE_PREFIX = 'rentdesk_translations_v3_';
const FAILED_RETRY_MS = 30_000;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', locale: 'en-IN' },
  { value: 'hi', label: '\u0939\u093f\u0928\u094d\u0926\u0940 (Hindi)', locale: 'hi-IN' },
  { value: 'bn', label: '\u09ac\u09be\u0982\u09b2\u09be (Bengali)', locale: 'bn-IN' },
  { value: 'mr', label: '\u092e\u0930\u093e\u0920\u0940 (Marathi)', locale: 'mr-IN' },
  { value: 'ta', label: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd (Tamil)', locale: 'ta-IN' },
  { value: 'te', label: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41 (Telugu)', locale: 'te-IN' },
  { value: 'gu', label: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0 (Gujarati)', locale: 'gu-IN' },
  { value: 'kn', label: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1 (Kannada)', locale: 'kn-IN' },
  { value: 'ml', label: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02 (Malayalam)', locale: 'ml-IN' },
  { value: 'pa', label: '\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40 (Punjabi)', locale: 'pa-IN' },
  { value: 'ur', label: '\u0627\u0631\u062f\u0648 (Urdu)', locale: 'ur-IN' },
  { value: 'or', label: '\u0b13\u0b21\u0b3c\u0b3f\u0b06 (Odia)', locale: 'or-IN' },
  { value: 'es', label: 'Español', locale: 'es-ES' },
  { value: 'fr', label: 'Français', locale: 'fr-FR' },
  { value: 'de', label: 'Deutsch', locale: 'de-DE' },
  { value: 'pt', label: 'Português', locale: 'pt-BR' },
  { value: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', locale: 'ru-RU' },
  { value: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', locale: 'ar' },
  { value: 'zh-CN', label: '\u4e2d\u6587\uff08\u7b80\u4f53\uff09', locale: 'zh-CN' },
  { value: 'ja', label: '\u65e5\u672c\u8a9e', locale: 'ja-JP' },
  { value: 'ko', label: '\ud55c\uad6d\uc5b4', locale: 'ko-KR' },
  { value: 'it', label: 'Italiano', locale: 'it-IT' },
  { value: 'tr', label: 'Türkçe', locale: 'tr-TR' },
  { value: 'id', label: 'Bahasa Indonesia', locale: 'id-ID' },
  { value: 'nl', label: 'Nederlands', locale: 'nl-NL' }
] as const;

export type Language = (typeof LANGUAGE_OPTIONS)[number]['value'];

const localeByLanguage = Object.fromEntries(LANGUAGE_OPTIONS.map((option) => [option.value, option.locale])) as Record<Language, string>;
const availableLanguages = new Set(LANGUAGE_OPTIONS.map((option) => option.value));

const ENGLISH_LABELS: Record<string, string> = {
  Dashboard: 'Dashboard',
  Properties: 'Properties',
  Units: 'Units',
  Tenants: 'Tenants',
  Transactions: 'Transactions',
  Utilities: 'Utilities',
  Reports: 'Reports',
  Notifications: 'Notifications',
  Profile: 'Profile',
  Settings: 'Settings',
  Calendar: 'Calendar',
  'All Properties': 'All Properties',
  'Rent Records': 'Rent Records',
  'Utility Bills': 'Utility Bills',
  Maintenance: 'Maintenance',
  'Electricity Readings': 'Electricity Readings',
  'Property Details': 'Property Details',
  'Unit Details': 'Unit Details',
  'Tenant Details': 'Tenant Details',
  Online: 'Online',
  Offline: 'Offline',
  Syncing: 'Syncing',
  queued: 'queued',
  Logout: 'Logout',
  'Portfolio Profile': 'Portfolio Profile',
  'Recent updates': 'Recent updates',
  'View more': 'View more',
  'Tip: Use the dashboard to review rent gaps and pending payments every week.':
    'Tip: Use the dashboard to review rent gaps and pending payments every week.',
  'Welcome to RentDesk': 'Welcome to RentDesk',
  'Sign in to manage your properties.': 'Sign in to manage your properties.',
  'Create your owner account to get started.': 'Create your owner account to get started.',
  'Sign In': 'Sign In',
  Register: 'Register',
  'Full Name': 'Full Name',
  Email: 'Email',
  Password: 'Password',
  'Confirm Password': 'Confirm Password',
  'Forgot password?': 'Forgot password?',
  'Already have an account? Sign In': 'Already have an account? Sign In',
  'Create Account': 'Create Account',
  'Creating account...': 'Creating account...',
  'Signing in...': 'Signing in...',
  'Reset password': 'Reset password',
  Close: 'Close',
  'Enter your email and we will send a 6-digit OTP.': 'Enter your email and we will send a 6-digit OTP.',
  'Enter the OTP from your email and choose a new password.':
    'Enter the OTP from your email and choose a new password.',
  OTP: 'OTP',
  'New Password': 'New Password',
  'Send OTP': 'Send OTP',
  'Sending OTP...': 'Sending OTP...',
  'Reset Password': 'Reset Password',
  Back: 'Back',
  Updating: 'Updating...',
  'Portfolio Access': 'Portfolio Access',
  'Set up your workspace': 'Set up your workspace',
  'Create your own portfolio or request access to an existing one.':
    'Create your own portfolio or request access to an existing one.',
  'Create Portfolio': 'Create Portfolio',
  'Join Existing': 'Join Existing',
  'Portfolio Name': 'Portfolio Name',
  '7-Digit Portfolio Code': '7-Digit Portfolio Code',
  'Send Request': 'Send Request',
  'Refresh Access': 'Refresh Access',
  Account: 'Account',
  Role: 'Role',
  Portfolio: 'Portfolio',
  Sync: 'Sync',
  Connection: 'Connection',
  Queued: 'Queued',
  'Local Views': 'Local Views',
  'Last synced:': 'Last synced:',
  Waiting: 'Waiting',
  Device: 'Device',
  'Local data': 'Local data',
  'Clear Local Data': 'Clear Local Data',
  Session: 'Session',
  'Sign out': 'Sign out',
  'Sign Out From This Device': 'Sign Out From This Device',
  'Delete account': 'Delete account',
  'Delete My Account': 'Delete My Account',
  'Delete this account permanently?': 'Delete this account permanently?',
  'This cannot be undone. Your access will be removed from every portfolio immediately.':
    'This cannot be undone. Your access will be removed from every portfolio immediately.',
  'Confirm Delete': 'Confirm Delete',
  Cancel: 'Cancel',
  Language: 'Language',
  English: 'English',
  Hindi: 'Hindi',
  'Checking session...': 'Checking session...',
  'Preparing local data...': 'Preparing local data...',
  'Full name is required.': 'Full name is required.',
  'Passwords do not match.': 'Passwords do not match.',
  'Login failed. Check credentials.': 'Login failed. Check credentials.',
  'OTP sent to your email.': 'OTP sent to your email.',
  'Password updated. You can sign in now.': 'Password updated. You can sign in now.',
  'Could not send OTP.': 'Could not send OTP.',
  'Could not reset password.': 'Could not reset password.',
  'Unable to create portfolio right now.': 'Unable to create portfolio right now.',
  'Request sent. This screen will unlock once the owner approves it.': 'Request sent. This screen will unlock once the owner approves it.',
  'Unable to send join request right now.': 'Unable to send join request right now.',
  'Creating...': 'Creating...',
  'Sending...': 'Sending...',
  'Unable to load settings right now.': 'Unable to load settings right now.',
  'Local data cleared. RentDesk will rebuild it automatically.': 'Local data cleared. RentDesk will rebuild it automatically.',
  'Unable to delete account right now.': 'Unable to delete account right now.',
  'Not joined yet': 'Not joined yet',
  'Owners delete all portfolios they own. Other users are removed from every joined portfolio.': 'Owners delete all portfolios they own. Other users are removed from every joined portfolio.',
  'Deleting...': 'Deleting...',
  Rent: 'Rent',
  Electricity: 'Electricity',
  Deposit: 'Deposit',
  Others: 'Others',
  Summary: 'Summary',
  'Add Payment': 'Add Payment',
  'Next Actions': 'Next Actions',
  'Cash Received / Expected': 'Cash Received / Expected',
  'Maintenance Spent': 'Maintenance Spent',
  Occupancy: 'Occupancy',
  'Other Cash': 'Other Cash',
  'Extra income received': 'Extra income received',
  'Property expenses': 'Property expenses',
  'Total buildings and flats': 'Total buildings and flats',
  'No pending rent.': 'No pending rent.',
  'No pending electricity bills.': 'No pending electricity bills.',
  'No pending maintenance.': 'No pending maintenance.',
  'No pending deposit.': 'No pending deposit.',
  'No pending other payments.': 'No pending other payments.',
  pending: 'pending',
  unpaid: 'unpaid',
  'of total': 'of total'
};

const normalizeLanguage = (value: string | null | undefined): Language =>
  availableLanguages.has(value as Language) ? (value as Language) : 'en';

const getCacheKey = (language: Language) => `${TRANSLATION_CACHE_PREFIX}${language}`;

const loadCachedTranslations = (language: Language) => {
  if (language === 'en') return {} as Record<string, string>;
  try {
    const raw = appStorage.getItem(getCacheKey(language));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const saveCachedTranslations = (language: Language, translations: Record<string, string>) => {
  if (language === 'en') return;
  appStorage.setItem(getCacheKey(language), JSON.stringify(translations));
};

const requestTranslations = async (language: Language, texts: string[]) => {
  const response = await fetch(`${API_BASE_URL}/i18n/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, texts })
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { translations?: Record<string, string> };
  return payload.translations || {};
};

let runtimeLanguage: Language = normalizeLanguage(appStorage.getItem(STORAGE_KEY));

export const getCurrentLanguage = (): Language => runtimeLanguage;
export const getCurrentLocale = (): string => localeByLanguage[runtimeLanguage] || 'en-IN';

type I18nContextValue = {
  language: Language;
  languages: ReadonlyArray<(typeof LANGUAGE_OPTIONS)[number]>;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  languages: LANGUAGE_OPTIONS,
  setLanguage: () => {},
  t: (key) => ENGLISH_LABELS[key] || key
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(runtimeLanguage);
  const [translations, setTranslations] = useState<Record<string, string>>(
    runtimeLanguage === 'en' ? {} : loadCachedTranslations(runtimeLanguage)
  );
  const [flushVersion, setFlushVersion] = useState(0);
  const knownKeysRef = useRef<Set<string>>(new Set(Object.keys(ENGLISH_LABELS)));
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const failedUntilRef = useRef<Map<string, number>>(new Map());
  const flushTimerRef = useRef<number | null>(null);

  const scheduleFlush = () => {
    if (language === 'en' || flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      setFlushVersion((value) => value + 1);
    }, 0);
  };

  const queueKey = (key: string) => {
    const normalized = ENGLISH_LABELS[key] || key;
    if (!normalized) return;
    knownKeysRef.current.add(normalized);
    if (language === 'en' || translations[normalized]) return;

    const blockedUntil = failedUntilRef.current.get(normalized) || 0;
    if (blockedUntil > Date.now()) return;

    pendingKeysRef.current.add(normalized);
    scheduleFlush();
  };

  useEffect(() => {
    runtimeLanguage = language;
    setTranslations(language === 'en' ? {} : loadCachedTranslations(language));
    if (language !== 'en') {
      knownKeysRef.current.forEach((key) => pendingKeysRef.current.add(key));
      scheduleFlush();
    }
  }, [language]);

  useEffect(() => {
    if (language === 'en') return;
    const keys = Array.from(pendingKeysRef.current).filter((key) => !translations[key]);
    if (!keys.length) return;
    pendingKeysRef.current.clear();

    let cancelled = false;
    void (async () => {
      try {
        const bundle = await requestTranslations(language, keys);
        if (cancelled) return;
        setTranslations((current) => {
          const next = { ...current, ...bundle };
          saveCachedTranslations(language, next);
          return next;
        });
        keys.forEach((key) => failedUntilRef.current.delete(key));
      } catch {
        const retryAt = Date.now() + FAILED_RETRY_MS;
        keys.forEach((key) => failedUntilRef.current.set(key, retryAt));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flushVersion, language, translations]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      languages: LANGUAGE_OPTIONS,
      setLanguage: (nextLanguage: Language) => {
        const normalized = normalizeLanguage(nextLanguage);
        runtimeLanguage = normalized;
        appStorage.setItem(STORAGE_KEY, normalized);
        setLanguageState(normalized);
      },
      t: (key: string) => {
        const normalized = ENGLISH_LABELS[key] || key;
        if (!normalized) return '';
        if (language !== 'en' && !translations[normalized]) {
          queueKey(normalized);
        } else {
          knownKeysRef.current.add(normalized);
        }
        return language === 'en' ? normalized : translations[normalized] || normalized;
      }
    }),
    [language, translations]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);

