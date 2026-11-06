/**
 * Versey — Verse & Localization Module (ES Module)
 * Handles local day-of-year calculation, language detection, on-demand CJK font
 * loading, i18n strings, and per-language verse fetching with silent English fallback.
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh-Hans', 'zh-Hant', 'id'];
export const LANG_STORAGE_KEY = 'versey_language';

const cachedVersesByLang = {};
let cachedI18n = null;
const loadedFontLinks = new Set();

/**
 * Detects initial language from localStorage or navigator.language.
 * Rules:
 * - es* -> 'es'
 * - id* -> 'id'
 * - zh-TW / zh-HK / zh-Hant -> 'zh-Hant'
 * - zh-CN / zh-SG / zh-Hans / zh* -> 'zh-Hans'
 * - otherwise -> 'en'
 * @returns {string}
 */
export function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }

  const navLangs =
    typeof navigator !== 'undefined'
      ? navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || 'en']
      : ['en'];

  for (const raw of navLangs) {
    const tag = String(raw || '').toLowerCase();
    if (!tag) continue;
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('id') || tag.startsWith('in')) return 'id';
    if (tag.startsWith('zh')) {
      if (tag.includes('hant') || tag.includes('tw') || tag.includes('hk') || tag.includes('mo')) {
        return 'zh-Hant';
      }
      return 'zh-Hans';
    }
    if (tag.startsWith('en')) return 'en';
  }

  return 'en';
}

/**
 * Persists selected language to localStorage safely.
 * @param {string} langCode
 */
export function saveLanguagePreference(langCode) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, langCode);
  } catch {
    // Work without localStorage if blocked
  }
}

/**
 * Dynamically injects Google Fonts stylesheet for Simplified or Traditional Chinese
 * ONLY when a Chinese language is selected.
 * @param {string} langCode
 */
export function ensureCjkStylesheet(langCode) {
  if (typeof document === 'undefined') return;

  const fontUrls = {
    'zh-Hans':
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;600;700&display=swap',
    'zh-Hant':
      'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@400;600;700&display=swap'
  };

  const href = fontUrls[langCode];
  if (!href || loadedFontLinks.has(langCode)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.cjkLang = langCode;
  document.head.appendChild(link);
  loadedFontLinks.add(langCode);
}

/**
 * Calculates day of the year (1 - 366) from a given Date object in the user's local time.
 * Uses UTC midnight difference of local year/month/day components to avoid DST drift.
 * @param {Date} date
 * @returns {number} 1-based day index
 */
export function getDayOfYear(date = new Date()) {
  const startUtc = Date.UTC(date.getFullYear(), 0, 1);
  const currentUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const oneDayMs = 1000 * 60 * 60 * 24;
  return Math.floor((currentUtc - startUtc) / oneDayMs) + 1;
}

/**
 * Returns milliseconds remaining until the user's next local midnight.
 * @param {Date} now
 * @returns {number}
 */
export function getMsUntilLocalMidnight(now = new Date()) {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

/**
 * Loads and caches `/data/i18n.json`.
 * @returns {Promise<Object>}
 */
export async function loadI18n() {
  if (cachedI18n && Object.keys(cachedI18n).length > 0) return cachedI18n;
  try {
    const response = await fetch('./data/i18n.json?v=6', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cachedI18n = await response.json();
    return cachedI18n;
  } catch (err) {
    console.warn('Could not load i18n.json, using fallback English strings.', err);
    cachedI18n = {};
    return cachedI18n;
  }
}

/**
 * Fetches and caches the base English verses from `./data/verses.json`.
 * @returns {Promise<Array>}
 */
export async function loadVerses() {
  if (cachedVersesByLang.en && cachedVersesByLang.en.length > 0) {
    return cachedVersesByLang.en;
  }

  const response = await fetch('./data/verses.json?v=6', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load verses.json: HTTP ${response.status}`);
  }
  const data = await response.json();
  const versesList = Array.isArray(data) ? data : data.verses || [];
  if (!versesList.length) {
    throw new Error('Verses list is empty in verses.json');
  }
  cachedVersesByLang.en = versesList;
  return cachedVersesByLang.en;
}

/**
 * Fetches and caches the verse file for a specific language on demand.
 * Only fetches the selected language's JSON and caches it in memory.
 * @param {string} langCode
 * @param {boolean} forceReload
 * @returns {Promise<Array>}
 */
export async function loadVersesForLanguage(langCode = 'en', forceReload = false) {
  // Always ensure base English metadata (categories/groups & fallback) is loaded
  await loadVerses();

  if (langCode === 'en') {
    return cachedVersesByLang.en;
  }

  if (!forceReload && Array.isArray(cachedVersesByLang[langCode]) && cachedVersesByLang[langCode].length > 0) {
    return cachedVersesByLang[langCode];
  }

  try {
    const response = await fetch(`./data/verses.${langCode}.json?v=6`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.verses || [];
    cachedVersesByLang[langCode] = list;
    return list;
  } catch (err) {
    console.warn(`Could not load verses.${langCode}.json, falling back to English.`, err);
    cachedVersesByLang[langCode] = [];
    return [];
  }
}

/**
 * Resolves the verse for a given day of the year and language code.
 * Category and group come from the English file and are translated via i18n.
 * If a verse is missing in the chosen language, silently falls back to English.
 * @param {number} dayOfYear
 * @param {string} langCode
 * @param {Object} i18nData
 * @returns {Object}
 */
export function getVerseForDay(dayOfYear, langCode = 'en', i18nData = {}) {
  const enVerses = cachedVersesByLang.en || [];
  let baseEn = enVerses.find((v) => Number(v.day) === Number(dayOfYear));
  if (!baseEn && enVerses.length > 0) {
    const index = Math.max(0, (dayOfYear - 1) % enVerses.length);
    baseEn = enVerses[index];
  }
  if (!baseEn) {
    baseEn = getFallbackVerse(dayOfYear);
  }

  const targetDay = baseEn.day || dayOfYear;
  const rawCategory = (baseEn.category || baseEn.topic || 'Faith').trim();
  const rawGroup = (baseEn.group || '').trim();

  const langBundle = (i18nData && i18nData[langCode]) || (i18nData && i18nData.en) || {};
  const localizedCategory =
    (langBundle.categories && langBundle.categories[rawCategory]) || rawCategory;
  const localizedGroup =
    (langBundle.groups && langBundle.groups[rawGroup]) || rawGroup;

  // Attempt to find localized entry for the exact same day
  let localizedEntry = null;
  if (langCode !== 'en' && Array.isArray(cachedVersesByLang[langCode])) {
    localizedEntry = cachedVersesByLang[langCode].find(
      (v) => Number(v.day) === Number(targetDay) && v.text && String(v.text).trim().length > 0
    );
  }

  if (localizedEntry) {
    return {
      day: targetDay,
      lang: langCode,
      isFallbackEn: false,
      text: String(localizedEntry.text).trim(),
      reference: String(localizedEntry.ref || localizedEntry.reference || baseEn.ref || baseEn.reference).trim(),
      translation: String(localizedEntry.translation || langBundle.translationAbbr || '').trim(),
      translationFullName: langBundle.translationName || localizedEntry.translation || 'Scripture',
      category: localizedCategory,
      group: localizedGroup,
      creditFooter: langBundle.creditFooter || 'Scripture: Public Domain',
      creditImage: langBundle.creditImage || langBundle.creditFooter || 'Scripture: Public Domain'
    };
  }

  // Silent fallback to English KJV when missing in chosen language
  const enBundle = (i18nData && i18nData.en) || {};
  return {
    day: targetDay,
    lang: 'en',
    isFallbackEn: langCode !== 'en',
    text: String(baseEn.text || baseEn.verse || '').trim(),
    reference: String(baseEn.ref || baseEn.reference || 'John 3:16').trim(),
    translation: 'KJV',
    translationFullName: enBundle.translationName || 'King James Version',
    category: localizedCategory,
    group: localizedGroup,
    creditFooter: langBundle.creditFooter || enBundle.creditFooter || 'Scripture: King James Version, public domain',
    creditImage: langBundle.creditImage || langBundle.creditFooter || enBundle.creditImage || 'Scripture: King James Version, public domain'
  };
}

/**
 * Fallback verse in case network/file fetch encounters an issue.
 * @param {number} day
 * @returns {Object}
 */
export function getFallbackVerse(day = 1) {
  return {
    day,
    lang: 'en',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    ref: 'John 3:16',
    reference: 'John 3:16',
    translation: 'KJV',
    category: 'Love',
    group: 'Spiritual Connection & Faith'
  };
}
