/**
 * Versey — Main Application Entry Point (ES Module)
 * Connects daily multi-language verse data, i18n, canvas image rendering,
 * sharing, and UI state.
 */

import {
  detectInitialLanguage,
  saveLanguagePreference,
  ensureCjkStylesheet,
  getDayOfYear,
  getMsUntilLocalMidnight,
  loadI18n,
  loadVersesForLanguage,
  getVerseForDay
} from './verse.js?v=6';

import {
  renderVerseToCanvas,
  generateVerseBlob,
  generateVerseFile
} from './image.js?v=6';

import {
  isWebShareSupported,
  shareNative,
  formatVerseCopyText,
  formatVerseShareText,
  buildSocialShareUrls,
  copyToClipboard,
  downloadBlob,
  SITE_URL
} from './share.js?v=6';

import { UIManager } from './ui.js?v=6';

class VerseyApp {
  constructor() {
    this.currentLang = detectInitialLanguage();
    this.i18nData = {};
    this.currentVerse = null;
    this.activeDayOfYear = null;
    this.midnightTimerId = null;

    // Initialize UI Manager with callbacks
    this.ui = new UIManager({
      onSelectLanguage: (langCode) => this.handleSelectLanguage(langCode),
      onCustomizerChange: (format, themeId) => this.renderImagePreview(format, themeId),
      onOpenSharePopup: () => this.handleOpenSharePopup(),
      onOpenDownloadPopup: () => this.handleOpenDownloadPopup(),
      onCopyText: () => this.handleCopyText(),
      onConfirmShare: () => this.handleConfirmShare(),
      onConfirmDownload: () => this.handleConfirmDownload(),
      onCopyLink: () => this.handleCopyLink()
    });
  }

  /**
   * Initializes the application flow.
   */
  async init() {
    this.ui.setLoading(true);

    // Load CJK fonts only if initial language is Chinese
    ensureCjkStylesheet(this.currentLang);

    const [i18n] = await Promise.all([
      loadI18n(),
      loadVersesForLanguage(this.currentLang).catch((err) => {
        console.warn('Fallback to default verse:', err);
      })
    ]);

    this.i18nData = i18n || {};
    this.ui.setI18nData(this.i18nData);
    this.ui.applyLanguageUI(this.currentLang);

    await this.updateTodayVerse();
    this.scheduleMidnightRollover();
    this.bindDayCheckOnVisibility();
    this.registerServiceWorker();
  }

  /**
   * Registers service worker for offline PWA support.
   */
  registerServiceWorker() {
    if (
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    ) {
      navigator.serviceWorker.addEventListener('controllerchange', async () => {
        await loadVersesForLanguage(this.currentLang, true);
        await this.updateTodayVerse();
      });

      navigator.serviceWorker
        .register('./service-worker.js', { updateViaCache: 'none' })
        .then((reg) => reg.update())
        .catch((err) => console.warn('Service Worker registration skipped:', err));
    }
  }

  /**
   * Handles switching language from the Language Picker Popup.
   * Only fetches the selected language's JSON (and CJK fonts if Chinese),
   * remembers the user's choice in localStorage, and updates the view immediately.
   * @param {string} langCode
   */
  async handleSelectLanguage(langCode) {
    if (!langCode) return;
    this.currentLang = langCode;
    saveLanguagePreference(langCode);
    ensureCjkStylesheet(langCode);
    this.ui.applyLanguageUI(langCode);

    await loadVersesForLanguage(langCode);
    await this.updateTodayVerse();
  }

  /**
   * Updates the view to show today's verse in the selected language.
   */
  async updateTodayVerse() {
    const now = new Date();
    const dayOfYear = getDayOfYear(now);
    this.activeDayOfYear = dayOfYear;

    this.currentVerse = getVerseForDay(dayOfYear, this.currentLang, this.i18nData);
    this.ui.renderVerse(this.currentVerse);

    // Update social links and live canvas preview if popup is open
    if (this.ui.isPopupOpen) {
      const socialUrls = buildSocialShareUrls(this.currentVerse, SITE_URL);
      this.ui.updateSocialLinks(socialUrls);
      await this.renderImagePreview(this.ui.currentFormat, this.ui.currentImageTheme);
    }
  }

  /**
   * Automatically refreshes the verse at the user's local midnight.
   */
  scheduleMidnightRollover() {
    if (this.midnightTimerId) {
      clearTimeout(this.midnightTimerId);
    }

    const msUntilMidnight = getMsUntilLocalMidnight(new Date());
    this.midnightTimerId = setTimeout(async () => {
      await this.updateTodayVerse();
      this.scheduleMidnightRollover();
    }, msUntilMidnight);
  }

  /**
   * Checks if the local day changed while the tab was backgrounded.
   */
  bindDayCheckOnVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const currentDay = getDayOfYear(new Date());
        if (this.activeDayOfYear !== null && currentDay !== this.activeDayOfYear) {
          this.updateTodayVerse();
          this.scheduleMidnightRollover();
        }
      }
    });
  }

  /**
   * Renders the current verse onto the live preview canvas.
   */
  async renderImagePreview(format, themeId) {
    if (!this.currentVerse || !this.ui.elements.verseCanvas) return;

    this.ui.setCanvasLoading(true);
    try {
      await renderVerseToCanvas(this.ui.elements.verseCanvas, this.currentVerse, format, themeId);
    } catch (err) {
      console.error('Failed to render canvas image', err);
    } finally {
      this.ui.setCanvasLoading(false);
    }
  }

  /**
   * Opens the 3-step popup in "share" mode.
   */
  handleOpenSharePopup() {
    if (!this.currentVerse) return;
    const socialUrls = buildSocialShareUrls(this.currentVerse, SITE_URL);
    this.ui.openCardPopup('share', socialUrls);
  }

  /**
   * Opens the 3-step popup in "download" mode.
   */
  handleOpenDownloadPopup() {
    if (!this.currentVerse) return;
    this.ui.openCardPopup('download');
  }

  /**
   * Copies the verse and reference in the selected language and shows a 2-second toast.
   */
  async handleCopyText() {
    if (!this.currentVerse) return;

    const copyText = formatVerseCopyText(this.currentVerse);
    const success = await copyToClipboard(copyText);

    if (success) {
      this.ui.showToast(this.ui.t('copiedToast', 'Copied'), 2000);
    } else {
      this.ui.showToast(this.ui.t('errorToast', 'Action failed'), 2000);
    }
  }

  /**
   * Executes final Share action on Step 3 of the Share popup.
   */
  async handleConfirmShare() {
    if (!this.currentVerse) return;

    const canvas = this.ui.elements.verseCanvas;
    const format = this.ui.currentFormat;
    const themeId = this.ui.currentImageTheme;
    const shareText = formatVerseShareText(this.currentVerse);

    if (isWebShareSupported()) {
      try {
        let file = null;
        try {
          file = await generateVerseFile(canvas, this.currentVerse, format, themeId);
        } catch (fileErr) {
          console.warn('Could not generate image file for native share', fileErr);
        }

        const sharePayload = {
          title: `${this.currentVerse.reference} (${this.currentVerse.translation || 'KJV'})`,
          text: shareText,
          url: SITE_URL
        };

        if (file) {
          sharePayload.files = [file];
        }

        const result = await shareNative(sharePayload);
        if (result.success) {
          this.ui.closeCardPopup();
          this.ui.showToast(this.ui.t('sharedToast', 'Shared'), 2000);
          return;
        }

        if (result.cancelled) {
          return;
        }
      } catch (err) {
        console.warn('Native share unavailable, showing direct-link menu', err);
      }
    }

    const socialUrls = buildSocialShareUrls(this.currentVerse, SITE_URL);
    this.ui.showFallbackShareLinks(socialUrls);
  }

  /**
   * Executes final Download action on Step 3 of the Download popup.
   */
  async handleConfirmDownload() {
    if (!this.currentVerse || !this.ui.elements.verseCanvas) return;

    try {
      const blob = await generateVerseBlob(
        this.ui.elements.verseCanvas,
        this.currentVerse,
        this.ui.currentFormat,
        this.ui.currentImageTheme
      );

      downloadBlob(blob, 'verse-of-the-day.png');
      this.ui.closeCardPopup();
      this.ui.showToast(this.ui.t('savedToast', 'Image saved'), 2000);
    } catch (err) {
      console.error('Image download failed', err);
      this.ui.showToast(this.ui.t('errorToast', 'Action failed'), 2000);
    }
  }

  /**
   * Copies the site link from the fallback share menu.
   */
  async handleCopyLink() {
    const success = await copyToClipboard(SITE_URL);
    if (success) {
      this.ui.showToast(this.ui.t('linkCopiedToast', 'Link copied'), 2000);
    } else {
      this.ui.showToast(this.ui.t('errorToast', 'Action failed'), 2000);
    }
  }
}

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new VerseyApp();
  app.init();
});
