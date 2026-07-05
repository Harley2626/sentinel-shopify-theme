/**
 * Sentinel Header
 * Scroll state, sticky glass effect, and mobile drawer.
 */

(function () {
  'use strict';

  const SELECTOR = '[data-header-sentinel]';
  const SCROLL_THRESHOLD = 40;

  class HeaderSentinel {
    /**
     * @param {HTMLElement} element
     */
    constructor(element) {
      this.element = element;
      this.toggles = element.querySelectorAll('[data-header-toggle]');
      this.drawer = element.querySelector('[data-header-drawer]');
      this.overlay = element.querySelector('[data-header-overlay]');
      this.drawerLinks = element.querySelectorAll('[data-header-drawer] a');
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isSticky = element.dataset.sticky === 'true';
      this.isTransparent = element.dataset.transparent === 'true';
      this.isMenuOpen = false;
      this.rafId = null;

      this.onScroll = this.onScroll.bind(this);
      this.onToggleClick = this.onToggleClick.bind(this);
      this.onOverlayClick = this.onOverlayClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onMotionChange = this.onMotionChange.bind(this);
      this.onDrawerLinkClick = this.onDrawerLinkClick.bind(this);

      this.init();
    }

    init() {
      this.updateMotionState();
      this.bindScroll();
      this.bindMenu();
      this.onScroll();
      this.element.classList.add('header-sentinel--ready');
      this.motionQuery.addEventListener('change', this.onMotionChange);
    }

    updateMotionState() {
      this.element.classList.toggle(
        'header-sentinel--reduced-motion',
        this.motionQuery.matches
      );
    }

    onMotionChange() {
      this.updateMotionState();
    }

    bindScroll() {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    onScroll() {
      this.cancelScrollFrame();
      this.rafId = window.requestAnimationFrame(() => {
        const scrolled = window.scrollY > SCROLL_THRESHOLD;
        this.element.classList.toggle('header-sentinel--scrolled', scrolled);
      });
    }

    cancelScrollFrame() {
      if (this.rafId !== null) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    bindMenu() {
      if (!this.toggles.length || !this.drawer) return;

      this.toggles.forEach((toggle) => {
        toggle.addEventListener('click', this.onToggleClick);
      });

      if (this.overlay) {
        this.overlay.addEventListener('click', this.onOverlayClick);
      }

      document.addEventListener('keydown', this.onKeydown);
      this.drawerLinks.forEach((link) => {
        link.addEventListener('click', this.onDrawerLinkClick);
      });
    }

    onToggleClick() {
      this.setMenuOpen(!this.isMenuOpen);
    }

    onOverlayClick() {
      this.setMenuOpen(false);
    }

    onDrawerLinkClick() {
      this.setMenuOpen(false);
    }

    /**
     * @param {KeyboardEvent} event
     */
    onKeydown(event) {
      if (event.key === 'Escape' && this.isMenuOpen) {
        this.setMenuOpen(false);
        const toggle = this.toggles[0];
        if (toggle) toggle.focus();
      }
    }

    /**
     * @param {boolean} open
     */
    setMenuOpen(open) {
      this.isMenuOpen = open;
      this.element.classList.toggle('header-sentinel--menu-open', open);
      document.documentElement.classList.toggle('header-sentinel-scroll-lock', open);

      if (this.toggles.length) {
        this.toggles.forEach((toggle) => {
          toggle.setAttribute('aria-expanded', String(open));
        });
      }

      if (this.drawer) {
        this.drawer.setAttribute('aria-hidden', String(!open));
      }
    }

    destroy() {
      window.removeEventListener('scroll', this.onScroll);
      document.removeEventListener('keydown', this.onKeydown);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.cancelScrollFrame();
      this.setMenuOpen(false);
    }
  }

  /** @type {Map<HTMLElement, HeaderSentinel>} */
  const instances = new Map();

  /**
   * @param {HTMLElement} element
   */
  function initHeader(element) {
    if (instances.has(element)) {
      instances.get(element).destroy();
      instances.delete(element);
    }

    instances.set(element, new HeaderSentinel(element));
  }

  function initAll() {
    document.querySelectorAll(SELECTOR).forEach(initHeader);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const header = event.target.querySelector(SELECTOR);

    if (header) {
      initHeader(header);
    }
  });

  document.addEventListener('shopify:section:unload', (event) => {
    const header = event.target.querySelector(SELECTOR);

    if (header && instances.has(header)) {
      instances.get(header).destroy();
      instances.delete(header);
    }
  });
})();
