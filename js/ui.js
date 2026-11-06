/**
 * Versey — UI Module (ES Module)
 * Manages DOM updates, theme persistence, multi-language UI translation,
 * language picker popup, auto-fitting verse typography, reusable 3-step
 * Share/Download popup with focus trapping, and toast alerts.
 */

import { SWATCH_LIST, FORMAT_DIMENSIONS, resolveCardPalette } from './image.js?v=6';

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
    this.currentLang = 'en';
    this.i18nData = {};

    // Popup state
    this.popupMode = 'share'; // 'share' | 'download'
    this.currentStep = 1; // 1 | 2 | 3
    this.isPopupOpen = false;
    this.isLangPopupOpen = false;
    this.lastFocusedElement = null;

    // Element references
    this.elements = {
      html: document.documentElement,
      brandTagline: document.getElementById('brand-tagline'),
      langToggle: document.getElementById('lang-toggle'),
      themeToggle: document.getElementById('theme-toggle'),
      themeColorMeta: document.getElementById('theme-color-meta'),
      verseCard: document.getElementById('verse-card'),
      verseContent: document.getElementById('verse-content'),
      verseSkeleton: document.getElementById('verse-skeleton'),
      verseCategory: document.getElementById('verse-category'),
      verseQuote: document.getElementById('verse-quote'),
      verseText: document.getElementById('verse-text'),
      verseReference: document.getElementById('verse-reference'),
      verseVersionTag: document.getElementById('verse-version-tag'),
      footerCredit: document.getElementById('footer-credit'),
      sharePrimaryBtn: document.getElementById('share-primary-btn'),
      copyTextBtn: document.getElementById('copy-text-btn'),
      downloadImageBtn: document.getElementById('download-image-btn'),

      // Language picker popup elements
      langPopupBackdrop: document.getElementById('lang-popup-backdrop'),
      langPopup: document.getElementById('lang-popup'),
      langPopupTitle: document.getElementById('lang-popup-title'),
      langPopupCloseBtn: document.getElementById('lang-popup-close-btn'),
      langOptionBtns: document.querySelectorAll('.lang-option-btn'),

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
      formatLabel: document.getElementById('format-label'),
      formatNameStory: document.getElementById('format-name-story'),
      formatNamePost: document.getElementById('format-name-post'),
      formatNameLandscape: document.getElementById('format-name-landscape'),
      formatBtns: document.querySelectorAll('.format-btn'),
      themeLabel: document.getElementById('theme-label'),
      themeSwatchesContainer: document.getElementById('theme-swatches'),
      selectedColorName: document.getElementById('selected-color-name'),
      stepSummaryText: document.getElementById('step-summary-text'),

      fallbackShareLinks: document.getElementById('fallback-share-links'),
      modalCopyLinkBtn: document.getElementById('modal-copy-link-btn'),
      copyLinkLabel: document.getElementById('copy-link-label'),
      shareLinks: {
        wa: document.getElementById('share-link-wa'),
        x: document.getElementById('share-link-x'),
        fb: document.getElementById('share-link-fb'),
        email: document.getElementById('share-link-email')
      },

      popupBackBtn: document.getElementById('popup-back-btn'),
      popupBackLabel: document.getElementById('popup-back-label'),
      popupNextBtn: document.getElementById('popup-next-btn'),
      popupNextLabel: document.getElementById('popup-next-label'),
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
     i18n String Helper & Language UI Synchronization
     ------------------------------------------------------------------------ */
  setI18nData(i18nData = {}) {
    this.i18nData = i18nData;
  }

  getLangBundle(lang = this.currentLang) {
    return (this.i18nData && this.i18nData[lang]) || (this.i18nData && this.i18nData.en) || {};
  }

  t(key, fallback = '') {
    const bundle = this.getLangBundle(this.currentLang);
    const enBundle = (this.i18nData && this.i18nData.en) || {};
    return (bundle.ui && bundle.ui[key]) || (enBundle.ui && enBundle.ui[key]) || fallback;
  }

  /**
   * Updates `<html lang="...">`, language option checkmarks, and all static UI labels.
   */
  applyLanguageUI(langCode) {
    this.currentLang = langCode;
    this.elements.html.setAttribute('lang', langCode);

    // Sync language picker active state & aria-checked
    this.elements.langOptionBtns.forEach((btn) => {
      const match = btn.dataset.lang === langCode;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    const bundle = this.getLangBundle(langCode);

    // Brand tagline
    if (this.elements.brandTagline && bundle.tagline) {
      this.elements.brandTagline.textContent = bundle.tagline;
    }

    // Header icon buttons aria-label & title
    const langBtnLabel = this.t('languageBtnLabel', 'Change language');
    if (this.elements.langToggle) {
      this.elements.langToggle.setAttribute('aria-label', langBtnLabel);
      this.elements.langToggle.setAttribute('title', langBtnLabel);
    }

    const themeLabel = this.t('themeToggleLabel', 'Toggle dark mode');
    if (this.elements.themeToggle) {
      this.elements.themeToggle.setAttribute('aria-label', themeLabel);
      this.elements.themeToggle.setAttribute('title', themeLabel);
    }

    // Action bar icon-only buttons aria-label & title
    const shareLabel = this.t('shareBtnLabel', 'Share verse image');
    if (this.elements.sharePrimaryBtn) {
      this.elements.sharePrimaryBtn.setAttribute('aria-label', shareLabel);
      this.elements.sharePrimaryBtn.setAttribute('title', shareLabel);
    }

    const copyLabel = this.t('copyBtnLabel', 'Copy verse text');
    if (this.elements.copyTextBtn) {
      this.elements.copyTextBtn.setAttribute('aria-label', copyLabel);
      this.elements.copyTextBtn.setAttribute('title', copyLabel);
    }

    const downloadLabel = this.t('downloadBtnLabel', 'Download verse image');
    if (this.elements.downloadImageBtn) {
      this.elements.downloadImageBtn.setAttribute('aria-label', downloadLabel);
      this.elements.downloadImageBtn.setAttribute('title', downloadLabel);
    }

    // Language popup header
    if (this.elements.langPopupTitle) {
      this.elements.langPopupTitle.textContent = this.t('languagePopupTitle', 'Language');
    }

    const closeLabel = this.t('close', 'Close');
    if (this.elements.langPopupCloseBtn) {
      this.elements.langPopupCloseBtn.setAttribute('aria-label', closeLabel);
      this.elements.langPopupCloseBtn.setAttribute('title', `${closeLabel} (Esc)`);
    }
    if (this.elements.popupCloseBtn) {
      this.elements.popupCloseBtn.setAttribute('aria-label', closeLabel);
      this.elements.popupCloseBtn.setAttribute('title', `${closeLabel} (Esc)`);
    }

    // 3-step popup labels
    if (this.elements.formatLabel) {
      this.elements.formatLabel.textContent = this.t('stepFormat', 'Choose Format');
    }
    if (this.elements.themeLabel) {
      this.elements.themeLabel.textContent = this.t('stepColor', 'Choose Color');
    }
    if (this.elements.formatNameStory) {
      this.elements.formatNameStory.textContent = this.t('formatStory', 'Story / Status');
    }
    if (this.elements.formatNamePost) {
      this.elements.formatNamePost.textContent = this.t('formatPost', 'Square Post');
    }
    if (this.elements.formatNameLandscape) {
      this.elements.formatNameLandscape.textContent = this.t('formatLandscape', 'Landscape');
    }
    if (this.elements.popupBackLabel) {
      this.elements.popupBackLabel.textContent = this.t('back', 'Back');
    }
    if (this.elements.popupNextLabel) {
      this.elements.popupNextLabel.textContent = this.t('next', 'Next');
    }
    if (this.elements.copyLinkLabel) {
      this.elements.copyLinkLabel.textContent = this.t('copyLink', 'Copy Link');
    }

    this.updatePopupStepUI();
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
      this.elements.verseText.setAttribute('lang', verse.lang || 'en');
    }
    if (this.elements.verseReference) {
      this.elements.verseReference.textContent = `— ${verse.reference}`;
    }
    if (this.elements.verseVersionTag) {
      this.elements.verseVersionTag.textContent =
        verse.translationFullName || verse.translation || 'King James Version';
    }
    if (this.elements.footerCredit) {
      this.elements.footerCredit.textContent =
        verse.creditFooter || 'Scripture: King James Version, public domain';
    }

    // Fit verse text into viewport card without page scroll
    this.autoFitVerseText();
  }

  /**
   * Dynamically scales the verse font size so that even the longest verse in any
   * language fits comfortably inside the viewport card without page scrolling.
   */
  autoFitVerseText() {
    const quoteBox = this.elements.verseQuote;
    const textEl = this.elements.verseText;
    if (!quoteBox || !textEl) return;

    const verseLang = textEl.getAttribute('lang') || this.currentLang;
    const isCjk = verseLang === 'zh-Hans' || verseLang === 'zh-Hant';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxFontPx = Math.min(32, Math.max(19, Math.floor(Math.min(vw * 0.052, vh * 0.04))));
    const minFontPx = 13;

    let currentSize = maxFontPx;
    textEl.style.fontSize = `${currentSize}px`;
    textEl.style.lineHeight = isCjk ? '1.68' : '1.45';

    const availableHeight = quoteBox.clientHeight;
    if (availableHeight <= 0) return;

    while (currentSize > minFontPx && textEl.offsetHeight > availableHeight) {
      currentSize -= 0.75;
      textEl.style.fontSize = `${currentSize}px`;
      if (currentSize < 17) {
        textEl.style.lineHeight = isCjk ? '1.56' : '1.36';
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
      this.elements.selectedColorName.textContent = isCustom
        ? this.t('customColor', 'Custom Color')
        : palette.name;
    }
  }

  /* ------------------------------------------------------------------------
     Language Picker Popup Management
     ------------------------------------------------------------------------ */
  openLangPopup() {
    if (this.isPopupOpen) {
      this.closeCardPopup();
    }
    this.isLangPopupOpen = true;
    this.lastFocusedElement = document.activeElement;

    this.elements.langPopupBackdrop.classList.add('is-open');
    this.elements.langPopupBackdrop.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      const activeBtn =
        this.elements.langPopup.querySelector('.lang-option-btn.active') ||
        this.elements.langPopupCloseBtn;
      if (activeBtn) activeBtn.focus();
    });
  }

  closeLangPopup() {
    if (!this.isLangPopupOpen) return;
    this.isLangPopupOpen = false;
    this.elements.langPopupBackdrop.classList.remove('is-open');
    this.elements.langPopupBackdrop.setAttribute('aria-hidden', 'true');

    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Reusable 3-Step Popup Flow (mode: 'share' | 'download')
     ------------------------------------------------------------------------ */
  openCardPopup(mode = 'share', socialUrls = null) {
    if (this.isLangPopupOpen) {
      this.closeLangPopup();
    }
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

    if (this.callbacks.onCustomizerChange) {
      this.callbacks.onCustomizerChange(this.currentFormat, this.currentImageTheme);
    }

    requestAnimationFrame(() => {
      const activeFormatBtn =
        this.elements.cardPopup.querySelector('.format-btn.active') || this.elements.popupCloseBtn;
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

    if (this.elements.popupTitle) {
      this.elements.popupTitle.textContent = isShare
        ? this.t('popupTitleShare', 'Share Verse')
        : this.t('popupTitleDownload', 'Download Image');
    }
    if (this.elements.popupStepIndicator) {
      const stepTemplate = this.t('stepOf', '{current} of {total}');
      this.elements.popupStepIndicator.textContent = stepTemplate
        .replace('{current}', String(this.currentStep))
        .replace('{total}', '3');
    }

    this.elements.cardPopup.setAttribute('data-current-step', String(this.currentStep));

    this.elements.stepPanels.forEach((panel, idx) => {
      if (!panel) return;
      const isCurrent = idx + 1 === this.currentStep;
      panel.classList.toggle('hidden', !isCurrent);
    });

    this.updateStepSummary();

    this.elements.popupBackBtn.classList.toggle('hidden', this.currentStep === 1);
    this.elements.popupNextBtn.classList.toggle('hidden', this.currentStep === 3);
    this.elements.popupFinalBtn.classList.toggle('hidden', this.currentStep !== 3);

    if (this.elements.popupFinalBtnIcon) {
      this.elements.popupFinalBtnIcon.innerHTML = isShare ? SHARE_ICON_SVG : DOWNLOAD_ICON_SVG;
    }
    if (this.elements.popupFinalBtnLabel) {
      this.elements.popupFinalBtnLabel.textContent = isShare
        ? this.t('share', 'Share')
        : this.t('download', 'Download');
    }
  }

  updateStepSummary() {
    if (!this.elements.stepSummaryText) return;
    const formatKeyMap = {
      story: this.t('formatStory', 'Story / Status'),
      post: this.t('formatPost', 'Square Post'),
      landscape: this.t('formatLandscape', 'Landscape')
    };
    const formatLabel = formatKeyMap[this.currentFormat] || formatKeyMap.post;
    const palette = resolveCardPalette(this.currentImageTheme);
    const colorName = this.currentImageTheme.startsWith('custom:')
      ? this.t('customColor', 'Custom Color')
      : palette.name;
    this.elements.stepSummaryText.textContent = `${formatLabel} • ${colorName}`;
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
     Focus Trap inside Active Popup
     ------------------------------------------------------------------------ */
  handleFocusTrap(e) {
    if (e.key !== 'Tab') return;
    const activeContainer = this.isLangPopupOpen
      ? this.elements.langPopup
      : this.isPopupOpen
        ? this.elements.cardPopup
        : null;

    if (!activeContainer) return;

    const focusableSelectors = [
      'button:not([disabled]):not(.hidden)',
      'a[href]:not(.hidden)',
      'input:not([disabled]):not(.hidden)'
    ].join(', ');

    const allFocusable = Array.from(activeContainer.querySelectorAll(focusableSelectors)).filter(
      (el) => el.offsetParent !== null
    );

    if (!allFocusable.length) return;

    const firstEl = allFocusable[0];
    const lastEl = allFocusable[allFocusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl || !activeContainer.contains(document.activeElement)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl || !activeContainer.contains(document.activeElement)) {
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
      toast.addEventListener(
        'transitionend',
        () => {
          toast.remove();
        },
        { once: true }
      );
    }, duration);
  }

  /* ------------------------------------------------------------------------
     Event Bindings
     ------------------------------------------------------------------------ */
  bindEvents() {
    // Theme toggle
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Language picker toggle & options
    if (this.elements.langToggle) {
      this.elements.langToggle.addEventListener('click', () => this.openLangPopup());
    }
    if (this.elements.langPopupCloseBtn) {
      this.elements.langPopupCloseBtn.addEventListener('click', () => this.closeLangPopup());
    }
    if (this.elements.langPopupBackdrop) {
      this.elements.langPopupBackdrop.addEventListener('click', (e) => {
        if (e.target === this.elements.langPopupBackdrop) {
          this.closeLangPopup();
        }
      });
    }
    this.elements.langOptionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedLang = btn.dataset.lang;
        this.closeLangPopup();
        if (this.callbacks.onSelectLanguage) {
          this.callbacks.onSelectLanguage(selectedLang);
        }
      });
    });

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

    // Card popup close triggers
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

    // Escape & Tab key handling for both popups
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isLangPopupOpen) {
          e.preventDefault();
          this.closeLangPopup();
        } else if (this.isPopupOpen) {
          e.preventDefault();
          this.closeCardPopup();
        }
      } else if (e.key === 'Tab' && (this.isPopupOpen || this.isLangPopupOpen)) {
        this.handleFocusTrap(e);
      }
    });

    // Re-fit verse text on viewport resize or orientation change
    window.addEventListener('resize', () => {
      this.autoFitVerseText();
    });
  }
}
