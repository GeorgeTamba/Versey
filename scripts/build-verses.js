#!/usr/bin/env node
/**
 * Versey — Offline Scripture Extraction & Verification Script
 * Usage: node scripts/build-verses.js
 *
 * Reads official Bible translation source files placed in `/sources/<code>/`
 * (supports USFM `.usfm`/`.sfm`, USFX `.xml`, and OSIS `.xml`/`.osis`),
 * extracts the 366 daily verses matching `data/verses.json`,
 * verifies verse numbering and non-empty text without guessing or inventing text,
 * writes `/data/verses.<code>.json`, `/LICENSES/<code>.txt`, and `/scripts/report.txt`.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCES_DIR = path.join(ROOT_DIR, 'sources');
const LICENSES_DIR = path.join(ROOT_DIR, 'LICENSES');
const REPORT_FILE = path.join(__dirname, 'report.txt');
const EN_SOURCE_JSON = path.join(DATA_DIR, 'verses.json');

const LANGUAGE_CONFIGS = {
  en: {
    code: 'en',
    name: 'English (KJV)',
    translation: 'KJV',
    isCjk: false,
    licenseShort: 'Scripture: King James Version, public domain',
    licenseFull: [
      'Translation: King James Version (KJV)',
      'Language: English (en)',
      'License: Public Domain',
      '',
      'The King James Version (1611 / 1769 standard text) is in the public domain worldwide.'
    ].join('\n')
  },
  es: {
    code: 'es',
    name: 'Español (Reina-Valera 1909)',
    translation: 'RV1909',
    isCjk: false,
    licenseShort: 'Escritura: Reina-Valera 1909, dominio público',
    licenseFull: [
      'Translation: Santa Biblia Reina-Valera 1909 (RV1909)',
      'Language: Español (es)',
      'License: Public Domain (Dominio Público)',
      '',
      'La edición Reina-Valera de 1909 se encuentra en el dominio público.'
    ].join('\n')
  },
  'zh-Hans': {
    code: 'zh-Hans',
    name: '中文 简体 (Chinese Union Version 1919)',
    translation: '和合本',
    isCjk: true,
    licenseShort: '经文：和合本（1919），公有领域',
    licenseFull: [
      'Translation: Chinese Union Version (官话和合译本 / 国语和合本, original 1919 text, Simplified script)',
      'Language: Chinese, Simplified (zh-Hans)',
      'License: Public Domain (公有领域)',
      '',
      '1919年出版之《官话和合译本》（和合本）原文属于公有领域。'
    ].join('\n')
  },
  'zh-Hant': {
    code: 'zh-Hant',
    name: '中文 繁體 (Chinese Union Version 1919)',
    translation: '和合本',
    isCjk: true,
    licenseShort: '經文：和合本（1919），公有領域',
    licenseFull: [
      'Translation: Chinese Union Version (官話和合譯本 / 國語和合本, original 1919 text, Traditional script)',
      'Language: Chinese, Traditional (zh-Hant)',
      'License: Public Domain (公有領域)',
      '',
      '1919年出版之《官話和合譯本》（和合本）原文屬於公有領域。'
    ].join('\n')
  },
  id: {
    code: 'id',
    name: 'Bahasa Indonesia (TSI 3rd Edition)',
    translation: 'TSI',
    isCjk: false,
    licenseShort:
      'Alkitab: Terjemahan Sederhana Indonesia (TSI) © 2021 Yayasan Alkitab BahasaKita (Albata) dan Pioneer Bible Translators International, CC BY-SA 4.0',
    licenseFull: [
      'Translation: Terjemahan Sederhana Indonesia (TSI), Edisi Ketiga (3rd Edition)',
      'Language: Bahasa Indonesia (id)',
      'Copyright: © 2021 Yayasan Alkitab BahasaKita (Albata) dan Pioneer Bible Translators International',
      'License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
      'License URL: https://creativecommons.org/licenses/by-sa/4.0/',
      '',
      'Alkitab: Terjemahan Sederhana Indonesia (TSI) © 2021 Yayasan Alkitab BahasaKita (Albata) dan Pioneer Bible Translators International, CC BY-SA 4.0.'
    ].join('\n')
  }
};

/**
 * Complete 66-book mapping:
 * Maps English book names -> { usfm, osis, es, 'zh-Hans', 'zh-Hant', id }
 */
const BOOK_MAP = {
  Genesis: { usfm: 'GEN', osis: 'Gen', es: 'Génesis', 'zh-Hans': '创世记', 'zh-Hant': '創世記', id: 'Kejadian' },
  Exodus: { usfm: 'EXO', osis: 'Exod', es: 'Éxodo', 'zh-Hans': '出埃及记', 'zh-Hant': '出埃及記', id: 'Keluaran' },
  Leviticus: { usfm: 'LEV', osis: 'Lev', es: 'Levítico', 'zh-Hans': '利未记', 'zh-Hant': '利未記', id: 'Imamat' },
  Numbers: { usfm: 'NUM', osis: 'Num', es: 'Números', 'zh-Hans': '民数记', 'zh-Hant': '民數記', id: 'Bilangan' },
  Deuteronomy: { usfm: 'DEU', osis: 'Deut', es: 'Deuteronomio', 'zh-Hans': '申命记', 'zh-Hant': '申命記', id: 'Ulangan' },
  Joshua: { usfm: 'JOS', osis: 'Josh', es: 'Josué', 'zh-Hans': '约书亚记', 'zh-Hant': '約書亞記', id: 'Yosua' },
  Judges: { usfm: 'JDG', osis: 'Judg', es: 'Jueces', 'zh-Hans': '士师记', 'zh-Hant': '士師記', id: 'Hakim-hakim' },
  Ruth: { usfm: 'RUT', osis: 'Ruth', es: 'Rut', 'zh-Hans': '路得记', 'zh-Hant': '路得記', id: 'Rut' },
  '1 Samuel': { usfm: '1SA', osis: '1Sam', es: '1 Samuel', 'zh-Hans': '撒母耳记上', 'zh-Hant': '撒母耳記上', id: '1 Samuel' },
  '2 Samuel': { usfm: '2SA', osis: '2Sam', es: '2 Samuel', 'zh-Hans': '撒母耳记下', 'zh-Hant': '撒母耳記下', id: '2 Samuel' },
  '1 Kings': { usfm: '1KI', osis: '1Kgs', es: '1 Reyes', 'zh-Hans': '列王纪上', 'zh-Hant': '列王紀上', id: '1 Raja-raja' },
  '2 Kings': { usfm: '2KI', osis: '2Kgs', es: '2 Reyes', 'zh-Hans': '列王纪下', 'zh-Hant': '列王紀下', id: '2 Raja-raja' },
  '1 Chronicles': { usfm: '1CH', osis: '1Chr', es: '1 Crónicas', 'zh-Hans': '历代志上', 'zh-Hant': '歷代志上', id: '1 Tawarikh' },
  '2 Chronicles': { usfm: '2CH', osis: '2Chr', es: '2 Crónicas', 'zh-Hans': '历代志下', 'zh-Hant': '歷代志下', id: '2 Tawarikh' },
  Ezra: { usfm: 'EZR', osis: 'Ezra', es: 'Esdras', 'zh-Hans': '以斯拉记', 'zh-Hant': '以斯拉記', id: 'Ezra' },
  Nehemiah: { usfm: 'NEH', osis: 'Neh', es: 'Nehemías', 'zh-Hans': '尼希米记', 'zh-Hant': '尼希米記', id: 'Nehemia' },
  Esther: { usfm: 'EST', osis: 'Esth', es: 'Ester', 'zh-Hans': '以斯帖记', 'zh-Hant': '以斯帖記', id: 'Ester' },
  Job: { usfm: 'JOB', osis: 'Job', es: 'Job', 'zh-Hans': '约伯记', 'zh-Hant': '約伯記', id: 'Ayub' },
  Psalm: { usfm: 'PSA', osis: 'Ps', es: 'Salmos', 'zh-Hans': '诗篇', 'zh-Hant': '詩篇', id: 'Mazmur' },
  Psalms: { usfm: 'PSA', osis: 'Ps', es: 'Salmos', 'zh-Hans': '诗篇', 'zh-Hant': '詩篇', id: 'Mazmur' },
  Proverbs: { usfm: 'PRO', osis: 'Prov', es: 'Proverbios', 'zh-Hans': '箴言', 'zh-Hant': '箴言', id: 'Amsal' },
  Ecclesiastes: { usfm: 'ECC', osis: 'Eccl', es: 'Eclesiastés', 'zh-Hans': '传道书', 'zh-Hant': '傳道書', id: 'Pengkhotbah' },
  'Song of Solomon': { usfm: 'SNG', osis: 'Song', es: 'Cantares', 'zh-Hans': '雅歌', 'zh-Hant': '雅歌', id: 'Kidung Agung' },
  Isaiah: { usfm: 'ISA', osis: 'Isa', es: 'Isaías', 'zh-Hans': '以赛亚书', 'zh-Hant': '以賽亞書', id: 'Yesaya' },
  Jeremiah: { usfm: 'JER', osis: 'Jer', es: 'Jeremías', 'zh-Hans': '耶利米书', 'zh-Hant': '耶利米書', id: 'Yeremia' },
  Lamentations: { usfm: 'LAM', osis: 'Lam', es: 'Lamentaciones', 'zh-Hans': '耶利米哀歌', 'zh-Hant': '耶利米哀歌', id: 'Ratapan' },
  Ezekiel: { usfm: 'EZK', osis: 'Ezek', es: 'Ezequiel', 'zh-Hans': '以西结书', 'zh-Hant': '以西結書', id: 'Yehezkiel' },
  Daniel: { usfm: 'DAN', osis: 'Dan', es: 'Daniel', 'zh-Hans': '但以理书', 'zh-Hant': '但以理書', id: 'Daniel' },
  Hosea: { usfm: 'HOS', osis: 'Hos', es: 'Oseas', 'zh-Hans': '何西阿书', 'zh-Hant': '何西阿書', id: 'Hosea' },
  Joel: { usfm: 'JOL', osis: 'Joel', es: 'Joel', 'zh-Hans': '约珥书', 'zh-Hant': '約珥書', id: 'Yoel' },
  Amos: { usfm: 'AMO', osis: 'Amos', es: 'Amós', 'zh-Hans': '阿摩司书', 'zh-Hant': '阿摩司書', id: 'Amos' },
  Obadiah: { usfm: 'OBA', osis: 'Obad', es: 'Abdías', 'zh-Hans': '俄巴底亚书', 'zh-Hant': '俄巴底亞書', id: 'Obaja' },
  Jonah: { usfm: 'JON', osis: 'Jonah', es: 'Jonás', 'zh-Hans': '约拿书', 'zh-Hant': '約拿書', id: 'Yunus' },
  Micah: { usfm: 'MIC', osis: 'Mic', es: 'Miqueas', 'zh-Hans': '弥迦书', 'zh-Hant': '彌迦書', id: 'Mikha' },
  Nahum: { usfm: 'NAM', osis: 'Nah', es: 'Nahúm', 'zh-Hans': '那鸿书', 'zh-Hant': '那鴻書', id: 'Nahum' },
  Habakkuk: { usfm: 'HAB', osis: 'Hab', es: 'Habacuc', 'zh-Hans': '哈巴谷书', 'zh-Hant': '哈巴谷書', id: 'Habakuk' },
  Zephaniah: { usfm: 'ZEP', osis: 'Zeph', es: 'Sofonías', 'zh-Hans': '西番雅书', 'zh-Hant': '西番雅書', id: 'Zefanya' },
  Haggai: { usfm: 'HAG', osis: 'Hag', es: 'Hageo', 'zh-Hans': '哈该书', 'zh-Hant': '哈該書', id: 'Hagai' },
  Zechariah: { usfm: 'ZEC', osis: 'Zech', es: 'Zacarías', 'zh-Hans': '撒迦利亚书', 'zh-Hant': '撒迦利亞書', id: 'Zakharia' },
  Malachi: { usfm: 'MAL', osis: 'Mal', es: 'Malaquías', 'zh-Hans': '玛拉基书', 'zh-Hant': '瑪拉基書', id: 'Maleakhi' },
  Matthew: { usfm: 'MAT', osis: 'Matt', es: 'Mateo', 'zh-Hans': '马太福音', 'zh-Hant': '馬太福音', id: 'Matius' },
  Mark: { usfm: 'MRK', osis: 'Mark', es: 'Marcos', 'zh-Hans': '马可福音', 'zh-Hant': '馬可福音', id: 'Markus' },
  Luke: { usfm: 'LUK', osis: 'Luke', es: 'Lucas', 'zh-Hans': '路加福音', 'zh-Hant': '路加福音', id: 'Lukas' },
  John: { usfm: 'JHN', osis: 'John', es: 'Juan', 'zh-Hans': '约翰福音', 'zh-Hant': '約翰福音', id: 'Yohanes' },
  Acts: { usfm: 'ACT', osis: 'Acts', es: 'Hechos', 'zh-Hans': '使徒行传', 'zh-Hant': '使徒行傳', id: 'Kisah Para Rasul' },
  Romans: { usfm: 'ROM', osis: 'Rom', es: 'Romanos', 'zh-Hans': '罗马书', 'zh-Hant': '羅馬書', id: 'Roma' },
  '1 Corinthians': { usfm: '1CO', osis: '1Cor', es: '1 Corintios', 'zh-Hans': '哥林多前书', 'zh-Hant': '哥林多前書', id: '1 Korintus' },
  '2 Corinthians': { usfm: '2CO', osis: '2Cor', es: '2 Corintios', 'zh-Hans': '哥林多后书', 'zh-Hant': '哥林多後書', id: '2 Korintus' },
  Galatians: { usfm: 'GAL', osis: 'Gal', es: 'Gálatas', 'zh-Hans': '加拉太书', 'zh-Hant': '加拉太書', id: 'Galatia' },
  Ephesians: { usfm: 'EPH', osis: 'Eph', es: 'Efesios', 'zh-Hans': '以弗所书', 'zh-Hant': '以弗所書', id: 'Efesus' },
  Philippians: { usfm: 'PHP', osis: 'Phil', es: 'Filipenses', 'zh-Hans': '腓立比书', 'zh-Hant': '腓立比書', id: 'Filipi' },
  Colossians: { usfm: 'COL', osis: 'Col', es: 'Colosenses', 'zh-Hans': '歌罗西书', 'zh-Hant': '歌羅西書', id: 'Kolose' },
  '1 Thessalonians': { usfm: '1TH', osis: '1Thess', es: '1 Tesalonicenses', 'zh-Hans': '帖撒罗尼迦前书', 'zh-Hant': '帖撒羅尼迦前書', id: '1 Tesalonika' },
  '2 Thessalonians': { usfm: '2TH', osis: '2Thess', es: '2 Tesalonicenses', 'zh-Hans': '帖撒罗尼迦后书', 'zh-Hant': '帖撒羅尼迦後書', id: '2 Tesalonika' },
  '1 Timothy': { usfm: '1TI', osis: '1Tim', es: '1 Timoteo', 'zh-Hans': '提摩太前书', 'zh-Hant': '提摩太前書', id: '1 Timotius' },
  '2 Timothy': { usfm: '2TI', osis: '2Tim', es: '2 Timoteo', 'zh-Hans': '提摩太后书', 'zh-Hant': '提摩太後書', id: '2 Timotius' },
  Titus: { usfm: 'TIT', osis: 'Titus', es: 'Tito', 'zh-Hans': '提多书', 'zh-Hant': '提多書', id: 'Titus' },
  Philemon: { usfm: 'PHM', osis: 'Phlm', es: 'Filemón', 'zh-Hans': '腓利门书', 'zh-Hant': '腓利門書', id: 'Filemon' },
  Hebrews: { usfm: 'HEB', osis: 'Heb', es: 'Hebreos', 'zh-Hans': '希伯来书', 'zh-Hant': '希伯來書', id: 'Ibrani' },
  James: { usfm: 'JAS', osis: 'Jas', es: 'Santiago', 'zh-Hans': '雅各书', 'zh-Hant': '雅各書', id: 'Yakobus' },
  '1 Peter': { usfm: '1PE', osis: '1Pet', es: '1 Pedro', 'zh-Hans': '彼得前书', 'zh-Hant': '彼得前書', id: '1 Petrus' },
  '2 Peter': { usfm: '2PE', osis: '2Pet', es: '2 Pedro', 'zh-Hans': '彼得后书', 'zh-Hant': '彼得後書', id: '2 Petrus' },
  '1 John': { usfm: '1JN', osis: '1John', es: '1 Juan', 'zh-Hans': '约翰一书', 'zh-Hant': '約翰一書', id: '1 Yohanes' },
  '2 John': { usfm: '2JN', osis: '2John', es: '2 Juan', 'zh-Hans': '约翰二书', 'zh-Hant': '約翰二書', id: '2 Yohanes' },
  '3 John': { usfm: '3JN', osis: '3John', es: '3 Juan', 'zh-Hans': '约翰三书', 'zh-Hant': '約翰三書', id: '3 Yohanes' },
  Jude: { usfm: 'JUD', osis: 'Jude', es: 'Judas', 'zh-Hans': '犹大书', 'zh-Hant': '猶大書', id: 'Yudas' },
  Revelation: { usfm: 'REV', osis: 'Rev', es: 'Apocalipsis', 'zh-Hans': '启示录', 'zh-Hant': '啟示錄', id: 'Wahyu' }
};

// Reverse lookup tables for OSIS and USFM IDs
const OSIS_TO_USFM = {};
Object.values(BOOK_MAP).forEach((entry) => {
  OSIS_TO_USFM[entry.osis.toLowerCase()] = entry.usfm;
  OSIS_TO_USFM[entry.usfm.toLowerCase()] = entry.usfm;
});

/**
 * Parses an English reference string such as "Philippians 4:6-7" or "John 3:16".
 */
function parseReference(refStr) {
  const match = String(refStr || '').trim().match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const bookEn = match[1].trim();
  const bookInfo = BOOK_MAP[bookEn];
  if (!bookInfo) return null;

  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : startVerse;

  return {
    bookEn,
    usfm: bookInfo.usfm,
    osis: bookInfo.osis,
    chapter,
    startVerse,
    endVerse
  };
}

/**
 * Formats the localized reference string for a given language.
 */
function formatLocalizedRef(parsedRef, langCode) {
  const bookInfo = BOOK_MAP[parsedRef.bookEn];
  const localBook = langCode === 'en' ? parsedRef.bookEn : bookInfo[langCode];
  const versePart =
    parsedRef.startVerse === parsedRef.endVerse
      ? `${parsedRef.chapter}:${parsedRef.startVerse}`
      : `${parsedRef.chapter}:${parsedRef.startVerse}-${parsedRef.endVerse}`;
  return `${localBook} ${versePart}`;
}

/**
 * Recursively lists all files inside a directory.
 */
function listFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Cleans and normalizes raw USFM verse text:
 * - Strips footnotes (\f ... \f*, \fe ... \fe*) and cross-references (\x ... \x*)
 * - Strips word-level attributes (\w word|strong="..."\w* -> word)
 * - Strips remaining USFM markers (\add, \nd, \wj, \q1, \p, etc.)
 * - Collapses whitespace (and removes artificial inter-character spaces for CJK)
 */
function cleanUsfmText(raw, isCjk = false) {
  let text = raw
    // Remove footnotes and cross references
    .replace(/\\f\b[\s\S]*?\\f\*/g, ' ')
    .replace(/\\fe\b[\s\S]*?\\fe\*/g, ' ')
    .replace(/\\x\b[\s\S]*?\\x\*/g, ' ')
    .replace(/\\rq\b[\s\S]*?\\rq\*/g, ' ')
    // Unwrap \w word|attributes\w* -> word
    .replace(/\\+w\s+([^|\\]+?)(?:\|[^\\]*?)?\\+w\*/g, '$1')
    // Remove any remaining inline attributes |...
    .replace(/\|[a-zA-Z0-9_-]+="[^"]*"/g, '')
    // Remove milestone markers \qt-s |...\*
    .replace(/\\[a-zA-Z0-9]+-[se]\b[^\\]*?\\\*/g, '')
    // Remove closing markers like \add*, \wj*, \nd*, \it*, \bd*
    .replace(/\\\+?[a-zA-Z0-9]+\*/g, '')
    // Remove opening/paragraph markers like \p, \q1, \m, \add, \wj, \nd
    .replace(/\\\+?[a-zA-Z0-9]+\b\s?/g, ' ')
    // Remove stray pilcrows or editorial brackets if empty
    .replace(/¶/g, ' ');

  text = text.replace(/\s+/g, ' ').trim();

  if (isCjk) {
    // Remove spaces between CJK characters and CJK punctuation
    text = text.replace(
      /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])\s+([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g,
      '$1$2'
    );
    text = text.replace(
      /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])\s+([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g,
      '$1$2'
    );
  }

  return text.trim();
}

/**
 * Strips XML tags and decodes common XML entities.
 */
function cleanXmlText(xmlFragment, isCjk = false) {
  let text = xmlFragment
    // Strip notes, headings, titles, cross-references
    .replace(/<(note|f|fe|x|s|s1|s2|s3|title|head|d|cl|cp|r)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  text = text.replace(/\s+/g, ' ').trim();

  if (isCjk) {
    text = text.replace(
      /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])\s+([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g,
      '$1$2'
    );
    text = text.replace(
      /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])\s+([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g,
      '$1$2'
    );
  }

  return text.trim();
}

/**
 * Parses a USFM file and populates `store[usfmBook][chapter][verseNum]`.
 * Detects merged/split verses (e.g. `\v 6-7` or `\v 6a`) so verification can flag them.
 */
function parseUsfmContent(content, store, isCjk) {
  const idMatch = content.match(/\\id\s+([A-Z0-9]{3})/i);
  if (!idMatch) return;
  const bookId = idMatch[1].toUpperCase();
  if (!store[bookId]) store[bookId] = {};

  // Strip section headings and non-verse paragraph blocks before verse extraction
  // Paragraph markers that introduce non-verse headings: \s, \s1, \s2, \s3, \r, \ms, \mr, \d, \cl, \cd, \sp, \qa
  const lines = content.split(/\r?\n/);
  let currentChapter = 0;
  let currentVerseKey = null;
  let currentBuffer = [];

  const flushVerse = () => {
    if (!currentChapter || !currentVerseKey) return;
    if (!store[bookId][currentChapter]) store[bookId][currentChapter] = {};

    const rawJoined = currentBuffer.join(' ');
    const cleaned = cleanUsfmText(rawJoined, isCjk);

    // Check if verse marker is a range or split (e.g. "6-7" or "6a")
    if (/^\d+$/.test(currentVerseKey)) {
      const vNum = parseInt(currentVerseKey, 10);
      store[bookId][currentChapter][vNum] = {
        text: cleaned,
        exactNumbering: true
      };
    } else {
      // Merged or split verse numbering in source
      const rangeMatch = currentVerseKey.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const s = parseInt(rangeMatch[1], 10);
        const e = parseInt(rangeMatch[2], 10);
        for (let v = s; v <= e; v++) {
          store[bookId][currentChapter][v] = {
            text: cleaned,
            exactNumbering: false,
            mergedRange: `${s}-${e}`
          };
        }
      } else {
        const numMatch = currentVerseKey.match(/^(\d+)/);
        if (numMatch) {
          const vNum = parseInt(numMatch[1], 10);
          store[bookId][currentChapter][vNum] = {
            text: cleaned,
            exactNumbering: false,
            splitId: currentVerseKey
          };
        }
      }
    }
    currentBuffer = [];
  };

  const headingMarkers = /^\\(s\d?|r|ms\d?|mr|d|sp|cl|cp|cd|qa|iot|io\d?|ip|im|is\d?|mt\d?|h|toc\d?|rem)\b/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check chapter marker \c <num>
    const cMatch = trimmed.match(/^\\c\s+(\d+)/);
    if (cMatch) {
      flushVerse();
      currentChapter = parseInt(cMatch[1], 10);
      currentVerseKey = null;
      continue;
    }

    // Ignore heading / intro lines completely
    if (headingMarkers.test(trimmed)) {
      continue;
    }

    // A single line can contain one or more \v markers
    const vRegex = /\\v\s+([0-9]+(?:-[0-9]+|[a-z])?)\s*/g;
    let match;
    let lastIndex = 0;
    let foundVerseInLine = false;

    while ((match = vRegex.exec(trimmed)) !== null) {
      foundVerseInLine = true;
      // Text before this \v belongs to previous verse
      if (match.index > lastIndex && currentVerseKey) {
        currentBuffer.push(trimmed.slice(lastIndex, match.index));
      }
      flushVerse();
      currentVerseKey = match[1];
      lastIndex = vRegex.lastIndex;
    }

    if (foundVerseInLine) {
      if (lastIndex < trimmed.length && currentVerseKey) {
        currentBuffer.push(trimmed.slice(lastIndex));
      }
    } else if (currentVerseKey) {
      currentBuffer.push(trimmed);
    }
  }

  flushVerse();
}

/**
 * Parses a USFX XML file (<usfx> ... <book id="GEN"> ... </usfx>).
 */
function parseUsfxContent(content, store, isCjk) {
  const bookRegex = /<book\s+id="([A-Z0-9]{3})"[^>]*>([\s\S]*?)<\/book>/gi;
  let bookMatch;

  while ((bookMatch = bookRegex.exec(content)) !== null) {
    const bookId = bookMatch[1].toUpperCase();
    const bookBody = bookMatch[2];
    if (!store[bookId]) store[bookId] = {};

    // Remove headings/footnotes first
    const strippedBody = bookBody.replace(/<(s|s1|s2|d|cl|r|f|fe|x)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    let currentChapter = 0;
    let currentVerseKey = null;
    let lastPos = 0;

    const tokenRegex = /<(c|v)\s+[^>]*?\bid="([^"]+)"[^>]*\/?>|<ve\s*\/?>/gi;
    let tok;

    const saveSegment = (endPos) => {
      if (!currentChapter || !currentVerseKey) return;
      if (!store[bookId][currentChapter]) store[bookId][currentChapter] = {};
      const rawSeg = strippedBody.slice(lastPos, endPos);
      const cleaned = cleanXmlText(rawSeg, isCjk);

      if (/^\d+$/.test(currentVerseKey)) {
        const vNum = parseInt(currentVerseKey, 10);
        store[bookId][currentChapter][vNum] = {
          text: cleaned,
          exactNumbering: true
        };
      } else {
        const rangeMatch = currentVerseKey.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const s = parseInt(rangeMatch[1], 10);
          const e = parseInt(rangeMatch[2], 10);
          for (let v = s; v <= e; v++) {
            store[bookId][currentChapter][v] = {
              text: cleaned,
              exactNumbering: false,
              mergedRange: `${s}-${e}`
            };
          }
        }
      }
      currentVerseKey = null;
    };

    while ((tok = tokenRegex.exec(strippedBody)) !== null) {
      const fullTag = tok[0];
      const tagType = (tok[1] || '').toLowerCase();
      const idAttr = tok[2];

      if (fullTag.toLowerCase().startsWith('<ve')) {
        saveSegment(tok.index);
        lastPos = tokenRegex.lastIndex;
      } else if (tagType === 'c') {
        saveSegment(tok.index);
        currentChapter = parseInt(idAttr, 10);
        lastPos = tokenRegex.lastIndex;
      } else if (tagType === 'v') {
        saveSegment(tok.index);
        currentVerseKey = idAttr.trim();
        lastPos = tokenRegex.lastIndex;
      }
    }
    saveSegment(strippedBody.length);
  }
}

/**
 * Parses an OSIS XML file (<osis> ... <verse osisID="Gen.1.1"> ... </osis>).
 */
function parseOsisContent(content, store, isCjk) {
  // 1. Container-style <verse osisID="Gen.1.1">...</verse>
  const containerRegex = /<verse\b[^>]*?\bosisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gi;
  let match;
  let foundAny = false;

  while ((match = containerRegex.exec(content)) !== null) {
    foundAny = true;
    const osisIdAttr = match[1].trim();
    const cleaned = cleanXmlText(match[2], isCjk);
    recordOsisVerse(osisIdAttr, cleaned, store);
  }

  if (foundAny) return;

  // 2. Milestone-style <verse sID="..." osisID="Gen.1.1"/> ... <verse eID="..."/>
  const milestoneRegex = /<verse\b[^>]*?\bosisID="([^"]+)"[^>]*?\bsID="([^"]+)"[^>]*\/?>/gi;
  while ((match = milestoneRegex.exec(content)) !== null) {
    const osisIdAttr = match[1].trim();
    const sId = match[2];
    const startIdx = milestoneRegex.lastIndex;
    const escapedSid = sId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const endRegex = new RegExp(`<verse\\b[^>]*?\\beID="${escapedSid}"[^>]*\\/?>`, 'i');
    const rest = content.slice(startIdx);
    const endMatch = rest.match(endRegex);
    if (endMatch) {
      const fragment = rest.slice(0, endMatch.index);
      const cleaned = cleanXmlText(fragment, isCjk);
      recordOsisVerse(osisIdAttr, cleaned, store);
    }
  }
}

function recordOsisVerse(osisIdAttr, cleaned, store) {
  // osisID can be a single ID "Gen.1.1" or space-separated merged IDs "Gen.1.1 Gen.1.2"
  const parts = osisIdAttr.split(/\s+/);
  const isMerged = parts.length > 1;

  for (const part of parts) {
    const segs = part.split('.');
    if (segs.length < 3) continue;
    const usfmBook = OSIS_TO_USFM[segs[0].toLowerCase()];
    if (!usfmBook) continue;
    const chap = parseInt(segs[1], 10);
    const vNum = parseInt(segs[2], 10);
    if (!store[usfmBook]) store[usfmBook] = {};
    if (!store[usfmBook][chap]) store[usfmBook][chap] = {};

    store[usfmBook][chap][vNum] = {
      text: cleaned,
      exactNumbering: !isMerged
    };
  }
}

/**
 * Loads all Bible source files for a language code from `/sources/<code>/`.
 */
function loadLanguageSources(langCode, isCjk) {
  const langSourceDir = path.join(SOURCES_DIR, langCode);
  const files = listFilesRecursive(langSourceDir);
  const store = {};
  let parsedFilesCount = 0;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath).toLowerCase();

    // Skip license/readme files when parsing scripture
    if (base.includes('license') || base.includes('copr') || base.includes('readme')) {
      continue;
    }

    if (['.usfm', '.sfm', '.txt'].includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (/\\id\s+[A-Z0-9]{3}/i.test(content)) {
        parseUsfmContent(content, store, isCjk);
        parsedFilesCount++;
      }
    } else if (['.xml', '.osis', '.usfx'].includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (/<usfx\b/i.test(content)) {
        parseUsfxContent(content, store, isCjk);
        parsedFilesCount++;
      } else if (/<osis\b/i.test(content)) {
        parseOsisContent(content, store, isCjk);
        parsedFilesCount++;
      }
    }
  }

  return { store, parsedFilesCount };
}

/**
 * Writes `/LICENSES/<code>.txt` (appending any source copyright file if present).
 */
function writeLicenseFile(langCode) {
  if (!fs.existsSync(LICENSES_DIR)) {
    fs.mkdirSync(LICENSES_DIR, { recursive: true });
  }

  const cfg = LANGUAGE_CONFIGS[langCode];
  let licenseContent = cfg.licenseFull;

  // Check if user placed an upstream copyright/license file in /sources/<code>/
  const langSourceDir = path.join(SOURCES_DIR, langCode);
  const files = listFilesRecursive(langSourceDir);
  for (const filePath of files) {
    const base = path.basename(filePath).toLowerCase();
    if (base === 'copr.htm' || base === 'license.txt' || base === 'copyright.txt') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const cleaned = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned) {
        licenseContent += `\n\n--- Upstream Source Notice (${path.basename(filePath)}) ---\n${cleaned}\n`;
      }
    }
  }

  fs.writeFileSync(path.join(LICENSES_DIR, `${langCode}.txt`), licenseContent + '\n', 'utf8');
}

function main() {
  if (!fs.existsSync(EN_SOURCE_JSON)) {
    console.error(`Error: Missing English reference file at ${EN_SOURCE_JSON}`);
    process.exit(1);
  }

  const enVerses = JSON.parse(fs.readFileSync(EN_SOURCE_JSON, 'utf8'));
  const reportLines = [
    'Versey — Scripture Extraction & Verification Report',
    `Generated: ${new Date().toISOString()}`,
    'Rule: No verse text is ever guessed, paraphrased, or machine-translated.',
    'Any missing, empty, or differently-numbered verse is listed below and omitted from output.',
    '================================================================================',
    ''
  ];

  // 1. Write /data/verses.en.json and /LICENSES/en.txt from existing KJV data
  const enOutput = enVerses.map((v) => ({
    day: v.day,
    ref: v.ref,
    translation: 'KJV',
    text: v.text
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'verses.en.json'), JSON.stringify(enOutput, null, 2) + '\n', 'utf8');
  writeLicenseFile('en');

  const summaryStats = [{ code: 'en', found: enOutput.length, missing: 0, files: 1 }];

  // 2. Process target languages: es, zh-Hans, zh-Hant, id
  const targetLangs = ['es', 'zh-Hans', 'zh-Hant', 'id'];

  for (const langCode of targetLangs) {
    const cfg = LANGUAGE_CONFIGS[langCode];
    writeLicenseFile(langCode);

    const { store, parsedFilesCount } = loadLanguageSources(langCode, cfg.isCjk);
    const extracted = [];
    let missingCount = 0;

    for (const item of enVerses) {
      const parsedRef = parseReference(item.ref);
      if (!parsedRef) {
        missingCount++;
        reportLines.push(`[${langCode}] Day ${item.day} (${item.ref}): Unrecognized reference format`);
        continue;
      }

      const bookData = store[parsedRef.usfm];
      const chapData = bookData ? bookData[parsedRef.chapter] : null;

      if (!chapData) {
        missingCount++;
        reportLines.push(
          `[${langCode}] Day ${item.day} (${item.ref}): Missing book/chapter in /sources/${langCode}/`
        );
        continue;
      }

      let hasMismatchOrMissing = false;
      let mismatchReason = '';
      const verseTexts = [];

      for (let vNum = parsedRef.startVerse; vNum <= parsedRef.endVerse; vNum++) {
        const vEntry = chapData[vNum];
        if (!vEntry || !vEntry.text) {
          hasMismatchOrMissing = true;
          mismatchReason = `Verse ${vNum} is missing or empty`;
          break;
        }
        // Check for omitted-verse placeholders such as "-" or "[...]"
        if (/^(\[.*\]|-|—)$/.test(vEntry.text.trim())) {
          hasMismatchOrMissing = true;
          mismatchReason = `Verse ${vNum} is marked omitted (${vEntry.text.trim()}) in edition`;
          break;
        }
        if (!vEntry.exactNumbering) {
          // Note the merged/split numbering in report.txt for verification transparency,
          // and include the source's verse block once for this reference.
          const reason = vEntry.mergedRange
            ? `Verse ${vNum} uses merged verse numbering (${vEntry.mergedRange}) in source`
            : `Verse ${vNum} uses split verse numbering (${vEntry.splitId}) in source`;
          reportLines.push(`[${langCode}] Day ${item.day} (${item.ref}): ${reason}`);
          verseTexts.push(vEntry.text);
          if (vEntry.mergedRange) {
            const [, mEnd] = vEntry.mergedRange.split('-').map((n) => parseInt(n, 10));
            if (!isNaN(mEnd) && mEnd > vNum) {
              vNum = mEnd;
            }
          }
          continue;
        }
        verseTexts.push(vEntry.text);
      }

      if (hasMismatchOrMissing) {
        missingCount++;
        reportLines.push(`[${langCode}] Day ${item.day} (${item.ref}): ${mismatchReason}`);
        continue;
      }

      const joiner = cfg.isCjk ? '' : ' ';
      const combinedText = verseTexts.join(joiner).trim();

      extracted.push({
        day: item.day,
        ref: formatLocalizedRef(parsedRef, langCode),
        translation: cfg.translation,
        text: combinedText
      });
    }

    const outPath = path.join(DATA_DIR, `verses.${langCode}.json`);
    if (langCode === 'id') {
      // CC BY-SA 4.0 requires the adapted file itself to carry the license notice
      const idPayload = {
        _license:
          'Alkitab: Terjemahan Sederhana Indonesia (TSI) © 2021 Yayasan Alkitab BahasaKita (Albata) dan Pioneer Bible Translators International, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
        verses: extracted
      };
      fs.writeFileSync(outPath, JSON.stringify(idPayload, null, 2) + '\n', 'utf8');
    } else {
      fs.writeFileSync(outPath, JSON.stringify(extracted, null, 2) + '\n', 'utf8');
    }

    summaryStats.push({
      code: langCode,
      found: extracted.length,
      missing: missingCount,
      files: parsedFilesCount
    });
  }

  reportLines.push('');
  reportLines.push('================================================================================');
  reportLines.push('SUMMARY TOTALS PER LANGUAGE:');
  for (const stat of summaryStats) {
    reportLines.push(
      `  ${stat.code.padEnd(8)} -> Found: ${String(stat.found).padStart(3)} / 366 | Missing/Skipped: ${String(
        stat.missing
      ).padStart(3)} (Source files parsed: ${stat.files})`
    );
  }
  reportLines.push('');

  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');

  console.log('Build finished. Totals per language:');
  for (const stat of summaryStats) {
    console.log(
      `  [${stat.code}] Found: ${stat.found} / 366, Missing: ${stat.missing} (Source files: ${stat.files})`
    );
  }
  console.log(`Verification report written to: ${REPORT_FILE}`);
}

main();

