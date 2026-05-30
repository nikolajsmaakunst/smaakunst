# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Småkunst is a small Danish webshop selling illustrated art posters. It's run by
Sofie — a pedagogue and artist who makes cheerful, colorful posters for homes and
educational settings, often with and for children. This is a one-person hobby
business, not a mass-market operation. Built and maintained by a relative (not Sofie)
who handles the code; Sofie only ever touches the separate admin tool.

## Architecture

This is a **fully static site** — no backend, no build step, no frameworks. Vanilla
HTML, CSS, and JS only.

**Files:**
- `index.html` — landing page. Static; hero + two category cards (Plakater, Keramik)
  + an about teaser. Does **not** load `shop.js`; just a small inline script to sync
  the cart badge.
- `shop.js` — the **shared shop engine**. Catalog loading, product grid, product
  detail, cart, checkout, order confirmation, and the lightbox. All rendered
  client-side via hash-based routing. Category-agnostic — driven by config.
- `plakater.html`, `keramik.html` — thin per-category shop shells. Each sets a global
  `window.SHOP` config object (category + category-specific copy) **before** loading
  `shop.js`, then includes it.
- `about.html` — static about page for Sofie and the project.
- `style.css` — all shared styles used by every page.

**Adding a new product type** (the scalable path): create `<type>.html` by copying an
existing shop shell, change the `window.SHOP` config (category, hero copy, labels,
optional `ecoNote`), add a card to `index.html`'s `.cat-grid`, add a nav link to every
page's header, and tag the products with that `category` value in the Sheet. No
changes to `shop.js` needed.

`window.SHOP` fields: `category` (must match the Sheet's `category` value),
`includeUncategorized` (true only for `plakater.html`, so legacy posters with a blank
category still show), `defaultName`, `hero` ({tag, title, intro} — `title` allows
inline HTML like `<em>`), `backLabel`, `emptyLead`, `emptyBtn`, `ecoNote`
({icon, text} or null), `emptyDataNoun`.

Data flow:

```
Admin tool (separate repo/file)  ──writes──>  Google Sheet  <──reads──  shop.js
```

- **Product data lives in a Google Sheet**, not in the code. The site fetches it at
  page load via the Google Sheets API and renders the shop dynamically.
- The Sheet has two tabs:
  - `Products`: columns `id`, `name`, `description`, `available`, `category`
  - `Variants`: columns `product_id`, `size`, `price`, `image_url`
- **`category`** decides which page a product appears on (e.g. `plakat`, `keramik`),
  matched case-insensitively against each page's `window.SHOP.category`. A blank
  category only shows on pages with `includeUncategorized: true` (currently just
  Plakater). **This column must be filled in the Sheet** for Keramik items to appear.
- Only products with `available = TRUE` are shown. Products with no matching variants
  are skipped. The cheapest variant sets the "fra [price]" shown in the grid.
- `Variants.product_id` must match `Products.id` exactly.
- Images are hosted on Google Drive; the admin tool stores a direct image URL in
  `image_url`. (Note: the admin tool can take ~10 seconds to generate that URL after
  an upload — not a bug.)
- The cart is shared across all category pages (one localStorage key), so an order can
  mix posters and ceramics. Cart lines store their own name/size/price/image at
  add-time, so the cart and checkout work even though each page's catalog is filtered.

Config lives at the top of `shop.js` (`CONFIG` object): Sheet ID, API key, owner
email, currency.

## Hosting & deploy

- Hosted on **GitHub Pages** from this repo (public repo, `main` branch, root).
- Deploy = push to `main`. Pages redeploys automatically within ~1 minute.
- Target custom domain: **smaakunst.dk** (DNS not yet pointed at the time of writing).
- Use relative links between pages (`about.html`, not `/about.html`) — root-relative
  paths break on the GitHub Pages subpath before the custom domain is live.

## Cart & checkout

- Cart is held in **localStorage** (key `smaakunst_cart`), survives reloads and
  navigation between pages.
- Navigation within the shop is hash-based (`#shop`, `#product/<id>`, `#cart`,
  `#checkout`, `#done`) so it works on static hosting with no routing config.
- On static pages without `shop.js` (`index.html`, `about.html`), the cart badge is
  synced via a small inline script at the bottom of the page.
- Checkout currently collects name + email + optional note and opens a pre-filled
  **mailto** to Sofie. There is no payment integration yet.

## What's planned next

- **Stripe** for real payments. The `checkout()` function in `shop.js` has a marked
  comment showing where the mailto is — that's the swap point. Cart line items are
  already structured (name, size, price, qty) so they map cleanly to Stripe
  `line_items`. Don't rebuild the cart for this; just replace the mailto step.
- Point smaakunst.dk at GitHub Pages (DNS records + Pages custom-domain setting).

## Brand & tone (matters for any user-facing copy)

- **Language: Danish first.** English only if explicitly asked, or for SEO/meta.
- Voice: warm, genuine, grounded. Write like a real person, not a brand manager.
  Enthusiastic about creativity and learning, but no hype, no corporate language,
  no salesy superlatives ("Don't miss out!", "Limited time only!" — never).
- Inclusive language. Child- and family-friendly, but not infantile.
- Honest and direct — no padded, lengthy copy.
- Sustainability is real here: print-on-demand, FSC/PEFC-certified paper, no physical
  inventory. Reflect this where relevant (e.g. "trykkes først, når du bestiller").
- When writing product descriptions, lead with the emotional or educational value of
  the poster before logistics like size and price.

## Visual direction

- Warm cream/off-white backgrounds. Coral accent (`--coral: #E8775A`). Supporting
  leaf-green and soft-sky tones. Full color palette is in CSS variables at the top of
  `style.css` — reuse those variables, don't hardcode new hex values.
- Fonts: Fraunces (headings, serif) + Nunito Sans (body). Loaded via Google Fonts in
  each page's `<head>`; no local copies.
- Clean, uncluttered layouts. Playful and friendly. Avoid dark, gritty, high-contrast,
  or cold-minimalist aesthetics.

## Working agreements

- This is a live shop. Show diffs and let the maintainer review before pushing.
- The API key sits in `shop.js` in plain text. This is acceptable *only because*
  it's restricted (Google Cloud: locked to the Sheets API and to the site's domains).
  Never commit any other secret — no service-account JSON, no write-credentials. Those
  belong only to the separate admin tool, never here.
- If asked to add features, prefer the simplest thing that fits the static + Sheet
  architecture over introducing a server or framework.
