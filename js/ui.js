/**
 * Versey — UI Module (ES Module)
 * Manages DOM updates, theme persistence, auto-fitting verse typography,
 * reusable 3-step Share/Download popup with focus trapping, and toast alerts.
 */

import { SWATCH_LIST, FORMAT_DIMENSIONS, resolveCardPalette } from './image.js';

const THEME_STORAGE_KEY = 'versey_color_theme';
const SESSION_FORMAT_KEY = 'versey_session_format';
const SESSION_COLOR_KEY = 'versey_session_color';

const SHARE_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
`;

const DOWNLOAD_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
`;

export class UIManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

    // Load session state or defaults
    this.currentFormat = this.getSessionValue(SESSION_FORMAT_KEY) || 'post';
    this.currentImageTheme = this.getSessionValue(SESSION_COLOR_KEY) || 'cream';

    // Popup state
    this.popupMode = 'share'; // 'share' | 'download'
    this.currentStep = 1; // 1 | 2 | 3
    this.isPopupOpen = false;
    this.lastFocusedElement = null;

    // Element references
    this.elements = {
      html: document.documentElement,
      themeToggle: document.getElementById('theme-toggle'),
      themeColorMeta: document.getElementById('theme-color-meta'),
      verseCard: document.getElementById('verse-card'),
      verseContent: document.getElementById('verse-content'),
      verseSkeleton: document.getElementById('verse-skeleton'),
      verseCategory: document.getElementById('verse-category'),
      verseQuote: document.getElementById('verse-quote'),
      verseText: document.getElementById('verse-text'),
      verseReference: document.getElementById('verse-reference'),
      sharePrimaryBtn: document.getElementById('share-primary-btn'),
      copyTextBtn: document.getElementById('copy-text-btn'),
      downloadImageBtn: document.getElementById('download-image-btn'),

      // Reusable 3-step popup elements
      cardPopupBackdrop: document.getElementById('card-popup-backdrop'),
      cardPopup: document.getElementById('card-popup'),
      popupTitle: document.getElementById('popup-title'),
      popupStepIndicator: document.getElementById('popup-step-indicator'),
      popupCloseBtn: document.getElementById('popup-close-btn'),
      popupPreviewArea: document.getElementById('popup-preview-area'),
      previewContainer: document.getElementById('preview-container'),
      verseCanvas: document.getElementById('verse-canvas'),
      canvasLoadingOverlay: document.getElementById('canvas-loading-overlay'),

      stepPanels: [
        document.getElementById('step-panel-1'),
        document.getElementById('step-panel-2'),
        document.getElementById('step-panel-3')
      ],
      formatBtns: document.querySelectorAll('.format-btn'),
      themeSwatchesContainer: document.getElementById('theme-swatches'),
      selectedColorName: document.getElementById('selected-color-name'),
      stepSummaryText: document.getElementById('step-summary-text'),

      fallbackShareLinks: document.getElementById('fallback-share-links'),
      modalCopyLinkBtn: document.getElementById('modal-copy-link-btn'),
      shareLinks: {
        wa: document.getElementById('share-link-wa'),
        x: document.getElementById('share-link-x'),
        fb: document.getElementById('share-link-fb'),
        email: document.getElementById('share-link-email')
      },

      popupBackBtn: document.getElementById('popup-back-btn'),
      popupNextBtn: document.getElementById('popup-next-btn'),
      popupFinalBtn: document.getElementById('popup-final-btn'),
      popupFinalBtnIcon: document.getElementById('popup-final-btn-icon'),
      popupFinalBtnLabel: document.getElementById('popup-final-btn-label'),

      toastContainer: document.getElementById('toast-container')
    };

    this.initTheme();
    this.buildSwatches();
    this.syncFormatButtonsUI();
    this.syncSwatchButtonsUI();
    this.bindEvents();
  }

  /* ------------------------------------------------------------------------
     Session Storage Helpers
     ------------------------------------------------------------------------ */
  getSessionValue(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setSessionValue(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore storage errors in private browsing
    }
  }

  /* ------------------------------------------------------------------------
     Theme Management (Light / Dark)
     ------------------------------------------------------------------------ */
  initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      savedTheme = null;
    }

    if (savedTheme) {
      this.setTheme(savedTheme, false);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light', false);
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        try {
          if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            this.setTheme(e.matches ? 'dark' : 'light', false);
          }
        } catch {
          this.setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  setTheme(theme, persist = true) {
    this.elements.html.setAttribute('data-theme', theme);
    if (this.elements.themeColorMeta) {
      this.elements.themeColorMeta.setAttribute('content', theme === 'dark' ? '#141312' : '#faf8f5');
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Ignore storage errors
      }
    }
  }

  toggleTheme() {
    const current = this.elements.html.getAttribute('data-theme') || 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme, true);
  }

  /* ------------------------------------------------------------------------
     Swatch Grid Generation (20 Presets + Custom Color Picker)
     ------------------------------------------------------------------------ */
  buildSwatches() {
    const container = this.elements.themeSwatchesContainer;
    if (!container) return;

    container.innerHTML = '';

    SWATCH_LIST.forEach((swatch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn';
      btn.dataset.themeId = swatch.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('aria-label', swatch.name);
      btn.setAttribute('title', swatch.name);

      const circle = document.createElement('span');
      circle.className = 'swatch-color';
      if (swatch.bgStart === swatch.bgEnd) {
        circle.style.background = swatch.bgStart;
      } else {
        circle.style.background = `linear-gradient(135deg, ${swatch.bgStart}, ${swatch.bgEnd})`;
      }

      // Contrast indicator dot so user sees auto text contrast
      const palette = resolveCardPalette(swatch.id);
      const dot = document.createElement('span');
      dot.className = 'swatch-contrast-dot';
      dot.style.backgroundColor = palette.textColor;
      circle.appendChild(dot);

      btn.appendChild(circle);
      btn.addEventListener('click', () => {
        this.setImageTheme(swatch.id);
      });

      container.appendChild(btn);
    });

    // Optional Custom Color Picker Swatch
    const customWrap = document.createElement('label');
    customWrap.className = 'swatch-btn swatch-custom-label';
    customWrap.setAttribute('title', 'Custom Color');
    customWrap.setAttribute('aria-label', 'Choose custom color');

    const customCircle = document.createElement('span');
    customCircle.className = 'swatch-color swatch-custom-wheel';

    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.id = 'custom-color-picker';
    customInput.className = 'swatch-custom-input';
    customInput.value = this.currentImageTheme.startsWith('custom:')
      ? this.currentImageTheme.replace('custom:', '')
      : '#3b4d5e';
    customInput.setAttribute('aria-label', 'Custom background color picker');

    customInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      this.setImageTheme(`custom:${hex}`);
    });

    customWrap.appendChild(customCircle);
    customWrap.appendChild(customInput);
    container.appendChild(customWrap);

    this.swatchButtons = container.querySelectorAll('.swatch-btn[data-theme-id]');
    this.customSwatchLabel = customWrap;
    this.customColorInput = customInput;
  }

  /* ------------------------------------------------------------------------
     Verse Rendering & Auto-Fit Typography (No Page Scroll)
     ------------------------------------------------------------------------ */
  setLoading(isLoading) {
    if (isLoading) {
      this.elements.verseCard.classList.add('is-loading');
    } else {
      this.elements.verseCard.classList.remove('is-loading');
    }
  }

  setCanvasLoading(isLoading) {
    if (this.elements.canvasLoadingOverlay) {
      this.elements.canvasLoadingOverlay.classList.toggle('active', isLoading);
    }
  }

  renderVerse(verse) {
    this.setLoading(false);

    if (this.elements.verseCategory) {
      this.elements.verseCategory.textContent = verse.category || 'Scripture';
    }
    if (this.elements.verseText) {
      this.elements.verseText.textContent = verse.text;
    }
    if (this.elements.verseReference) {
      this.elements.verseReference.textContent = `— ${verse.reference}`;
    }

    // Fit verse text into viewport card without page scroll
    this.autoFitVerseText();
  }

  /**
   * Dynamically scales the verse font size so that even the longest verse fits
   * comfortably inside the viewport card without scrolling. Only if the minimum
   * readable font size is reached does `.verse-quote` allow internal scroll.
   */
  autoFitVerseText() {
    const quoteBox = this.elements.verseQuote;
    const textEl = this.elements.verseText;
    if (!quoteBox || !textEl) return;

    // Reset inline font-size first to measure available box
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxFontPx = Math.min(34, Math.max(20, Math.floor(Math.min(vw * 0.055, vh * 0.042))));
    const minFontPx = 13.5;

    let currentSize = maxFontPx;
    textEl.style.fontSize = `${currentSize}px`;
    textEl.style.lineHeight = '1.45';

    // Available height inside the quote flex container
    const availableHeight = quoteBox.clientHeight;
    if (availableHeight <= 0) return;

    while (currentSize > minFontPx && textEl.offsetHeight > availableHeight) {
      currentSize -= 0.75;
      textEl.style.fontSize = `${currentSize}px`;
      if (currentSize < 17) {
        textEl.style.lineHeight = '1.38';
      }
    }
  }

  /* ------------------------------------------------------------------------
     Format & Color State Updates
     ------------------------------------------------------------------------ */
  setFormat(format) {
    if (!FORMAT_DIMENSIONS[format]) return;
    this.currentFormat = format;
    this.setSessionValue(SESSION_FORMAT_KEY, format);
    this.syncFormatButtonsUI();
    this.updateStepSummary();

    if (this.callbacks.onCustomizerChange) {
      this.callbacks.onCustomizerChange(this.currentFormat, this.currentImageTheme);
    }
  }

  syncFormatButtonsUI() {
    this.elements.formatBtns.forEach((btn) => {
      const match = btn.dataset.format === this.currentFormat;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    if (this.elements.previewContainer) {
      this.elements.previewContainer.setAttribute('data-aspect', this.currentFormat);
    }
  }

  setImageTheme(themeId) {
    this.currentImageTheme = themeId;
    this.setSessionValue(SESSION_COLOR_KEY, themeId);
    this.syncSwatchButtonsUI();
    this.updateStepSummary();

    if (this.callbacks.onCustomizerChange) {
      this.callbacks.onCustomizerChange(this.currentFormat, this.currentImageTheme);
    }
  }

  syncSwatchButtonsUI() {
    const isCustom = this.currentImageTheme.startsWith('custom:');
    if (this.swatchButtons) {
      this.swatchButtons.forEach((btn) => {
        const match = !isCustom && btn.dataset.themeId === this.currentImageTheme;
        btn.classList.toggle('active', match);
        btn.setAttribute('aria-checked', match ? 'true' : 'false');
      });
    }

    if (this.customSwatchLabel) {
      this.customSwatchLabel.classList.toggle('active', isCustom);
    }

    if (this.elements.selectedColorName) {
      const palette = resolveCardPalette(this.currentImageTheme);
      this.elements.selectedColorName.textContent = palette.name;
    }
  }

  /* ------------------------------------------------------------------------
     Reusable 3-Step Popup Flow (mode: 'share' | 'download')
     ------------------------------------------------------------------------ */
  openCardPopup(mode = 'share', socialUrls = null) {
    this.popupMode = mode === 'download' ? 'download' : 'share';
    this.currentStep = 1;
    this.isPopupOpen = true;
    this.lastFocusedElement = document.activeElement;

    if (socialUrls) {
      this.updateSocialLinks(socialUrls);
    }

    if (this.elements.fallbackShareLinks) {
      this.elements.fallbackShareLinks.classList.add('hidden');
    }

    this.updatePopupStepUI();

    this.elements.cardPopupBackdrop.classList.add('is-open');
    this.elements.cardPopupBackdrop.setAttribute('aria-hidden', 'false');

    // Trigger canvas render immediately with remembered session format & color
    if (this.callbacks.onCustomizerChange) {
      this.callbacks.onCustomizerChange(this.currentFormat, this.currentImageTheme);
    }

    // Focus first interactive control inside popup
    requestAnimationFrame(() => {
      const activeFormatBtn = this.elements.cardPopup.querySelector('.format-btn.active') || this.elements.popupCloseBtn;
      if (activeFormatBtn) activeFormatBtn.focus();
    });
  }

  closeCardPopup() {
    if (!this.isPopupOpen) return;
    this.isPopupOpen = false;
    this.elements.cardPopupBackdrop.classList.remove('is-open');
    this.elements.cardPopupBackdrop.setAttribute('aria-hidden', 'true');

    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  goToStep(stepNumber) {
    this.currentStep = Math.max(1, Math.min(3, stepNumber));
    if (this.currentStep !== 3 && this.elements.fallbackShareLinks) {
      this.elements.fallbackShareLinks.classList.add('hidden');
    }
    this.updatePopupStepUI();
  }

  updatePopupStepUI() {
    const isShare = this.popupMode === 'share';

    // Header Title & Step Indicator
    if (this.elements.popupTitle) {
      this.elements.popupTitle.textContent = isShare ? 'Share Verse' : 'Download Image';
    }
    if (this.elements.popupStepIndicator) {
      this.elements.popupStepIndicator.textContent = `${this.currentStep} of 3`;
    }

    // Toggle step class on popup for responsive preview sizing
    this.elements.cardPopup.setAttribute('data-current-step', String(this.currentStep));

    // Toggle step panels
    this.elements.stepPanels.forEach((panel, idx) => {
      if (!panel) return;
      const isCurrent = idx + 1 === this.currentStep;
      panel.classList.toggle('hidden', !isCurrent);
    });

    // Update summary text on Step 3
    this.updateStepSummary();

    // Footer buttons visibility
    this.elements.popupBackBtn.classList.toggle('hidden', this.currentStep === 1);
    this.elements.popupNextBtn.classList.toggle('hidden', this.currentStep === 3);
    this.elements.popupFinalBtn.classList.toggle('hidden', this.currentStep !== 3);

    // Configure final button icon and label based on mode
    if (this.elements.popupFinalBtnIcon) {
      this.elements.popupFinalBtnIcon.innerHTML = isShare ? SHARE_ICON_SVG : DOWNLOAD_ICON_SVG;
    }
    if (this.elements.popupFinalBtnLabel) {
      this.elements.popupFinalBtnLabel.textContent = isShare ? 'Share' : 'Download';
    }
  }

  updateStepSummary() {
    if (!this.elements.stepSummaryText) return;
    const dim = FORMAT_DIMENSIONS[this.currentFormat] || FORMAT_DIMENSIONS.post;
    const palette = resolveCardPalette(this.currentImageTheme);
    this.elements.stepSummaryText.textContent = `${dim.name} • ${palette.name}`;
  }

  updateSocialLinks(socialUrls) {
    if (!socialUrls) return;
    if (this.elements.shareLinks.wa) this.elements.shareLinks.wa.href = socialUrls.whatsapp;
    if (this.elements.shareLinks.x) this.elements.shareLinks.x.href = socialUrls.twitter;
    if (this.elements.shareLinks.fb) this.elements.shareLinks.fb.href = socialUrls.facebook;
    if (this.elements.shareLinks.email) this.elements.shareLinks.email.href = socialUrls.email;
  }

  showFallbackShareLinks(socialUrls) {
    if (socialUrls) {
      this.updateSocialLinks(socialUrls);
    }
    if (this.elements.fallbackShareLinks) {
      this.elements.fallbackShareLinks.classList.remove('hidden');
    }
  }

  /* ------------------------------------------------------------------------
     Focus Trap inside Popup
     ------------------------------------------------------------------------ */
  handleFocusTrap(e) {
    if (!this.isPopupOpen || e.key !== 'Tab') return;

    const focusableSelectors = [
      'button:not([disabled]):not(.hidden)',
      'a[href]:not(.hidden)',
      'input:not([disabled]):not(.hidden)'
    ].join(', ');

    const allFocusable = Array.from(
      this.elements.cardPopup.querySelectorAll(focusableSelectors)
    ).filter((el) => el.offsetParent !== null);

    if (!allFocusable.length) return;

    const firstEl = allFocusable[0];
    const lastEl = allFocusable[allFocusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl || !this.elements.cardPopup.contains(document.activeElement)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl || !this.elements.cardPopup.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  /* ------------------------------------------------------------------------
     Toast Notifications
     ------------------------------------------------------------------------ */
  showToast(message, duration = 2000) {
    if (!this.elements.toastContainer) return;

    // Clear existing toasts to keep UI minimal and uncluttered
    this.elements.toastContainer.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    this.elements.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      }, { once: true });
    }, duration);
  }

  /* ------------------------------------------------------------------------
     Event Bindings
     ------------------------------------------------------------------------ */
  bindEvents() {
    // Theme toggle
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Main icon-only action buttons
    this.elements.sharePrimaryBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenSharePopup) {
        this.callbacks.onOpenSharePopup();
      }
    });

    this.elements.copyTextBtn.addEventListener('click', () => {
      if (this.callbacks.onCopyText) {
        this.callbacks.onCopyText();
      }
    });

    this.elements.downloadImageBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenDownloadPopup) {
        this.callbacks.onOpenDownloadPopup();
      }
    });

    // Step 1 Format buttons
    this.elements.formatBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setFormat(btn.dataset.format);
      });
    });

    // Popup navigation buttons (Back / Next / Final)
    this.elements.popupBackBtn.addEventListener('click', () => {
      this.goToStep(this.currentStep - 1);
    });

    this.elements.popupNextBtn.addEventListener('click', () => {
      this.goToStep(this.currentStep + 1);
    });

    this.elements.popupFinalBtn.addEventListener('click', () => {
      if (this.popupMode === 'share') {
        if (this.callbacks.onConfirmShare) this.callbacks.onConfirmShare();
      } else {
        if (this.callbacks.onConfirmDownload) this.callbacks.onConfirmDownload();
      }
    });

    // Popup close triggers (X button, backdrop click, Escape key)
    this.elements.popupCloseBtn.addEventListener('click', () => this.closeCardPopup());
    this.elements.cardPopupBackdrop.addEventListener('click', (e) => {
      if (e.target === this.elements.cardPopupBackdrop) {
        this.closeCardPopup();
      }
    });

    // Fallback Copy Link button inside Step 3
    if (this.elements.modalCopyLinkBtn) {
      this.elements.modalCopyLinkBtn.addEventListener('click', () => {
        if (this.callbacks.onCopyLink) this.callbacks.onCopyLink();
      });
    }

    // Escape & Tab key handling
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPopupOpen) {
        e.preventDefault();
        this.closeCardPopup();
      } else if (e.key === 'Tab' && this.isPopupOpen) {
        this.handleFocusTrap(e);
      }
    });

    // Re-fit verse text on viewport resize or orientation change
    window.addEventListener('resize', () => {
      this.autoFitVerseText();
    });
  }
}
