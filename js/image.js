/**
 * Versey — Image Generation Module (ES Module)
 * Canvas-based generator for high-resolution shareable Scripture cards.
 * Supports Story (1080x1920), Square Post (1080x1080), and Landscape (1200x675),
 * multi-language typography (including CJK Noto Serif SC/TC & kinsoku line wrapping),
 * 20+ curated themes, custom color support, and automatic contrast text color.
 */

import { ensureCjkStylesheet } from './verse.js';

export const FORMAT_DIMENSIONS = {
  story: { width: 1080, height: 1920, name: 'Story / Status (1080×1920)', shortName: 'Story' },
  post: { width: 1080, height: 1080, name: 'Square Post (1080×1080)', shortName: 'Square' },
  landscape: { width: 1200, height: 675, name: 'Landscape (1200×675)', shortName: 'Landscape' }
};

export const SWATCH_LIST = [
  // Neutral Solids
  { id: 'white', name: 'Pure White', bgStart: '#ffffff', bgEnd: '#ffffff', type: 'solid' },
  { id: 'cream', name: 'Soft Cream', bgStart: '#faf7f2', bgEnd: '#f5efe6', type: 'solid' },
  { id: 'sand', name: 'Warm Sand', bgStart: '#ede3d5', bgEnd: '#e5d8c7', type: 'solid' },
  { id: 'soft-gray', name: 'Soft Gray', bgStart: '#eaebed', bgEnd: '#dfe1e5', type: 'solid' },
  { id: 'charcoal', name: 'Charcoal', bgStart: '#262523', bgEnd: '#1f1e1c', type: 'solid' },
  { id: 'black', name: 'True Black', bgStart: '#111112', bgEnd: '#0a0a0b', type: 'solid' },

  // Muted Pastels
  { id: 'blush', name: 'Muted Blush', bgStart: '#f5e6e4', bgEnd: '#edd8d5', type: 'pastel' },
  { id: 'lavender', name: 'Soft Lavender', bgStart: '#ece8f4', bgEnd: '#dfd9ec', type: 'pastel' },
  { id: 'sky', name: 'Pale Sky', bgStart: '#e6f0f6', bgEnd: '#d6e5ef', type: 'pastel' },
  { id: 'sage', name: 'Sage Mist', bgStart: '#e5eee6', bgEnd: '#d5e3d7', type: 'pastel' },
  { id: 'butter', name: 'Warm Butter', bgStart: '#f6f0dc', bgEnd: '#ece3c7', type: 'pastel' },

  // Earthy & Deep Tones
  { id: 'terracotta', name: 'Terracotta', bgStart: '#964b38', bgEnd: '#7f3c2b', type: 'deep' },
  { id: 'olive', name: 'Olive Grove', bgStart: '#44513e', bgEnd: '#354030', type: 'deep' },
  { id: 'espresso', name: 'Warm Espresso', bgStart: '#362720', bgEnd: '#261b16', type: 'deep' },
  { id: 'navy', name: 'Deep Navy', bgStart: '#1b2a40', bgEnd: '#121d2d', type: 'deep' },
  { id: 'burgundy', name: 'Deep Wine', bgStart: '#521f2a', bgEnd: '#3b151e', type: 'deep' },
  { id: 'forest', name: 'Midnight Pine', bgStart: '#183028', bgEnd: '#10211b', type: 'deep' },

  // Subtle Gradients
  { id: 'dawn-grad', name: 'Morning Dawn', bgStart: '#fbe6d4', bgEnd: '#f0ced9', type: 'gradient' },
  { id: 'gold-grad', name: 'Golden Hour', bgStart: '#f7ead2', bgEnd: '#dec19b', type: 'gradient' },
  { id: 'mist-grad', name: 'Fjord Mist', bgStart: '#dcecf2', bgEnd: '#bfd3e6', type: 'gradient' },
  { id: 'dusk-grad', name: 'Twilight Dusk', bgStart: '#2e3350', bgEnd: '#181b2c', type: 'gradient' }
];

export const THEMES = Object.fromEntries(SWATCH_LIST.map((s) => [s.id, s]));

// CJK punctuation rules (kinsoku shori)
const CJK_NO_START_REGEX = /^[，。、；：！？」』）”’》〉】〕］｝]/;
const CJK_NO_END_REGEX = /[「『（“‘《〈【〔［｛]$/;

/**
 * Parses a hex color string (#rgb or #rrggbb) into { r, g, b } (0-255).
 */
export function parseHexColor(hex) {
  const clean = String(hex || '#faf7f2').replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return { r: 250, g: 247, b: 242 };
}

/**
 * Calculates WCAG relative luminance for an RGB color (0.0 darkest to 1.0 brightest).
 */
export function getRelativeLuminance({ r, g, b }) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Resolves a complete, high-contrast card palette from a swatch ID or custom hex string.
 */
export function resolveCardPalette(themeIdOrCustom = 'cream') {
  let bgStart = '#faf7f2';
  let bgEnd = '#f5efe6';
  let name = 'Soft Cream';

  if (typeof themeIdOrCustom === 'string' && themeIdOrCustom.startsWith('custom:')) {
    const hex = themeIdOrCustom.replace('custom:', '').trim();
    bgStart = hex;
    bgEnd = hex;
    name = 'Custom Color';
  } else if (typeof themeIdOrCustom === 'string' && themeIdOrCustom.startsWith('#')) {
    bgStart = themeIdOrCustom;
    bgEnd = themeIdOrCustom;
    name = 'Custom Color';
  } else if (THEMES[themeIdOrCustom]) {
    bgStart = THEMES[themeIdOrCustom].bgStart;
    bgEnd = THEMES[themeIdOrCustom].bgEnd;
    name = THEMES[themeIdOrCustom].name;
  }

  const rgbStart = parseHexColor(bgStart);
  const rgbEnd = parseHexColor(bgEnd);
  const avgLum = (getRelativeLuminance(rgbStart) + getRelativeLuminance(rgbEnd)) / 2;
  const isDarkBg = avgLum < 0.36;

  if (isDarkBg) {
    return {
      name,
      bgStart,
      bgEnd,
      isDark: true,
      textColor: '#f7f4ee',
      mutedColor: 'rgba(247, 244, 238, 0.68)',
      subtleBorder: 'rgba(255, 255, 255, 0.14)',
      pillBg: 'rgba(255, 255, 255, 0.12)',
      pillText: '#f7f4ee',
      decorLine: 'rgba(255, 255, 255, 0.25)'
    };
  }

  return {
    name,
    bgStart,
    bgEnd,
    isDark: false,
    textColor: '#1f1b18',
    mutedColor: 'rgba(31, 27, 24, 0.64)',
    subtleBorder: 'rgba(31, 27, 24, 0.12)',
    pillBg: 'rgba(31, 27, 24, 0.07)',
    pillText: '#2c2520',
    decorLine: 'rgba(31, 27, 24, 0.22)'
  };
}

/**
 * Returns the serif and sans font-family strings for a given language code.
 */
export function getFontStacksForLang(langCode = 'en') {
  if (langCode === 'zh-Hans') {
    return {
      serif: '"Noto Serif SC", "Songti SC", "SimSun", serif',
      sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      primarySerifName: 'Noto Serif SC',
      primarySansName: 'Noto Sans SC',
      isCjk: true
    };
  }
  if (langCode === 'zh-Hant') {
    return {
      serif: '"Noto Serif TC", "Songti TC", "PMingLiU", serif',
      sans: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      primarySerifName: 'Noto Serif TC',
      primarySansName: 'Noto Sans TC',
      isCjk: true
    };
  }
  return {
    serif: '"Crimson Text", Garamond, "Times New Roman", serif',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    primarySerifName: 'Crimson Text',
    primarySansName: 'Inter',
    isCjk: false
  };
}

/**
 * Waits for the required language web fonts to load via `document.fonts.load(...)`
 * before drawing on the canvas so exported PNGs never use fallback fonts.
 * @param {string} langCode
 */
async function ensureFontsLoadedForLang(langCode = 'en') {
  if (langCode === 'zh-Hans' || langCode === 'zh-Hant') {
    ensureCjkStylesheet(langCode);
  }

  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function') {
    const stacks = getFontStacksForLang(langCode);
    try {
      await Promise.all([
        document.fonts.load(`400 40px "${stacks.primarySerifName}"`),
        document.fonts.load(`600 32px "${stacks.primarySerifName}"`),
        document.fonts.load(`600 20px "${stacks.primarySansName}"`)
      ]);
      if (document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch (e) {
      console.warn('Font load check completed with warnings:', e);
    }
  }
}

/**
 * Word-wraps Latin text (en, es, id) into lines that fit within maxWidth.
 */
function wrapTextByWords(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Character-wraps Chinese text (zh-Hans, zh-Hant) with kinsoku shori rules:
 * - Never start a line with closing punctuation (，。、；：！？」』）)
 * - Never end a line with opening punctuation (「『（)
 */
function wrapTextCjk(ctx, text, maxWidth) {
  const chars = Array.from(text.replace(/\s+/g, ''));
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const testLine = currentLine + ch;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine.length > 0) {
      // Rule 1: Do not start the new line with closing punctuation
      if (CJK_NO_START_REGEX.test(ch)) {
        if (currentLine.length > 1 && !CJK_NO_END_REGEX.test(currentLine.slice(0, -1))) {
          // Move the last character of currentLine to the next line along with `ch`
          const carried = currentLine.slice(-1);
          lines.push(currentLine.slice(0, -1));
          currentLine = carried + ch;
        } else {
          // Attach closing punctuation to current line and flush
          lines.push(currentLine + ch);
          currentLine = '';
        }
        continue;
      }

      // Rule 2: Do not end currentLine with opening punctuation
      if (CJK_NO_END_REGEX.test(currentLine)) {
        const openingChar = currentLine.slice(-1);
        if (currentLine.length > 1) {
          lines.push(currentLine.slice(0, -1));
          currentLine = openingChar + ch;
          continue;
        }
      }

      lines.push(currentLine);
      currentLine = ch;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Wraps text according to language rules (CJK vs word-based).
 */
export function wrapTextForLang(ctx, text, maxWidth, isCjk = false) {
  return isCjk ? wrapTextCjk(ctx, text, maxWidth) : wrapTextByWords(ctx, text, maxWidth);
}

/**
 * Draws a rounded rectangle helper.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the verse onto the target canvas in the verse's language.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} verse
 * @param {string} format 'story' | 'post' | 'landscape'
 * @param {string} themeId Swatch ID or 'custom:#hex'
 */
export async function renderVerseToCanvas(canvas, verse, format = 'post', themeId = 'cream') {
  const langCode = verse.lang || 'en';
  await ensureFontsLoadedForLang(langCode);

  const fontStacks = getFontStacksForLang(langCode);
  const isCjk = fontStacks.isCjk;
  const dimensions = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.post;
  const palette = resolveCardPalette(themeId);

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const isLandscape = format === 'landscape';
  const isStory = format === 'story';

  // 1. Draw Background (Solid or Linear Gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, w * 0.35, h);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Decorative inner frame
  const inset = isLandscape ? 32 : 44;
  ctx.strokeStyle = palette.subtleBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, inset, inset, w - inset * 2, h - inset * 2, isLandscape ? 20 : 28);
  ctx.stroke();

  // 3. Layout Bounds calculation per aspect ratio
  const topSafe = isStory ? 230 : isLandscape ? 62 : 105;
  const sidePadding = isLandscape ? 115 : 110;
  const maxContentWidth = w - sidePadding * 2;

  // 4. Draw Header: Category pill badge
  const rawCat = verse.category || 'Scripture';
  const categoryText = isCjk ? rawCat : rawCat.toUpperCase();
  const pillFontSize = isLandscape ? 18 : 22;
  ctx.font = `600 ${pillFontSize}px ${fontStacks.sans}`;
  const categoryWidth = ctx.measureText(categoryText).width;
  const pillPaddingH = isLandscape ? 22 : 28;
  const pillHeight = isLandscape ? 36 : 44;
  const pillWidth = categoryWidth + pillPaddingH * 2;
  const pillX = (w - pillWidth) / 2;
  const pillY = topSafe;

  ctx.fillStyle = palette.pillBg;
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();

  ctx.fillStyle = palette.pillText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(categoryText, w / 2, pillY + pillHeight / 2);

  // 5. Prepare Footer License Credit Lines (wrapped cleanly at the bottom of the card)
  const creditText = verse.creditImage || verse.creditFooter || 'Scripture: King James Version, public domain';
  const creditFontSize = isLandscape ? 14 : 17;
  ctx.font = `500 ${creditFontSize}px ${fontStacks.sans}`;
  const creditMaxWidth = w - inset * 2 - 60;
  const creditLines = wrapTextByWords(ctx, creditText, creditMaxWidth);
  const creditLineHeight = Math.round(creditFontSize * 1.35);
  const totalCreditHeight = creditLines.length * creditLineHeight;

  const footerBottomY = h - (isStory ? 140 : isLandscape ? 46 : 66);
  const footerStartY = footerBottomY - totalCreditHeight + creditLineHeight / 2;

  // 6. Reference & Translation Tag metrics
  const refBlockHeight = isLandscape ? 88 : 118;
  const availableTop = pillY + pillHeight + (isLandscape ? 22 : 38);
  const availableBottom = footerStartY - refBlockHeight - (isLandscape ? 20 : 34);
  const maxAvailableTextHeight = Math.max(110, availableBottom - availableTop);

  // 7. Dynamic Verse Typography: Auto-size text to fit comfortably (supports CJK line height 1.68)
  const cleanVerse = verse.text.trim();
  const fullVerseText = isCjk ? `「${cleanVerse}」` : `“${cleanVerse}”`;
  let fontSize = isStory ? (isCjk ? 56 : 60) : isLandscape ? (isCjk ? 40 : 42) : isCjk ? 48 : 52;
  const minFontSize = isLandscape ? 20 : 24;
  const lineHeightMultiplier = isCjk ? 1.68 : isLandscape ? 1.38 : 1.45;
  let lineHeight = Math.round(fontSize * lineHeightMultiplier);
  let lines = [];

  while (fontSize >= minFontSize) {
    ctx.font = `400 ${fontSize}px ${fontStacks.serif}`;
    lineHeight = Math.round(fontSize * lineHeightMultiplier);
    lines = wrapTextForLang(ctx, fullVerseText, maxContentWidth, isCjk);
    const totalTextHeight = lines.length * lineHeight;

    if (totalTextHeight <= maxAvailableTextHeight) {
      break;
    }
    fontSize -= 2;
  }

  // Center the verse + reference block inside the middle area
  const totalVerseHeight = lines.length * lineHeight;
  const totalGroupHeight = totalVerseHeight + refBlockHeight;
  const middleAreaCenterY = (pillY + pillHeight + (footerStartY - 16)) / 2;
  const groupStartY = middleAreaCenterY - totalGroupHeight / 2 + lineHeight / 2;

  // Draw Verse text lines
  ctx.fillStyle = palette.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${fontSize}px ${fontStacks.serif}`;

  lines.forEach((line, index) => {
    const lineY = groupStartY + index * lineHeight;
    ctx.fillText(line, w / 2, lineY);
  });

  // 8. Draw Reference & Translation Tag
  const lastLineY = groupStartY + (lines.length - 1) * lineHeight;
  const refDividerY = lastLineY + lineHeight * 0.62 + (isLandscape ? 8 : 14);

  // Subtle separator line
  ctx.strokeStyle = palette.decorLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 50, refDividerY);
  ctx.lineTo(w / 2 + 50, refDividerY);
  ctx.stroke();

  // Reference Text
  const refFontSize = isLandscape ? 28 : 34;
  const refY = refDividerY + (isLandscape ? 28 : 38);
  ctx.font = isCjk
    ? `600 ${refFontSize}px ${fontStacks.serif}`
    : `600 italic ${refFontSize}px ${fontStacks.serif}`;
  ctx.fillStyle = palette.textColor;
  ctx.fillText(verse.reference || 'Scripture', w / 2, refY);

  // Translation version tag
  const versionLabel = verse.translationFullName || verse.translation || 'KJV';
  const kjvFontSize = isLandscape ? 15 : 18;
  ctx.font = `600 ${kjvFontSize}px ${fontStacks.sans}`;
  ctx.fillStyle = palette.mutedColor;
  ctx.fillText(isCjk ? versionLabel : versionLabel.toUpperCase(), w / 2, refY + (isLandscape ? 26 : 34));

  // 9. Footer: License Credit Line in Selected Language
  ctx.font = `500 ${creditFontSize}px ${fontStacks.sans}`;
  ctx.fillStyle = palette.mutedColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  creditLines.forEach((cLine, idx) => {
    ctx.fillText(cLine, w / 2, footerStartY + idx * creditLineHeight);
  });

  return canvas;
}

/**
 * Generates a PNG Blob from a canvas with a verse rendered.
 */
export async function generateVerseBlob(canvas, verse, format = 'post', themeId = 'cream') {
  await renderVerseToCanvas(canvas, verse, format, themeId);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob failed'));
      }
    }, 'image/png', 0.95);
  });
}

/**
 * Generates a File object suitable for Web Share API Level 2.
 */
export async function generateVerseFile(canvas, verse, format = 'post', themeId = 'cream') {
  const blob = await generateVerseBlob(canvas, verse, format, themeId);
  return new File([blob], 'verse-of-the-day.png', { type: 'image/png' });
}
