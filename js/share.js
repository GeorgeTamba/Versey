/**
 * Versey — Share Module (ES Module)
 * Handles Web Share API Level 2 with files, direct social links,
 * localized clipboard copy, and file downloads.
 */

export const SITE_URL = 'https://versey.pages.dev';

/**
 * Formats the localized verse, reference, translation abbreviation, and site link for copying.
 * @param {Object} verse
 * @returns {string}
 */
export function formatVerseCopyText(verse) {
  const text = verse.text ? verse.text.trim() : '';
  const ref = verse.reference ? verse.reference.trim() : '';
  const abbr = verse.translation ? verse.translation.trim() : 'KJV';
  const isCjk = verse.lang === 'zh-Hans' || verse.lang === 'zh-Hant';
  const quoted = isCjk ? `「${text}」` : `“${text}”`;
  return `${quoted} — ${ref} (${abbr})\n${SITE_URL}`;
}

/**
 * Formats a clean, readable share text string in the selected language.
 * @param {Object} verse
 * @returns {string}
 */
export function formatVerseShareText(verse) {
  const text = verse.text ? verse.text.trim() : '';
  const ref = verse.reference ? verse.reference.trim() : '';
  const abbr = verse.translation ? verse.translation.trim() : 'KJV';
  const isCjk = verse.lang === 'zh-Hans' || verse.lang === 'zh-Hant';
  const quoted = isCjk ? `「${text}」` : `“${text}”`;
  return `${quoted}\n\n— ${ref} (${abbr})\n\n${SITE_URL}`;
}

/**
 * Checks if native sharing is available in the current environment.
 * @returns {boolean}
 */
export function isWebShareSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Checks if sharing files (Web Share API Level 2) is supported for the given file list.
 * @param {File[]} files
 * @returns {boolean}
 */
export function canShareFiles(files) {
  if (!isWebShareSupported() || !navigator.canShare) {
    return false;
  }
  try {
    return navigator.canShare({ files });
  } catch (err) {
    return false;
  }
}

/**
 * Attempts native Web Share API with optional file attachment.
 * Falls back to resolving false if user cancelled or not supported.
 * @param {Object} shareData { title, text, url, files }
 * @returns {Promise<{ success: boolean, cancelled?: boolean, error?: any }>}
 */
export async function shareNative(shareData) {
  if (!isWebShareSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    if (shareData.files && shareData.files.length) {
      if (navigator.canShare && navigator.canShare({ files: shareData.files })) {
        await navigator.share(shareData);
        return { success: true };
      }
      const { files, ...textOnlyData } = shareData;
      await navigator.share(textOnlyData);
      return { success: true };
    }

    await navigator.share(shareData);
    return { success: true };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, cancelled: true };
    }
    return { success: false, error: err };
  }
}

/**
 * Builds direct platform intent URLs for the fallback menu in the selected language.
 * @param {Object} verse
 * @param {string} siteUrl
 * @returns {Object}
 */
export function buildSocialShareUrls(verse, siteUrl = SITE_URL) {
  const fullShareText = formatVerseShareText(verse);
  const encodedText = encodeURIComponent(fullShareText);
  const encodedUrl = encodeURIComponent(siteUrl);
  const abbr = verse.translation ? verse.translation.trim() : 'KJV';
  const isCjk = verse.lang === 'zh-Hans' || verse.lang === 'zh-Hant';
  const quoted = isCjk ? `「${verse.text}」` : `“${verse.text}”`;
  const tweetText = encodeURIComponent(`${quoted} — ${verse.reference} (${abbr})`);
  const emailSubject = encodeURIComponent(`${verse.reference} (${abbr})`);
  const emailBody = encodeURIComponent(fullShareText);

  return {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    email: `mailto:?subject=${emailSubject}&body=${emailBody}`
  };
}

/**
 * Copies plain text to clipboard.
 * Uses modern navigator.clipboard with legacy textarea fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('Clipboard writeText failed, trying fallback', e);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy fallback failed', err);
    return false;
  }
}

/**
 * Triggers a download of a Blob as a file in the browser.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename = 'verse-of-the-day.png') {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}
