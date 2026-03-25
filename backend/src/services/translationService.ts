const TRANSLATION_CACHE = new Map<string, string>();
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

const DOMAIN_TRANSLATION_OVERRIDES: Record<string, Record<string, string>> = {
  hi: {
    Dashboard: 'डैशबोर्ड',
    Properties: 'प्रॉपर्टीज़',
    Property: 'प्रॉपर्टी',
    'All Properties': 'सभी प्रॉपर्टीज़',
    Units: 'यूनिट्स',
    Unit: 'यूनिट',
    Tenants: 'किरायेदार',
    Tenant: 'किरायेदार',
    Transactions: 'लेन-देन',
    Utilities: 'यूटिलिटीज़',
    Reports: 'रिपोर्ट्स',
    Notifications: 'सूचनाएँ',
    Profile: 'प्रोफ़ाइल',
    Settings: 'सेटिंग्स',
    Calendar: 'कैलेंडर',
    Portfolio: 'पोर्टफोलियो',
    'Portfolio Profile': 'पोर्टफोलियो प्रोफ़ाइल',
    Rent: 'किराया',
    Electricity: 'बिजली',
    Maintenance: 'मेंटेनेंस',
    Deposit: 'डिपॉजिट',
    Others: 'अन्य',
    'Other Cash': 'अन्य नकद',
    Occupancy: 'ऑक्यूपेंसी',
    'Next Actions': 'अगले काम',
    'Add Payment': 'भुगतान जोड़ें',
    Summary: 'सारांश',
    'Property Details': 'प्रॉपर्टी विवरण',
    'Unit Details': 'यूनिट विवरण',
    'Tenant Details': 'किरायेदार विवरण',
    'Rent Records': 'किराया रिकॉर्ड',
    'Utility Bills': 'यूटिलिटी बिल',
    'Electricity Readings': 'बिजली रीडिंग'
  }
};

const normalizeLanguage = (language: string) => {
  const trimmed = String(language || 'en').trim();
  return trimmed || 'en';
};

const buildCacheKey = (language: string, text: string) => `${language}::${text}`;

const getOverrideTranslation = (language: string, text: string) => {
  return DOMAIN_TRANSLATION_OVERRIDES[language]?.[text] || '';
};

const parseGoogleTranslateResponse = (payload: any, fallback: string) => {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return fallback;
  const translated = payload[0]
    .map((segment: any) => (Array.isArray(segment) ? String(segment[0] || '') : ''))
    .join('')
    .trim();
  return translated || fallback;
};

const translateText = async (language: string, text: string) => {
  if (!text.trim() || language === 'en') return text;

  const override = getOverrideTranslation(language, text);
  if (override) {
    return override;
  }

  const cacheKey = buildCacheKey(language, text);
  const cached = TRANSLATION_CACHE.get(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(GOOGLE_TRANSLATE_ENDPOINT);
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'en');
    url.searchParams.set('tl', language);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RentDesk/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Translation request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const translated = parseGoogleTranslateResponse(payload, text);
    TRANSLATION_CACHE.set(cacheKey, translated);
    return translated;
  } catch {
    return text;
  }
};

export const translateTexts = async (language: string, texts: string[]) => {
  const targetLanguage = normalizeLanguage(language);
  const uniqueTexts = Array.from(
    new Set(
      texts
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 500);

  if (targetLanguage === 'en' || !uniqueTexts.length) {
    return Object.fromEntries(uniqueTexts.map((text) => [text, text]));
  }

  const translations = await Promise.all(
    uniqueTexts.map(async (text) => [text, await translateText(targetLanguage, text)] as const)
  );

  return Object.fromEntries(translations);
};
