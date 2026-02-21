/**
 * Bookwalker Discount Badge — content script
 *
 * Runs on all bookwalker.com.tw pages but only processes wishlist pages.
 * Finds book entries, extracts prices, calculates discount percentages,
 * and injects color-coded badges next to the price information.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Wishlist page guard
  // Only proceed if the current page looks like a wishlist/bookmark page.
  // Bookwalker Taiwan wishlist URLs contain "wish" or "bookmark" and the page
  // body contains the characteristic bw_buy_* containers.
  // ---------------------------------------------------------------------------
  function isWishlistPage() {
    const url = window.location.href;
    const hasWishlistUrl =
      /\/(wish|bookmark|collection|fav)/i.test(url) ||
      url.includes('wishlist') ||
      url.includes('wish');

    // Also check for presence of bw_buy_* containers as a structural indicator.
    const hasBuyContainers = document.querySelector('div[id^="bw_buy_"]') !== null;

    return hasWishlistUrl || hasBuyContainers;
  }

  // ---------------------------------------------------------------------------
  // Price parsing helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract an integer price from a string like "原價：680元" or "特價：540元".
   * Returns NaN if the string cannot be parsed.
   */
  function parsePrice(text) {
    if (!text) return NaN;
    // Keep only digit characters, then parse as integer.
    const digits = text.replace(/\D/g, '');
    if (digits === '') return NaN;
    return parseInt(digits, 10);
  }

  /**
   * Extract the original price (原價) from a bw_buy_* div.
   * The spec says it appears in: <span class="txt_del">原價：{N}元</span>
   */
  function extractOriginalPrice(container) {
    const span = container.querySelector('span.txt_del');
    if (!span) return NaN;
    const text = span.textContent || '';
    if (!text.includes('原價')) return NaN;
    return parsePrice(text);
  }

  /**
   * Extract the special price (特價) from a bw_buy_* div.
   * The spec says it appears in a text node containing "特價：{N}元".
   * We walk all text nodes inside the container looking for that pattern.
   */
  function extractSpecialPrice(container) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue || '';
      if (text.includes('特價')) {
        return parsePrice(text);
      }
    }
    return NaN;
  }

  // ---------------------------------------------------------------------------
  // Discount calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate discount percentage given original and special prices.
   * Returns an integer, or NaN if inputs are invalid.
   */
  function calculateDiscount(originalPrice, specialPrice) {
    if (isNaN(originalPrice) || isNaN(specialPrice)) return NaN;
    if (originalPrice <= 0) return NaN;
    return Math.round((1 - specialPrice / originalPrice) * 100);
  }

  // ---------------------------------------------------------------------------
  // Badge creation
  // ---------------------------------------------------------------------------

  /**
   * Determine badge background color based on discount percentage.
   * Returns null if no badge should be shown (0% or negative).
   */
  function badgeColor(discount) {
    if (discount <= 0) return null;
    if (discount <= 10) return '#4CAF50'; // green  — small discount
    if (discount <= 30) return '#FF9800'; // orange — medium discount
    return '#F44336';                     // red    — large discount
  }

  /**
   * Create and return a styled badge <span> element.
   */
  function createBadge(discount) {
    const color = badgeColor(discount);
    if (color === null) return null;

    const badge = document.createElement('span');
    badge.className = 'bw-discount-badge';
    badge.textContent = `-${discount}%`;
    badge.style.cssText = [
      `background-color: ${color}`,
      'color: #ffffff',
      'font-weight: bold',
      'font-size: 0.85em',
      'padding: 2px 6px',
      'border-radius: 4px',
      'margin-left: 6px',
      'vertical-align: middle',
      'display: inline-block',
      'white-space: nowrap',
    ].join('; ');

    return badge;
  }

  // ---------------------------------------------------------------------------
  // Badge injection
  // ---------------------------------------------------------------------------

  /**
   * Process a single bw_buy_* container:
   * extract prices, calculate discount, inject badge.
   */
  function processContainer(container) {
    // Skip if we already injected a badge into this container.
    if (container.querySelector('.bw-discount-badge')) return;

    const originalPrice = extractOriginalPrice(container);
    const specialPrice = extractSpecialPrice(container);

    const discount = calculateDiscount(originalPrice, specialPrice);

    // Do not show badge when discount is 0, NaN, or negative.
    if (isNaN(discount) || discount <= 0) return;

    const badge = createBadge(discount);
    if (!badge) return;

    // Insert the badge after the price div, inside the .wishH container.
    // The price div is the bw_buy_* container itself; we append the badge
    // as the next sibling, or fall back to appending inside the container.
    const wishH = container.closest('.wishH');
    if (wishH) {
      // Place badge right after the bw_buy_* div within .wishH.
      container.insertAdjacentElement('afterend', badge);
    } else {
      // Fallback: append inside the container itself.
      container.appendChild(badge);
    }
  }

  /**
   * Process all bw_buy_* containers currently in the DOM.
   */
  function processAllContainers() {
    const containers = document.querySelectorAll('div[id^="bw_buy_"]');
    containers.forEach(processContainer);
  }

  // ---------------------------------------------------------------------------
  // MutationObserver for dynamically loaded book entries
  // ---------------------------------------------------------------------------

  /**
   * Given a list of added nodes from a MutationRecord, find and process any
   * bw_buy_* containers within them (or the nodes themselves if they match).
   */
  function processAddedNodes(addedNodes) {
    addedNodes.forEach(function (node) {
      // Only inspect element nodes; skip text nodes, comments, etc.
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Check if the added node itself is a bw_buy_* container.
      if (node.id && node.id.startsWith('bw_buy_')) {
        processContainer(node);
      }

      // Also check descendants of the added node.
      const descendants = node.querySelectorAll('div[id^="bw_buy_"]');
      descendants.forEach(processContainer);
    });
  }

  /**
   * Set up a MutationObserver on document.body to handle lazily-loaded
   * book entries (infinite scroll / dynamic content injection).
   *
   * The observer is disconnected when the page is about to unload so that
   * we do not keep the callback alive after navigation.
   */
  function observeDynamicContent() {
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
          processAddedNodes(mutation.addedNodes);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Disconnect on page unload to avoid dangling callbacks.
    window.addEventListener('pagehide', function () {
      observer.disconnect();
    }, { once: true });

    return observer;
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  if (!isWishlistPage()) {
    // Not a wishlist page — do nothing, generate no errors.
    return;
  }

  // Initial pass over the existing DOM.
  processAllContainers();

  // Watch for dynamically added book entries (lazy loading / infinite scroll).
  observeDynamicContent();
})();
