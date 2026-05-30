# CLAUDE.md — Småkunst

Context for Claude Code. Read this before making changes.

## What this is

Småkunst is a small Danish webshop selling illustrated art posters. It's run by
Sofie — a pedagogue and artist who makes cheerful, colorful posters for homes and
educational settings, often with and for children. This is a one-person hobby
business, not a mass-market operation. Built and maintained by a relative (not Sofie)
who handles the code; Sofie only ever touches the separate admin tool.

## Architecture (the important part)

This is a **fully static site** — a single `index.html` with no backend, no build
step, no frameworks. Vanilla HTML, CSS, and JS only. Keep it that way unless there's
a strong reason not to.

Data flow:

```
Admin tool (separate repo/file)  ──writes──>  Google Sheet  <──reads──  index.html (this site)
```

- **Product data lives in a Google Sheet**, not in the code. The site fetches it at
  page load via the Google Sheets API and renders the shop dynamically.
- The Sheet has two tabs:
  - `Products`: columns `id`, `name`, `description`, `available`
  - `Variants`: columns `product_id`, `size`, `price`, `image_url`
- Only products with `available = TRUE` are shown. Products with no matching variants
  are skipped. The cheapest variant sets the "fra [price]" shown in the grid.
- `Variants.product_id` must match `Products.id` exactly.
- Images are hosted on Google Drive; the admin tool stores a direct image URL in
  `image_url`. (Note: the admin tool can take ~10 seconds to generate that URL after
  an upload — not a bug.)

Config lives at the top of the `<script>` block in `index.html` (`CONFIG` object):
Sheet ID, API key, owner email, currency.

## Hosting & deploy

- Hosted on **GitHub Pages** from this repo (public repo, `main` branch, root).
- Deploy = push to `main`. Pages redeploys automatically within ~1 minute.
- Target custom domain: **smaakunst.dk** (DNS not yet pointed at the time of writing).

## Cart & checkout

- Cart is held in **localStorage** (key `smaakunst_cart`), survives reloads.
- Navigation is hash-based (`#shop`, `#product/<id>`, `#cart`, `#checkout`, `#done`)
  so it works on static hosting with no routing config.
- Checkout currently collects name + email + optional note and opens a pre-filled
  **mailto** to Sofie. There is no payment integration yet.

## What's planned next

- **Stripe** for real payments. The checkout function in `index.html` has a marked
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
  the `<style>` block — reuse those variables, don't hardcode new hex values.
- Fonts: Fraunces (headings, serif) + Nunito Sans (body). Already loaded.
- Clean, uncluttered layouts. Playful and friendly. Avoid dark, gritty, high-contrast,
  or cold-minimalist aesthetics.

## Working agreements

- This is a live shop. Show diffs and let the maintainer review before pushing.
- Keep it a single static file unless there's a clear reason to add files.
- The API key sits in `index.html` in plain text. This is acceptable *only because*
  it's restricted (Google Cloud: locked to the Sheets API and to the site's domains).
  Never commit any other secret — no service-account JSON, no write-credentials. Those
  belong only to the separate admin tool, never here.
- If asked to add features, prefer the simplest thing that fits the static + Sheet
  architecture over introducing a server or framework.
