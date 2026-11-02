/**
 * Versey — Main Application Entry Point (ES Module)
 * Connects daily KJV verse data, canvas image rendering, sharing, and UI state.
 */

import {
  getDayOfYear,
  getMsUntilLocalMidnight,
  loadVerses,
  getVerseForDay,
  getFallbackVerse
} from './verse.js';

import {
  renderVerseToCanvas,
  generateVerseBlob,
  generateVerseFile
} from './image.js';

import {
  isWebShareSupported,
  shareNative,
  formatVerseCopyText,
  formatVerseShareText,
  buildSocialShareUrls,
  copyToClipboard,
  downloadBlob,
  SITE_URL
} from './share.js';

import { UIManager } from './ui.js';

class VerseyApp {
  constructor() {
    this.versesData = [];
    this.currentVerse = null;
    this.activeDayOfYear = null;
    this.midnightTimerId = null;

    // Initialize UI Manager with callbacks
    this.ui = new UIManager({
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

    try {
      this.versesData = await loadVerses();
    } catch (error) {
      console.warn('Could not fetch external verses.json, using fallback scripture.', error);
      this.versesData = [getFallbackVerse(1)];
    }

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
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./service-worker.js')
          .catch((err) => console.warn('Service Worker registration skipped:', err));
      });
    }
  }

  /**
   * Updates the view to show today's verse based on the user's local date.
   */
  async updateTodayVerse() {
    const now = new Date();
    const dayOfYear = getDayOfYear(now);
    this.activeDayOfYear = dayOfYear;

    this.currentVerse = getVerseForDay(this.versesData, dayOfYear);
    this.ui.renderVerse(this.currentVerse);

    if (this.ui.isPopupOpen) {
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
   * Copies the verse and reference directly and shows a 2-second toast (no popup).
   */
  async handleCopyText() {
    if (!this.currentVerse) return;

    const copyText = formatVerseCopyText(this.currentVerse);
    const success = await copyToClipboard(copyText);

    if (success) {
      this.ui.showToast('Copied', 2000);
    } else {
      this.ui.showToast('Unable to copy', 2000);
    }
  }

  /**
   * Executes final Share action on Step 3 of the Share popup.
   * Uses native Web Share API with image and text when supported,
   * otherwise reveals the direct-link fallback menu.
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
          title: `Verse of the Day — ${this.currentVerse.reference}`,
          text: shareText,
          url: SITE_URL
        };

        if (file) {
          sharePayload.files = [file];
        }

        const result = await shareNative(sharePayload);
        if (result.success) {
          this.ui.closeCardPopup();
          this.ui.showToast('Shared', 2000);
          return;
        }

        if (result.cancelled) {
          return;
        }
      } catch (err) {
        console.warn('Native share unavailable, showing direct-link menu', err);
      }
    }

    // Fallback: reveal direct-link share options inside Step 3
    const socialUrls = buildSocialShareUrls(this.currentVerse, SITE_URL);
    this.ui.showFallbackShareLinks(socialUrls);
  }

  /**
   * Executes final Download action on Step 3 of the Download popup.
   * Saves a PNG named `verse-of-the-day.png`.
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
      this.ui.showToast('Image saved', 2000);
    } catch (err) {
      console.error('Image download failed', err);
      this.ui.showToast('Download failed', 2000);
    }
  }

  /**
   * Copies the site link from the fallback share menu.
   */
  async handleCopyLink() {
    const success = await copyToClipboard(SITE_URL);
    if (success) {
      this.ui.showToast('Link copied', 2000);
    } else {
      this.ui.showToast('Unable to copy link', 2000);
    }
  }
}

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new VerseyApp();
  app.init();
});
