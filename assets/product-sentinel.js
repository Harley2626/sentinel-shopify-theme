/**
 * Sentinel Product Page
 * Native variant selection, price updates, gallery, and URL sync.
 */

(function () {
  'use strict';

  class ProductSentinelGallery {
    /**
     * @param {HTMLElement} root
     */
    constructor(root) {
      this.root = root;
      this.hero = root.querySelector('[data-gallery-hero]');
      this.thumbs = root.querySelectorAll('[data-gallery-thumb]');
      this.bindEvents();
    }

    bindEvents() {
      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => this.selectThumb(thumb));
      });
    }

    /**
     * @param {HTMLButtonElement} thumb
     */
    selectThumb(thumb) {
      if (!this.hero || this.hero.tagName !== 'IMG') return;

      const src = thumb.dataset.imageSrc;
      const alt = thumb.dataset.imageAlt;

      if (src) {
        this.hero.src = src;
        this.hero.srcset = '';
      }

      if (alt) {
        this.hero.alt = alt;
      }

      this.thumbs.forEach((t) => {
        const active = t === thumb;
        t.classList.toggle('product-sentinel-gallery__thumb--active', active);
        t.setAttribute('aria-pressed', String(active));
      });
    }
  }

  class ProductSentinel {
    /**
     * @param {HTMLElement} root
     */
    constructor(root) {
      this.root = root;
      this.form = root.querySelector('[data-product-form]');
      this.variantInput = root.querySelector('[data-variant-id]');
      this.priceAmount = root.querySelector('[data-price-amount]');
      this.priceCompare = root.querySelector('[data-price-compare]');
      this.skuContainer = root.querySelector('[data-variant-sku]');
      this.skuValue = root.querySelector('[data-sku-value]');
      this.inventoryEl = root.querySelector('[data-variant-inventory]');
      this.submitBtn = root.querySelector('[data-add-to-cart]');
      this.submitLabel = root.querySelector('[data-add-to-cart-label]');
      this.errorEl = root.querySelector('[data-product-error]');
      this.optionInputs = root.querySelectorAll('[data-option-input]');
      this.optionFieldsets = root.querySelectorAll('[data-option-fieldset]');

      const jsonEl = root.querySelector('[data-product-variants-json]');
      this.productData = jsonEl ? JSON.parse(jsonEl.textContent) : null;
      this.variants = this.productData?.variants || [];
      this.optionCount = this.productData?.options?.length || 0;

      this.strings = {
        addToCart: root.dataset.addToCartText || 'Add to cart',
        soldOut: root.dataset.soldOutText || 'Sold out',
        inStock: root.dataset.inStockText || 'In stock',
        lowStock: root.dataset.lowStockText || 'Only __COUNT__ left',
        outOfStock: root.dataset.outOfStockText || 'Out of stock',
      };

      this.moneyFormat = root.dataset.moneyFormat || '${{amount}}';

      this.currentVariant = this.getVariantFromUrl() || this.getSelectedVariant();
      this.bindEvents();
      this.updateOptionCards();
      this.updateVariant(this.currentVariant, false);
    }

    bindEvents() {
      this.optionInputs.forEach((input) => {
        input.addEventListener('change', () => this.onOptionChange());
      });
    }

    /**
     * @returns {object|undefined}
     */
    getVariantFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const variantId = parseInt(params.get('variant'), 10);

      if (!variantId) return undefined;

      return this.variants.find((v) => v.id === variantId);
    }

    /**
     * @returns {object|undefined}
     */
    getSelectedVariant() {
      const options = this.getSelectedOptions();

      return this.variants.find((variant) => {
        return variant.options.every((value, index) => value === options[index]);
      });
    }

    /**
     * @returns {string[]}
     */
    getSelectedOptions() {
      const options = [];

      this.optionFieldsets.forEach((fieldset) => {
        const index = parseInt(fieldset.dataset.optionIndex, 10);
        const checked = fieldset.querySelector('[data-option-input]:checked');

        options[index] = checked ? checked.dataset.optionValue : null;
      });

      return options;
    }

    onOptionChange() {
      this.updateOptionCards();
      const variant = this.getSelectedVariant();
      this.updateVariant(variant, true);
    }

    updateOptionCards() {
      this.optionFieldsets.forEach((fieldset) => {
        const labels = fieldset.querySelectorAll('.product-sentinel-option');

        labels.forEach((label) => {
          const input = label.querySelector('[data-option-input]');
          label.classList.toggle('product-sentinel-option--selected', Boolean(input?.checked));
        });
      });
    }

    /**
     * @param {object|undefined} variant
     * @param {boolean} updateUrl
     */
    updateVariant(variant, updateUrl) {
      this.currentVariant = variant;

      if (!variant) {
        this.setUnavailable();
        return;
      }

      if (this.variantInput) {
        this.variantInput.value = String(variant.id);
        this.variantInput.disabled = !variant.available;
      }

      if (this.priceAmount) {
        this.priceAmount.textContent = this.formatMoney(variant.price);
      }

      if (this.priceCompare) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          this.priceCompare.textContent = this.formatMoney(variant.compare_at_price);
          this.priceCompare.hidden = false;
        } else {
          this.priceCompare.hidden = true;
        }
      }

      if (this.skuContainer && this.skuValue) {
        if (variant.sku) {
          this.skuValue.textContent = variant.sku;
          this.skuContainer.hidden = false;
        } else {
          this.skuContainer.hidden = true;
        }
      }

      if (this.inventoryEl) {
        this.inventoryEl.textContent = this.getInventoryMessage(variant);
        this.inventoryEl.classList.remove(
          'product-sentinel-price__inventory--low',
          'product-sentinel-price__inventory--out'
        );

        if (!variant.available) {
          this.inventoryEl.classList.add('product-sentinel-price__inventory--out');
        } else if (
          variant.inventory_management &&
          variant.inventory_quantity > 0 &&
          variant.inventory_quantity <= 5
        ) {
          this.inventoryEl.classList.add('product-sentinel-price__inventory--low');
        }
      }

      if (this.submitBtn) {
        this.submitBtn.disabled = !variant.available;
      }

      if (this.submitLabel) {
        this.submitLabel.textContent = variant.available
          ? this.strings.addToCart
          : this.strings.soldOut;
      }

      if (updateUrl) {
        this.updateUrl(variant.id);
      }
    }

    /**
     * @param {object} variant
     * @returns {string}
     */
    getInventoryMessage(variant) {
      if (!variant.available) {
        return this.strings.outOfStock;
      }

      if (
        variant.inventory_management &&
        variant.inventory_quantity > 0 &&
        variant.inventory_quantity <= 5
      ) {
        return this.strings.lowStock.replace('__COUNT__', String(variant.inventory_quantity));
      }

      if (variant.inventory_management && variant.inventory_quantity <= 0) {
        return this.strings.outOfStock;
      }

      return this.strings.inStock;
    }

    setUnavailable() {
      if (this.variantInput) {
        this.variantInput.value = '';
        this.variantInput.disabled = true;
      }

      if (this.submitBtn) {
        this.submitBtn.disabled = true;
      }

      if (this.submitLabel) {
        this.submitLabel.textContent = this.strings.soldOut;
      }
    }

    /**
     * @param {number} cents
     * @returns {string}
     */
    formatMoney(cents) {
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(cents, this.moneyFormat);
      }

      return (cents / 100).toFixed(2);
    }

    /**
     * @param {number} variantId
     */
    updateUrl(variantId) {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(variantId));
      window.history.replaceState({}, '', url.toString());
    }
  }

  /** @type {Map<HTMLElement, ProductSentinel>} */
  const productInstances = new Map();

  function initProduct(root) {
    if (productInstances.has(root)) return;

    productInstances.set(root, new ProductSentinel(root));

    const gallery = root.querySelector('[data-product-gallery]');
    if (gallery) {
      new ProductSentinelGallery(gallery);
    }
  }

  function initAll() {
    document.querySelectorAll('[data-product-sentinel]').forEach(initProduct);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('[data-product-sentinel]').forEach(initProduct);
  });
})();
