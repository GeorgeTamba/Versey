/**
 * Versey — Image Generation Module (ES Module)
 * Canvas-based generator for high-resolution shareable Scripture cards.
 * Supports Story (1080x1920), Square Post (1080x1080), and Landscape (1200x675)
 * with 20+ curated themes, custom color support, and automatic contrast text color.
 */

export const FORMAT_DIMENSIONS = {
  story: { width: 1080, height: 1920, name: 'Story / Status (1080×1920)', shortName: 'Story' },
  post: { width: 1080, height: 1080, name: 'Square Post (1080×1080)', shortName: 'Square' },
  landscape: { width: 1200, height: 675, name: 'Landscape (1200×675)', shortName: 'Landscape' }
};

/**
 * 20 Curated Swatches:
 * - Neutral solids (white, soft cream, warm sand, soft gray, charcoal, black)
 * - Muted pastels (blush, lavender, sky, sage, buttercream)
 * - Earthy & deep tones (terracotta, olive, navy, burgundy, forest, espresso)
 * - Subtle gradients (dawn, golden hour, ocean mist, twilight)
 */
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

/**
 * Parses a hex color string (#rgb or #rrggbb) into { r, g, b } (0-255).
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
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
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number}
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
 * Automatically picks dark or light text colors based on background luminance.
 * @param {string} themeIdOrCustom e.g. 'cream' or 'custom:#335577' or '#335577'
 * @returns {Object} Complete color palette for canvas rendering
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

  // Threshold ~0.36 ensures crisp dark text on light/pastel backgrounds and crisp light text on dark/deep backgrounds
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
 * Ensures web fonts are ready before rendering on Canvas.
 */
async function ensureFontsLoaded() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check completed with warnings', e);
    }
  }
}

/**
 * Word wraps text into lines that fit within a maximum width.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
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
 * Renders the verse onto the target canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} verse { text, reference, category }
 * @param {string} format 'story' | 'post' | 'landscape'
 * @param {string} themeId Swatch ID or 'custom:#hex'
 */
export async function renderVerseToCanvas(canvas, verse, format = 'post', themeId = 'cream') {
  await ensureFontsLoaded();

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
  const topSafe = isStory ? 240 : isLandscape ? 66 : 110;
  const bottomSafe = isStory ? 220 : isLandscape ? 64 : 100;
  const sidePadding = isLandscape ? 120 : 115;
  const maxContentWidth = w - sidePadding * 2;

  // 4. Draw Header: Category pill badge
  const categoryText = (verse.category || 'SCRIPTURE').toUpperCase();
  const pillFontSize = isLandscape ? 18 : 22;
  ctx.font = `600 ${pillFontSize}px "Inter", sans-serif`;
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

  // 5. Footer & Reference reserved metrics
  const footerY = h - (isStory ? 160 : isLandscape ? 48 : 68);
  const refBlockHeight = isLandscape ? 92 : 125;
  const availableTop = pillY + pillHeight + (isLandscape ? 24 : 40);
  const availableBottom = footerY - refBlockHeight - (isLandscape ? 20 : 35);
  const maxAvailableTextHeight = Math.max(120, availableBottom - availableTop);

  // 6. Dynamic Verse Typography: Auto-size text to fit comfortably
  const fullVerseText = `“${verse.text.trim()}”`;
  let fontSize = isStory ? 62 : isLandscape ? 44 : 54;
  const minFontSize = isLandscape ? 22 : 28;
  let lineHeight = Math.round(fontSize * 1.44);
  let lines = [];

  while (fontSize >= minFontSize) {
    ctx.font = `400 ${fontSize}px "Crimson Text", Garamond, serif`;
    lineHeight = Math.round(fontSize * (isLandscape ? 1.38 : 1.45));
    lines = wrapText(ctx, fullVerseText, maxContentWidth);
    const totalTextHeight = lines.length * lineHeight;

    if (totalTextHeight <= maxAvailableTextHeight) {
      break;
    }
    fontSize -= 2;
  }

  // Center the verse + reference block inside the middle area
  const totalVerseHeight = lines.length * lineHeight;
  const totalGroupHeight = totalVerseHeight + refBlockHeight;
  const middleAreaCenterY = (pillY + pillHeight + footerY) / 2;
  const groupStartY = middleAreaCenterY - totalGroupHeight / 2 + lineHeight / 2;

  // Draw Verse text lines
  ctx.fillStyle = palette.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${fontSize}px "Crimson Text", Garamond, serif`;

  lines.forEach((line, index) => {
    const lineY = groupStartY + index * lineHeight;
    ctx.fillText(line, w / 2, lineY);
  });

  // 7. Draw Reference & KJV Tag
  const lastLineY = groupStartY + (lines.length - 1) * lineHeight;
  const refDividerY = lastLineY + lineHeight * 0.65 + (isLandscape ? 8 : 14);

  // Subtle separator line
  ctx.strokeStyle = palette.decorLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 50, refDividerY);
  ctx.lineTo(w / 2 + 50, refDividerY);
  ctx.stroke();

  // Reference Text
  const refFontSize = isLandscape ? 30 : 36;
  const refY = refDividerY + (isLandscape ? 30 : 40);
  ctx.font = `600 italic ${refFontSize}px "Crimson Text", Garamond, serif`;
  ctx.fillStyle = palette.textColor;
  ctx.fillText(verse.reference || 'Scripture', w / 2, refY);

  // Version tag
  const kjvFontSize = isLandscape ? 15 : 19;
  ctx.font = `600 ${kjvFontSize}px "Inter", sans-serif`;
  ctx.fillStyle = palette.mutedColor;
  ctx.fillText('KING JAMES VERSION', w / 2, refY + (isLandscape ? 28 : 36));

  // 8. Footer: Brand stamp "Versey"
  ctx.font = `600 ${isLandscape ? 17 : 20}px "Inter", sans-serif`;
  ctx.fillStyle = palette.mutedColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Versey • verse of the day', w / 2, footerY);

  return canvas;
}

/**
 * Generates a PNG Blob from a canvas with a verse rendered.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} verse
 * @param {string} format
 * @param {string} themeId
 * @returns {Promise<Blob>}
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
 * @param {HTMLCanvasElement} canvas
 * @param {Object} verse
 * @param {string} format
 * @param {string} themeId
 * @returns {Promise<File>}
 */
export async function generateVerseFile(canvas, verse, format = 'post', themeId = 'cream') {
  const blob = await generateVerseBlob(canvas, verse, format, themeId);
  return new File([blob], 'verse-of-the-day.png', { type: 'image/png' });
}
