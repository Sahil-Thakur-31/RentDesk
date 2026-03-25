import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
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
  Portfolio: 'Portfolio',
  Transactions: 'Transactions',
  Utilities: 'Utilities',
  Profile: 'Profile',
  Settings: 'Settings',
  Calendar: 'Calendar',
  Notifications: 'Notifications',
  Reports: 'Reports',
  'All Properties': 'All Properties',
  'Sign In': 'Sign In',
  Register: 'Register',
  RentDesk: 'RentDesk',
  'Sign in to continue.': 'Sign in to continue.',
  'Create your owner account.': 'Create your owner account.',
  'Full name': 'Full name',
  Email: 'Email',
  Password: 'Password',
  'Confirm password': 'Confirm password',
  'Forgot password?': 'Forgot password?',
  'Signing In...': 'Signing In...',
  'Creating Account...': 'Creating Account...',
  'Create Account': 'Create Account',
  'Reset Password': 'Reset Password',
  Close: 'Close',
  'Enter your email to receive a 6-digit OTP.': 'Enter your email to receive a 6-digit OTP.',
  'Enter the OTP and choose your new password.': 'Enter the OTP and choose your new password.',
  OTP: 'OTP',
  'New password': 'New password',
  'Send OTP': 'Send OTP',
  Back: 'Back',
  'OTP sent to your email.': 'OTP sent to your email.',
  'Password updated. You can sign in now.': 'Password updated. You can sign in now.',
  'Full name is required.': 'Full name is required.',
  'Passwords do not match.': 'Passwords do not match.',
  'Login failed.': 'Login failed.',
  'Could not create account.': 'Could not create account.',
  'Could not send OTP.': 'Could not send OTP.',
  'Could not reset password.': 'Could not reset password.',
  Account: 'Account',
  'No portfolio yet': 'No portfolio yet',
  Access: 'Access',
  Device: 'Device',
  Language: 'Language',
  English: 'English',
  Hindi: 'Hindi',
  'Sign Out': 'Sign Out',
  Properties: 'Properties',
  Members: 'Members',
  Invite: 'Invite',
  Requests: 'Requests',
  'Join Portfolio': 'Join Portfolio',
  '7-digit code': '7-digit code',
  'Request Access': 'Request Access',
  Search: 'Search',
  'Search by name or email': 'Search by name or email',
  'Choose a user first.': 'Choose a user first.',
  'Member added.': 'Member added.',
  'Unable to add member.': 'Unable to add member.',
  'Join request sent.': 'Join request sent.',
  'Unable to send join request.': 'Unable to send join request.',
  'Member updated.': 'Member updated.',
  'Unable to update member.': 'Unable to update member.',
  'Member removed.': 'Member removed.',
  'Unable to remove member.': 'Unable to remove member.',
  'Request approved.': 'Request approved.',
  'Request denied.': 'Request denied.',
  'Unable to update request.': 'Unable to update request.',
  'Edit Member': 'Edit Member',
  Save: 'Save',
  Edit: 'Edit',
  Remove: 'Remove',
  Approve: 'Approve',
  Deny: 'Deny',
  'Add Member': 'Add Member',
  More: 'More',
  Loading: 'Loading',
  owner: 'Owner',
  manager: 'Manager',
  warden: 'Warden',
  Member: 'Member',
  'No pending requests.': 'No pending requests.',
  'Unable to search users.': 'Unable to search users.',
  Rent: 'Rent',
  Electricity: 'Electricity',
  Maintenance: 'Maintenance',
  Deposit: 'Deposit',
  Others: 'Others',
  'Next Actions': 'Next Actions',
  'Nothing pending here.': 'Nothing pending here.',
  'Other Cash': 'Other Cash',
  Occupancy: 'Occupancy',
  pending: 'pending',
  unpaid: 'unpaid',
  PropertiesCount: 'Properties',
  UnitsCount: 'Units',
  TenantsCount: 'Tenants',
  'In current filter': 'In current filter',
  occupied: 'occupied',
  vacant: 'vacant',
  'Active tenants': 'Active tenants',
  'Extra income': 'Extra income'
};

const normalizeLanguage = (value: string | null | undefined): Language =>
  availableLanguages.has(value as Language) ? (value as Language) : 'en';

const getCacheKey = (language: Language) => `${TRANSLATION_CACHE_PREFIX}${language}`;

const loadCachedTranslations = async (language: Language) => {
  if (language === 'en') return {} as Record<string, string>;
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(language));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const saveCachedTranslations = async (language: Language, translations: Record<string, string>) => {
  if (language === 'en') return;
  await AsyncStorage.setItem(getCacheKey(language), JSON.stringify(translations));
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

let runtimeLanguage: Language = 'en';
export const getCurrentLanguage = () => runtimeLanguage;
export const getCurrentLocale = () => localeByLanguage[runtimeLanguage] || 'en-IN';

type I18nContextValue = {
  language: Language;
  languages: ReadonlyArray<(typeof LANGUAGE_OPTIONS)[number]>;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  languages: LANGUAGE_OPTIONS,
  setLanguage: async () => {},
  t: (key) => ENGLISH_LABELS[key] || key
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [flushVersion, setFlushVersion] = useState(0);
  const knownKeysRef = useRef<Set<string>>(new Set(Object.keys(ENGLISH_LABELS)));
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const failedUntilRef = useRef<Map<string, number>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = () => {
    if (language === 'en' || flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
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
    let cancelled = false;
    const load = async () => {
      const stored = normalizeLanguage(await AsyncStorage.getItem(STORAGE_KEY));
      runtimeLanguage = stored;
      if (cancelled) return;
      setLanguageState(stored);
      setTranslations(stored === 'en' ? {} : await loadCachedTranslations(stored));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    runtimeLanguage = language;
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
          void saveCachedTranslations(language, next);
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
      setLanguage: async (nextLanguage: Language) => {
        const normalized = normalizeLanguage(nextLanguage);
        runtimeLanguage = normalized;
        await AsyncStorage.setItem(STORAGE_KEY, normalized);
        setLanguageState(normalized);
        setTranslations(normalized === 'en' ? {} : await loadCachedTranslations(normalized));
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

