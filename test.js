/**
 * Test suite for Bookwalker Discount Badge content script logic.
 * Uses JSDOM to simulate browser DOM environment.
 *
 * Note: JSDOM normalizes hex colors to rgb() form in style.cssText,
 * so color assertions use rgb() values:
 *   #4CAF50 => rgb(76, 175, 80)
 *   #FF9800 => rgb(255, 152, 0)
 *   #F44336 => rgb(244, 67, 54)
 *   #ffffff => rgb(255, 255, 255)
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const contentScriptSrc = fs.readFileSync(
  path.join(__dirname, 'content.js'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runContentScript(bodyHtml, url = 'https://www.bookwalker.com.tw/wish') {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`,
    { url, runScripts: 'dangerously' }
  );
  dom.window.NodeFilter = dom.window.NodeFilter;
  dom.window.eval(contentScriptSrc);
  return dom;
}

function buildBookHtml({
  originalPrice = null,
  specialPrice = null,
  id = 'bw_buy_1',
  wrapInWishH = true,
} = {}) {
  const origSpan = originalPrice
    ? `<span class="txt_del">原價：${originalPrice}元</span>`
    : '';
  const specialText = specialPrice ? `特價：${specialPrice}元` : '';
  const inner = `
    <div id="${id}" class="bw_buy">
      ${origSpan}
      <span>${specialText}</span>
    </div>`;
  return wrapInWishH ? `<div class="wishH">${inner}</div>` : inner;
}

// JSDOM-normalized rgb() equivalents for the spec colors
const COLOR = {
  GREEN:  'rgb(76, 175, 80)',   // #4CAF50
  ORANGE: 'rgb(255, 152, 0)',   // #FF9800
  RED:    'rgb(244, 67, 54)',   // #F44336
  WHITE:  'rgb(255, 255, 255)', // #ffffff
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

// Supports both synchronous and async (Promise-returning) test functions.
// Returns a Promise so callers can await completion.
function test(description, fn) {
  let result;
  try {
    result = fn();
  } catch (err) {
    console.error(`  FAIL  ${description}`);
    console.error(`        ${err.message}`);
    failed++;
    return Promise.resolve();
  }

  // If the test function returned a Promise, handle it asynchronously.
  if (result && typeof result.then === 'function') {
    return result.then(
      () => {
        console.log(`  PASS  ${description}`);
        passed++;
      },
      (err) => {
        console.error(`  FAIL  ${description}`);
        console.error(`        ${err.message}`);
        failed++;
      }
    );
  }

  // Synchronous success.
  console.log(`  PASS  ${description}`);
  passed++;
  return Promise.resolve();
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// Tests — wrapped in async IIFE so async tests can be awaited in sequence
// ---------------------------------------------------------------------------

(async function runAllTests() {
console.log('\n=== Bookwalker Discount Badge — Test Suite ===\n');

console.log('[ Wishlist page guard ]');

await test('No badges on non-wishlist page without bw_buy_ containers', () => {
  const html = '<div><p>Some other page</p></div>';
  const dom = runContentScript(html, 'https://www.bookwalker.com.tw/home');
  const badges = dom.window.document.querySelectorAll('.bw-discount-badge');
  assertEqual(badges.length, 0, 'No badges should appear on non-wishlist page');
});

await test('Processes wishlist page by URL pattern (/wish)', () => {
  const html = buildBookHtml({ originalPrice: '680', specialPrice: '544' });
  const dom = runContentScript(html, 'https://www.bookwalker.com.tw/wish');
  assert(dom.window.document.querySelectorAll('.bw-discount-badge').length > 0,
    'Badge should appear on wishlist page');
});

await test('Processes page with bw_buy_ containers even without wishlist URL keyword', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html, 'https://www.bookwalker.com.tw/some/other/path');
  assert(dom.window.document.querySelectorAll('.bw-discount-badge').length > 0,
    'Badge should appear when bw_buy_ containers exist');
});

console.log('\n[ Discount calculation and badge text ]');

await test('680 original, 544 special => 20% discount (orange badge)', () => {
  const html = buildBookHtml({ originalPrice: '680', specialPrice: '544' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-20%', 'Badge text should be -20%');
  assertEqual(badge.style.backgroundColor, COLOR.ORANGE, 'Badge should be orange for 20%');
});

await test('1000 original, 700 special => 30% discount (orange badge)', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-30%', 'Badge text should be -30%');
  assertEqual(badge.style.backgroundColor, COLOR.ORANGE, 'Badge should be orange for 30%');
});

await test('1000 original, 600 special => 40% discount (red badge)', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '600' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-40%', 'Badge text should be -40%');
  assertEqual(badge.style.backgroundColor, COLOR.RED, 'Badge should be red for 40%');
});

await test('1000 original, 920 special => 8% discount (green badge)', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '920' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-8%', 'Badge text should be -8%');
  assertEqual(badge.style.backgroundColor, COLOR.GREEN, 'Badge should be green for 8%');
});

await test('Boundary: 10% => green', () => {
  // 1 - 612/680 = 0.1 exactly => 10%
  const html = buildBookHtml({ originalPrice: '680', specialPrice: '612' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-10%', 'Badge text should be -10%');
  assertEqual(badge.style.backgroundColor, COLOR.GREEN, '10% should be green (boundary)');
});

await test('Boundary: 11% => orange', () => {
  // (1 - 891/1000)*100 = 10.9 => rounds to 11
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '891' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-11%', 'Badge text should be -11%');
  assertEqual(badge.style.backgroundColor, COLOR.ORANGE, '11% should be orange (boundary)');
});

await test('Boundary: 31% => red', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '690' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-31%', 'Badge text should be -31%');
  assertEqual(badge.style.backgroundColor, COLOR.RED, '31% should be red (boundary)');
});

console.log('\n[ No badge scenarios ]');

await test('No badge for 0% discount (original == special)', () => {
  const html = buildBookHtml({ originalPrice: '680', specialPrice: '680' });
  const dom = runContentScript(html);
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge for 0% discount');
});

await test('No badge with only original price', () => {
  const html = buildBookHtml({ originalPrice: '680', specialPrice: null });
  const dom = runContentScript(html);
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge with only original price');
});

await test('No badge with only special price', () => {
  const html = buildBookHtml({ originalPrice: null, specialPrice: '544' });
  const dom = runContentScript(html);
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge with only special price');
});

await test('No badge with no prices at all', () => {
  const html = buildBookHtml({ originalPrice: null, specialPrice: null });
  const dom = runContentScript(html);
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge with no prices');
});

await test('No badge for unparseable price text (question marks)', () => {
  const dom = runContentScript(
    `<div class="wishH"><div id="bw_buy_99"><span class="txt_del">原價：???元</span><span>特價：???元</span></div></div>`
  );
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge for unparseable prices');
});

await test('No badge when special price > original price (negative discount)', () => {
  const html = buildBookHtml({ originalPrice: '500', specialPrice: '600' });
  const dom = runContentScript(html);
  assert(!dom.window.document.querySelector('.bw-discount-badge'), 'No badge for negative discount');
});

console.log('\n[ Badge styling ]');

await test('Badge has rounded corners (border-radius)', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge && badge.style.cssText.includes('border-radius'), 'Badge should have border-radius');
});

await test('Badge has bold font-weight', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge && badge.style.cssText.includes('bold'), 'Badge should be bold');
});

await test('Badge has padding', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge && badge.style.cssText.includes('padding'), 'Badge should have padding');
});

await test('Badge has white text color', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700' });
  const dom = runContentScript(html);
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.style.color, COLOR.WHITE, 'Badge should have white text color');
});

console.log('\n[ Badge positioning ]');

await test('Badge placed after bw_buy_ div, inside .wishH', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700', id: 'bw_buy_42', wrapInWishH: true });
  const dom = runContentScript(html);
  const wishH = dom.window.document.querySelector('.wishH');
  const buyDiv = dom.window.document.querySelector('#bw_buy_42');
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assert(wishH.contains(badge), 'Badge should be inside .wishH');
  const position = buyDiv.compareDocumentPosition(badge);
  assert(position & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'Badge should come after bw_buy_ div');
});

await test('Badge fallback inside bw_buy_ div when no .wishH parent', () => {
  const html = buildBookHtml({ originalPrice: '1000', specialPrice: '700', id: 'bw_buy_99', wrapInWishH: false });
  const dom = runContentScript(html, 'https://www.bookwalker.com.tw/wish');
  const buyDiv = dom.window.document.querySelector('#bw_buy_99');
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist even without .wishH');
  assert(buyDiv.contains(badge), 'Badge should be inside bw_buy_ div as fallback');
});

console.log('\n[ Multiple book entries ]');

await test('Each discounted book gets its own badge; 0% gets none', () => {
  const html = `
    <div class="wishH"><div id="bw_buy_1"><span class="txt_del">原價：1000元</span><span>特價：800元</span></div></div>
    <div class="wishH"><div id="bw_buy_2"><span class="txt_del">原價：500元</span><span>特價：250元</span></div></div>
    <div class="wishH"><div id="bw_buy_3"><span class="txt_del">原價：700元</span><span>特價：700元</span></div></div>
  `;
  const dom = runContentScript(html);
  const badges = dom.window.document.querySelectorAll('.bw-discount-badge');
  assertEqual(badges.length, 2, '2 out of 3 books should have badges (3rd is 0%)');
});

await test('No duplicate badges on re-run', () => {
  const html = `<div id="bw_buy_1"><span class="txt_del">原價：1000元</span><span>特價：700元</span></div>`;
  const dom = runContentScript(html, 'https://www.bookwalker.com.tw/wish');
  dom.window.eval(contentScriptSrc);
  const badges = dom.window.document.querySelectorAll('.bw-discount-badge');
  assertEqual(badges.length, 1, 'Should not create duplicate badges');
});

console.log('\n[ Price format tolerance ]');

await test('Comma-formatted price 1,000 parsed correctly as 1000', () => {
  const dom = runContentScript(
    `<div class="wishH"><div id="bw_buy_1"><span class="txt_del">原價：1,000元</span><span>特價：800元</span></div></div>`
  );
  const badge = dom.window.document.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should exist');
  assertEqual(badge.textContent, '-20%', 'Comma-formatted price parsed correctly');
});

// ---------------------------------------------------------------------------
// MutationObserver tests — async because JSDOM fires observer callbacks as
// microtasks; each test awaits Promise.resolve() to flush the queue.
// ---------------------------------------------------------------------------

console.log('\n[ MutationObserver — dynamic content ]');

// Helper: flush JSDOM's microtask queue so MutationObserver callbacks fire.
function flushMicrotasks() {
  return Promise.resolve();
}

await test('Badge appears on bw_buy_ div added dynamically to body', async () => {
  // Start with an empty wishlist page (no bw_buy_ containers yet).
  const dom = runContentScript('', 'https://www.bookwalker.com.tw/wish');
  const doc = dom.window.document;

  // Dynamically inject a book entry the way infinite scroll would.
  const wishH = doc.createElement('div');
  wishH.className = 'wishH';
  wishH.innerHTML = `
    <div id="bw_buy_dyn1">
      <span class="txt_del">原價：1000元</span>
      <span>特價：700元</span>
    </div>`;
  doc.body.appendChild(wishH);

  // Allow the MutationObserver callback to fire.
  await flushMicrotasks();

  const badge = doc.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should appear on dynamically injected book entry');
  assertEqual(badge.textContent, '-30%', 'Badge text should be -30%');
});

await test('Badge appears when a parent element containing bw_buy_ is added dynamically', async () => {
  const dom = runContentScript('', 'https://www.bookwalker.com.tw/wish');
  const doc = dom.window.document;

  // Simulate a chunk of HTML injected by the server (e.g., a page section
  // containing multiple book rows) — the observer should descend into it.
  const section = doc.createElement('section');
  section.innerHTML = `
    <div class="wishH">
      <div id="bw_buy_dyn2">
        <span class="txt_del">原價：800元</span>
        <span>特價：600元</span>
      </div>
    </div>`;
  doc.body.appendChild(section);

  await flushMicrotasks();

  const badge = doc.querySelector('.bw-discount-badge');
  assert(badge, 'Badge should appear when containing wrapper is injected dynamically');
  assertEqual(badge.textContent, '-25%', 'Badge text should be -25%');
});

await test('No duplicate badge when bw_buy_ node already has a badge before observer fires', async () => {
  // Start with a pre-existing book entry that gets a badge on initial load.
  const dom = runContentScript(
    `<div class="wishH"><div id="bw_buy_pre"><span class="txt_del">原價：1000元</span><span>特價：700元</span></div></div>`,
    'https://www.bookwalker.com.tw/wish'
  );
  const doc = dom.window.document;

  // Simulate the observer being triggered by some other DOM mutation — e.g.,
  // appending an unrelated element, which causes the observer to re-scan.
  // The deduplication guard in processContainer must prevent a second badge.
  const unrelated = doc.createElement('p');
  unrelated.textContent = 'unrelated';
  doc.body.appendChild(unrelated);

  await flushMicrotasks();

  const badges = doc.querySelectorAll('.bw-discount-badge');
  assertEqual(badges.length, 1, 'No duplicate badge on pre-existing bw_buy_ container');
});

await test('No badge added dynamically for book with 0% discount', async () => {
  const dom = runContentScript('', 'https://www.bookwalker.com.tw/wish');
  const doc = dom.window.document;

  const wishH = doc.createElement('div');
  wishH.className = 'wishH';
  wishH.innerHTML = `
    <div id="bw_buy_nodiscount">
      <span class="txt_del">原價：500元</span>
      <span>特價：500元</span>
    </div>`;
  doc.body.appendChild(wishH);

  await flushMicrotasks();

  const badge = doc.querySelector('.bw-discount-badge');
  assert(!badge, 'No badge for 0% discount on dynamically added entry');
});

await test('MutationObserver does not activate on non-wishlist pages', async () => {
  // Non-wishlist page: content script returns early, observer is never set up.
  const dom = runContentScript('<p>Not a wishlist</p>', 'https://www.bookwalker.com.tw/home');
  const doc = dom.window.document;

  const wishH = doc.createElement('div');
  wishH.className = 'wishH';
  wishH.innerHTML = `
    <div id="bw_buy_nonwish">
      <span class="txt_del">原價：1000元</span>
      <span>特價：700元</span>
    </div>`;
  doc.body.appendChild(wishH);

  await flushMicrotasks();

  const badge = doc.querySelector('.bw-discount-badge');
  assert(!badge, 'No badge should be injected dynamically on non-wishlist pages');
});

await test('Multiple dynamic entries added in one mutation batch are all processed', async () => {
  const dom = runContentScript('', 'https://www.bookwalker.com.tw/wish');
  const doc = dom.window.document;

  // Append a container with two book entries at once (single DOM mutation).
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = `
    <div class="wishH"><div id="bw_buy_batch1"><span class="txt_del">原價：1000元</span><span>特價：800元</span></div></div>
    <div class="wishH"><div id="bw_buy_batch2"><span class="txt_del">原價：500元</span><span>特價：250元</span></div></div>
  `;
  doc.body.appendChild(wrapper);

  await flushMicrotasks();

  const badges = doc.querySelectorAll('.bw-discount-badge');
  assertEqual(badges.length, 2, 'Both dynamically added books should get badges');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

})(); // end async runAllTests IIFE
