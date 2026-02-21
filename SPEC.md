# Bookwalker Discount Badge — Chrome Extension Specification

## Purpose

A Google Chrome extension that calculates and visually displays discount percentages for books on the Bookwalker Taiwan (bookwalker.com.tw) wishlist page, using color-coded badges to indicate discount magnitude at a glance.

## Users

Bookwalker Taiwan users who maintain a wishlist and want to quickly identify which books have the best discounts.

## Impacts

- Users can see discount percentages without manual calculation
- Color coding enables quick visual scanning of discount magnitude across the wishlist

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Discount calculation | Parse original price (原價) and special price (特價) from each book entry, calculate discount percentage |
| 2 | Discount badge | Inject a visible badge showing the discount percentage (e.g., "-10%") next to each book's price |
| 3 | Color coding | Apply Green/Yellow/Red background color to the badge based on discount magnitude |

## User Journey

**Context**: User opens their Bookwalker Taiwan wishlist page (`bookwalker.com.tw` wishlist/收藏).

**Action**: The extension automatically scans all visible book entries for price information.

**Outcome**: Each book with both original and special prices displays a colored discount badge.

## Feature Behaviors

### F1: Discount Calculation

- Extract original price from `<span class="txt_del">原價：{N}元</span>`
- Extract special price from the text node containing `特價：{N}元` within the same `bw_buy_*` div
- Discount % = `round((1 - specialPrice / originalPrice) * 100)`
- Parse prices as integers (remove non-numeric characters except digits)

### F2: Discount Badge

- Insert a `<span>` element with the discount text (e.g., "-10%") after the price div
- Badge styled with: rounded corners, bold text, padding for readability
- Badge positioned within the existing `.wishH` container

### F3: Color Coding

| Discount Range | Color | Label |
|----------------|-------|-------|
| 0% (no discount) | No badge shown | — |
| 1–10% | Green (`#4CAF50`) | Small discount |
| 11–30% | Yellow/Orange (`#FF9800`) | Medium discount |
| 31%+ | Red (`#F44336`) | Large discount |

- Text color: white for all badges
- If only special price exists (no original price), no badge is shown
- If only original price exists (no special price / not on sale), no badge is shown

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| No price elements found on page | Extension does nothing (no errors, no UI changes) |
| Price text cannot be parsed as a number | Skip that book entry, no badge shown |
| Original price equals special price (0% discount) | No badge shown |
| Page loads dynamically (lazy loading) | Use MutationObserver to detect newly loaded book entries |
| Extension runs on non-wishlist pages | Content script only matches wishlist URL pattern |

## Contracts

### DOM Contract (input)

- Price container: `div[id^="bw_buy_"]`
- Original price: child `span.txt_del` containing `原價：{N}元`
- Special price: text node in the same div containing `特價：` followed by `{N}元`

### Badge Contract (output)

- Badge element: `<span class="bw-discount-badge">` inserted after the price div
- Badge contains text like `-10%`
- Badge has inline styles or a class with the appropriate background color

### URL Match Pattern

- `*://*.bookwalker.com.tw/*` — content script loads on all bookwalker.com.tw pages
- Script self-checks for wishlist page indicators before processing

## Terminology

| Term | Definition |
|------|-----------|
| Original price (原價) | The list/retail price before any discount |
| Special price (特價) | The current discounted selling price |
| Discount percentage | `(1 - special/original) * 100`, rounded to nearest integer |
| Badge | The injected HTML element displaying the discount percentage |
