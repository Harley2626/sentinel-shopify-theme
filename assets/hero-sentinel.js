/**
 * Sentinel Hero Section
 * Handles entrance animations and smooth parallax scrolling.
 * Respects prefers-reduced-motion.
 */

(function () {
  'use strict';

  const PARALLAX_FACTOR = 0.35;
  const SELECTOR = '[data-hero-sentinel]';

  class HeroSentinel {
    /**
     * @param {HTMLElement} element
     */
    constructor(element) {
      this.element = element;
      this.mediaInner = element.querySelector('[data-hero-parallax]');
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isReducedMotion = this.motionQuery.matches;
      this.rafId = null;
      this.isVisible = true;

      this.onScroll = this.onScroll.bind(this);
      this.onMotionChange = this.onMotionChange.bind(this);
      this.onIntersection = this.onIntersection.bind(this);

      this.init();
    }

    init() {
      this.updateMotionState();
      this.element.classList.add('hero-sentinel--ready');

      if (!this.isReducedMotion) {
        this.bindParallax();
        this.bindVisibility();
      }

      this.motionQuery.addEventListener('change', this.onMotionChange);
    }

    updateMotionState() {
      this.isReducedMotion = this.motionQuery.matches;
      this.element.classList.toggle('hero-sentinel--reduced-motion', this.isReducedMotion);

      if (this.isReducedMotion) {
        this.resetParallax();
        this.unbindParallax();
      }
    }

    onMotionChange() {
      this.updateMotionState();

      if (!this.isReducedMotion) {
        this.bindParallax();
        this.bindVisibility();
        this.onScroll();
      }
    }

    bindVisibility() {
      if (!('IntersectionObserver' in window)) return;

      this.observer = new IntersectionObserver(this.onIntersection, {
        root: null,
        threshold: 0,
      });

      this.observer.observe(this.element);
    }

    /**
     * @param {IntersectionObserverEntry[]} entries
     */
    onIntersection(entries) {
      const entry = entries[0];
      if (!entry) return;

      this.isVisible = entry.isIntersecting;

      if (this.isVisible) {
        this.onScroll();
      } else {
        this.cancelParallaxFrame();
      }
    }

    bindParallax() {
      if (!this.mediaInner || this.isReducedMotion) return;

      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
    }

    unbindParallax() {
      window.removeEventListener('scroll', this.onScroll);
      this.cancelParallaxFrame();
    }

    onScroll() {
      if (!this.mediaInner || this.isReducedMotion || !this.isVisible) return;

      this.cancelParallaxFrame();
      this.rafId = window.requestAnimationFrame(() => {
        const rect = this.element.getBoundingClientRect();
        const scrollProgress = Math.max(0, -rect.top);
        const offset = scrollProgress * PARALLAX_FACTOR;

        this.element.style.setProperty('--hero-parallax-y', `${offset}px`);
      });
    }

    resetParallax() {
      this.element.style.setProperty('--hero-parallax-y', '0px');
    }

    cancelParallaxFrame() {
      if (this.rafId !== null) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    destroy() {
      this.unbindParallax();
      this.motionQuery.removeEventListener('change', this.onMotionChange);

      if (this.observer) {
        this.observer.disconnect();
      }
    }
  }

  /** @type {Map<HTMLElement, HeroSentinel>} */
  const instances = new Map();

  /**
   * @param {HTMLElement} element
   */
  function initHero(element) {
    if (instances.has(element)) {
      instances.get(element).destroy();
      instances.delete(element);
    }

    instances.set(element, new HeroSentinel(element));
  }

  function initAll() {
    document.querySelectorAll(SELECTOR).forEach(initHero);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const hero = event.target.querySelector(SELECTOR);

    if (hero) {
      initHero(hero);
    }
  });

  document.addEventListener('shopify:section:unload', (event) => {
    const hero = event.target.querySelector(SELECTOR);

    if (hero && instances.has(hero)) {
      instances.get(hero).destroy();
      instances.delete(hero);
    }
  });
})();
