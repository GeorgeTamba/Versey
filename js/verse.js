/**
 * Versey — Verse Module (ES Module)
 * Handles local day-of-year calculation, midnight rollover timing, and verse fetching.
 */

let cachedVerses = null;

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
 * Fetches verses from `./data/verses.json`.
 * Caches in memory once loaded.
 * @returns {Promise<Array>} Array of verse objects
 */
export function loadVerses() {
  if (cachedVerses && cachedVerses.length > 0) {
    return Promise.resolve(cachedVerses);
  }

  return fetch('./data/verses.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load verses: HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const versesList = Array.isArray(data) ? data : (data.verses || []);
      if (!versesList.length) {
        throw new Error('Verses list is empty in verses.json');
      }
      cachedVerses = versesList;
      return cachedVerses;
    });
}

/**
 * Finds the verse corresponding to a given day of year.
 * @param {Array} verses
 * @param {number} dayOfYear 1-based day number
 * @returns {Object} normalized verse object
 */
export function getVerseForDay(verses, dayOfYear) {
  if (!verses || !verses.length) {
    return getFallbackVerse(dayOfYear);
  }

  let found = verses.find((v) => Number(v.day) === Number(dayOfYear));

  if (!found) {
    const index = Math.max(0, (dayOfYear - 1) % verses.length);
    found = verses[index];
  }

  return normalizeVerse(found, dayOfYear);
}

/**
 * Standardizes verse property names.
 * @param {Object} rawVerse
 * @param {number} day
 * @returns {Object} { day, text, reference, category }
 */
export function normalizeVerse(rawVerse, day) {
  if (!rawVerse) {
    return getFallbackVerse(day);
  }

  return {
    day: rawVerse.day || day,
    text: (rawVerse.verse || rawVerse.text || '').trim(),
    reference: (rawVerse.reference || rawVerse.ref || 'Scripture').trim(),
    category: (rawVerse.category || rawVerse.topic || 'Inspiration').trim()
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
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    reference: "John 3:16",
    category: "Love"
  };
}
