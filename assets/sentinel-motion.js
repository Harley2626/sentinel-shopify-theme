/**
 * Sentinel Motion Engine
 * One shared animation system for the entire theme.
 * GPU-accelerated: transform + opacity. rAF + IntersectionObserver.
 */

(function () {
  'use strict';

  const DESKTOP_MQ = '(min-width: 990px)';
  const REDUCED_MQ = '(prefers-reduced-motion: reduce)';
  const SCROLL_PARALLAX_FACTOR = 0.35;

  class SentinelMotionEngine {
    constructor() {
      this.reducedQuery = window.matchMedia(REDUCED_MQ);
      this.desktopQuery = window.matchMedia(DESKTOP_MQ);
      this.reduced = this.reducedQuery.matches;
      this.desktop = this.desktopQuery.matches;
      this.revealObserver = null;
      this.countObserver = null;
      this.parallaxRoots = [];
      this.scrollRaf = null;

      this.onReducedChange = this.onReducedChange.bind(this);
      this.onDesktopChange = this.onDesktopChange.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onScroll = this.onScroll.bind(this);
    }

    init() {
      this.syncMotionClasses();
      this.setStaggerIndices();
      this.initRevealObserver();
      this.initImmediateReveals();
      this.initCounters();
      this.initParallax();
      this.initHeroScroll();
      this.initScrollParallax();
      this.initProducts();
      this.reducedQuery.addEventListener('change', this.onReducedChange);
      this.desktopQuery.addEventListener('change', this.onDesktopChange);
      this.bindShopifySections();
    }

    getCountDuration() {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--sentinel-motion-count-duration')
        .trim();
      const parsed = parseInt(value, 10);

      return Number.isFinite(parsed) ? parsed : 1200;
    }

    getParallaxMax(root) {
      const custom = Number(root.dataset.motionParallaxMax);
      const fallback = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sentinel-motion-parallax-max'),
        10
      );

      return custom || fallback || 10;
    }

    getTiltMax() {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--sentinel-motion-tilt-max')
        .trim();
      const parsed = parseFloat(value);

      return Number.isFinite(parsed) ? parsed : 2;
    }

    syncMotionClasses() {
      document.documentElement.classList.toggle('sentinel-motion--reduced', this.reduced);
      document.documentElement.classList.toggle('sentinel-motion--mobile', !this.desktop);
    }

    onReducedChange() {
      this.reduced = this.reducedQuery.matches;
      this.syncMotionClasses();
      this.resetParallax();
      this.initParallax();
    }

    onDesktopChange() {
      this.desktop = this.desktopQuery.matches;
      this.syncMotionClasses();
      this.resetParallax();
      this.initParallax();
    }

    /**
     * @param {HTMLElement} element
     */
    reveal(element) {
      element.classList.add('sentinel-motion--revealed');

      if (element.hasAttribute('data-motion-section')) {
        element.querySelectorAll('[data-motion-stagger], [data-motion-reveal]').forEach((child) => {
          child.classList.add('sentinel-motion--revealed');
        });
      }
    }

    setStaggerIndices() {
      document.querySelectorAll('[data-motion-stagger]').forEach((group) => {
        group.querySelectorAll(':scope > [data-motion-stagger-item]').forEach((item, index) => {
          item.style.setProperty('--motion-index', String(index + 1));
        });
      });

      document.querySelectorAll('[data-motion-index]').forEach((element) => {
        element.style.setProperty('--motion-index', element.dataset.motionIndex || '0');
      });
    }

    initRevealObserver() {
      if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('[data-motion-reveal], [data-motion-stagger], [data-motion-section]').forEach((el) => {
          this.reveal(el);
        });
        return;
      }

      if (this.revealObserver) {
        this.revealObserver.disconnect();
      }

      this.revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            this.reveal(entry.target);
            this.revealObserver.unobserve(entry.target);
          });
        },
        {
          threshold: 0.12,
          rootMargin: '0px 0px -8% 0px',
        }
      );

      document.querySelectorAll('[data-motion-reveal]:not([data-motion-immediate])').forEach((el) => {
        this.revealObserver.observe(el);
      });

      document.querySelectorAll('[data-motion-stagger]:not([data-motion-immediate])').forEach((el) => {
        this.revealObserver.observe(el);
      });

      document.querySelectorAll('[data-motion-section]').forEach((el) => {
        this.revealObserver.observe(el);
      });
    }

    initImmediateReveals() {
      document.querySelectorAll('[data-motion-immediate]').forEach((root) => {
        window.requestAnimationFrame(() => {
          root.querySelectorAll('[data-motion-reveal]').forEach((el) => {
            this.reveal(el);
          });
        });
      });
    }

    /**
     * @param {string} value
     * @returns {{ end: number, suffix: string } | null}
     */
    parseCountValue(value) {
      const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(.*)$/);

      if (!match) return null;

      return {
        end: parseFloat(match[1]),
        suffix: match[2] || '',
      };
    }

    /**
     * @param {HTMLElement} element
     */
    animateCount(element) {
      const raw = element.dataset.motionCountValue;

      if (!raw) return;

      const parsed = this.parseCountValue(raw);

      if (!parsed) return;

      const { end, suffix } = parsed;
      const duration = this.getCountDuration();
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(end * eased);

        element.textContent = `${current}${suffix}`;

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          element.textContent = raw;
        }
      };

      element.textContent = `0${suffix}`;
      window.requestAnimationFrame(tick);
    }

    initCounters() {
      const counters = document.querySelectorAll('[data-motion-count]');

      if (!counters.length) return;

      if (this.reduced || !('IntersectionObserver' in window)) {
        return;
      }

      if (this.countObserver) {
        this.countObserver.disconnect();
      }

      this.countObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            this.animateCount(entry.target);
            this.countObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.35 }
      );

      counters.forEach((counter) => {
        this.countObserver.observe(counter);
      });
    }

    initParallax() {
      this.resetParallax();
      this.parallaxRoots = Array.from(document.querySelectorAll('[data-motion-parallax]'));

      if (this.reduced || !this.desktop || !this.parallaxRoots.length) return;

      this.parallaxRoots.forEach((root) => {
        const hoverRoot = root.closest('[data-hero-sentinel]') || root;

        hoverRoot.addEventListener('mousemove', this.onMouseMove, { passive: true });
        hoverRoot.addEventListener('mouseleave', this.onMouseLeave, { passive: true });
      });
    }

    resetParallax() {
      this.parallaxRoots.forEach((root) => {
        const hoverRoot = root.closest('[data-hero-sentinel]') || root;

        hoverRoot.removeEventListener('mousemove', this.onMouseMove);
        hoverRoot.removeEventListener('mouseleave', this.onMouseLeave);
        root.style.setProperty('--motion-parallax-x', '0px');
        root.style.setProperty('--motion-parallax-y', '0px');
        root.style.setProperty('--motion-tilt-x', '0deg');
        root.style.setProperty('--motion-tilt-y', '0deg');
      });

      this.parallaxRoots = [];
    }

    /**
     * @param {MouseEvent} event
     */
    onMouseMove(event) {
      if (this.reduced || !this.desktop) return;

      const hoverRoot = event.currentTarget;

      if (!(hoverRoot instanceof HTMLElement)) return;

      const root = hoverRoot.querySelector('[data-motion-parallax]');

      if (!(root instanceof HTMLElement)) return;

      const rect = hoverRoot.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const max = this.getParallaxMax(root);
      const tilt = this.getTiltMax();

      root.style.setProperty('--motion-parallax-x', `${x * max}px`);
      root.style.setProperty('--motion-parallax-y', `${y * max}px`);
      root.style.setProperty('--motion-tilt-x', `${-y * tilt}deg`);
      root.style.setProperty('--motion-tilt-y', `${x * tilt}deg`);
    }

    /**
     * @param {MouseEvent} event
     */
    onMouseLeave(event) {
      const hoverRoot = event.currentTarget;

      if (!(hoverRoot instanceof HTMLElement)) return;

      const root = hoverRoot.querySelector('[data-motion-parallax]');

      if (!(root instanceof HTMLElement)) return;

      root.style.setProperty('--motion-parallax-x', '0px');
      root.style.setProperty('--motion-parallax-y', '0px');
      root.style.setProperty('--motion-tilt-x', '0deg');
      root.style.setProperty('--motion-tilt-y', '0deg');
    }

    initScrollParallax() {
      const layers = document.querySelectorAll('[data-motion-parallax-inner]');

      if (!layers.length || this.reduced) return;

      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
    }

    onScroll() {
      if (this.scrollRaf !== null) return;

      this.scrollRaf = window.requestAnimationFrame(() => {
        this.scrollRaf = null;

        document.querySelectorAll('[data-motion-parallax-inner]').forEach((layer) => {
          const section = layer.closest('[data-hero-sentinel]');

          if (!section) return;

          const rect = section.getBoundingClientRect();
          const offset = Math.max(0, -rect.top) * SCROLL_PARALLAX_FACTOR;

          layer.style.setProperty('--motion-scroll-y', `${offset}px`);
        });
      });
    }

    initHeroScroll() {
      document.querySelectorAll('[data-hero-scroll]').forEach((link) => {
        link.addEventListener('click', (event) => {
          const hero = link.closest('[data-hero-sentinel]');
          const section = hero?.closest('.shopify-section') || hero;
          const nextSection = section?.nextElementSibling;

          if (!nextSection) return;

          event.preventDefault();
          nextSection.scrollIntoView({ behavior: this.reduced ? 'auto' : 'smooth' });
        });
      });
    }

    /**
     * @param {HTMLElement} element
     */
    pulseValue(element) {
      if (!element || this.reduced) return;

      element.classList.remove('sentinel-motion--value-change');
      void element.offsetWidth;
      element.classList.add('sentinel-motion--value-change');
    }

    /**
     * @param {HTMLImageElement} image
     * @param {() => void} update
     */
    crossfadeImage(image, update) {
      if (!image || this.reduced) {
        update();
        return;
      }

      const duration = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sentinel-motion-crossfade'),
        10
      ) || 350;

      image.classList.add('sentinel-motion--crossfade-out');

      window.setTimeout(() => {
        update();
        image.classList.remove('sentinel-motion--crossfade-out');
        image.classList.add('sentinel-motion--crossfade-in');

        window.setTimeout(() => {
          image.classList.remove('sentinel-motion--crossfade-in');
        }, duration);
      }, duration * 0.5);
    }

    /**
     * @param {HTMLElement} root
     */
    bindProduct(root) {
      if (root.dataset.motionProductBound === 'true') return;

      root.dataset.motionProductBound = 'true';

      const premiumOptions = root.querySelectorAll('[data-motion-premium-option]');

      premiumOptions.forEach((option) => {
        option.addEventListener('mouseenter', () => {
          if (!this.reduced) {
            root.classList.add('product-sentinel--premium-glow');
          }
        });

        option.addEventListener('mouseleave', () => {
          root.classList.remove('product-sentinel--premium-glow');
        });

        option.addEventListener('focusin', () => {
          if (!this.reduced) {
            root.classList.add('product-sentinel--premium-glow');
          }
        });

        option.addEventListener('focusout', () => {
          root.classList.remove('product-sentinel--premium-glow');
        });
      });
    }

    initProducts() {
      document.querySelectorAll('[data-product-sentinel]').forEach((root) => {
        this.bindProduct(root);
      });
    }

    refresh() {
      this.setStaggerIndices();
      this.initRevealObserver();
      this.initImmediateReveals();
      this.initCounters();
      this.initParallax();
      this.initProducts();
    }

    bindShopifySections() {
      document.addEventListener('shopify:section:load', () => {
        this.refresh();
      });
    }
  }

  const engine = new SentinelMotionEngine();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => engine.init());
  } else {
    engine.init();
  }

  window.SentinelMotion = engine;
})();
