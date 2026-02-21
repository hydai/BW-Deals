# BW Deals

A Chrome extension that calculates and displays color-coded discount badges on [Bookwalker Taiwan](https://www.bookwalker.com.tw/) wishlist pages.

## Features

- **Discount calculation** — Automatically parses original and special prices from each book entry
- **Discount badges** — Injects a badge (e.g., "-20%") next to each book's price
- **Color coding** — Badges are colored by discount magnitude:

| Discount | Color | Meaning |
|----------|-------|---------|
| 1–10% | Green | Small discount |
| 11–30% | Orange | Medium discount |
| 31%+ | Red | Large discount |

- **Dynamic content** — Handles lazy-loaded book entries via MutationObserver

## Install

1. Clone this repository:
   ```
   git clone git@github.com:hydai/BW-Deals.git
   ```
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `BW-Deals` directory
5. Navigate to your Bookwalker Taiwan wishlist page

## How It Works

The extension runs a content script on `bookwalker.com.tw` pages. On wishlist pages, it:

1. Finds all book entries (`div[id^="bw_buy_"]`)
2. Extracts the original price (原價) and special price (特價)
3. Calculates the discount percentage
4. Injects a styled, color-coded badge after each price

Books without both prices, with unparseable prices, or with 0% discount show no badge.

## Development

### Run tests

```bash
npm install
node test.js
```

### Project structure

```
manifest.json   — Chrome extension manifest (Manifest V3)
content.js      — Content script with all extension logic
test.js         — Unit tests (JSDOM)
package.json    — Dev dependencies
```

## License

ISC
