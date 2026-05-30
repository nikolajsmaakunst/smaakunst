/* ============================================================================
   Småkunst — delt shop-motor
   Bruges af alle produktsider (plakater.html, keramik.html, …). Hver side sætter
   et globalt SHOP-objekt FØR dette script indlæses, der bestemmer kategori og
   den kategori-specifikke tekst. Resten — kurv, checkout, datahentning, lightbox
   — er fælles.

   Læser produkter fra et offentligt Google Sheet, holder kurv i localStorage,
   og samler bestillingen via en mailto-besked til Sofie.
   Stripe kan kobles på senere — se kommentaren ved checkout().

   Produkter filtreres på Products-arkets `category`-kolonne (fx 'plakat' /
   'keramik'). Sider med includeUncategorized:true viser også produkter uden
   kategori (så eksisterende plakater stadig vises, før kolonnen er udfyldt).
============================================================================ */

/* ---------- Konfiguration ------------------------------------------------- */
const CONFIG = {
  sheetId:    '1xRqlwRXiyKWymnxP4s28IGXDTa-2-E-LlOW9wGtlaI8',
  apiKey:     'AIzaSyArsm9StOFP-nEvR27RAmPD7NjS7WWETxk',          // <- indsæt din Google Sheets API-nøgle
  ownerEmail: 'nikolaj@smaakunst.dk',         // <- din mailadresse
  currency:   'kr.',
};

/* Kategori-specifik opsætning kommer fra den enkelte side (window.SHOP). */
const SHOP = Object.assign({
  category:             '',
  includeUncategorized: false,
  defaultName:          'Produkt',
  hero:                 { tag: '', title: '', intro: '' },
  backLabel:            '← Tilbage',
  emptyLead:            'Tag et kig i shoppen — måske er der noget, der skal med hjem.',
  emptyBtn:             'Se udvalget',
  ecoNote:              null,
  emptyDataNoun:        'produkter',
}, window.SHOP || {});

/* ---------- Hjælpere ------------------------------------------------------ */
const kr = n => new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' ' + CONFIG.currency;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const app = document.getElementById('app');

/* ---------- Kurv (localStorage) ------------------------------------------ */
function getCart() {
  try { return JSON.parse(localStorage.getItem('smaakunst_cart')) || {}; }
  catch { return {}; }
}
function saveCart(c) { localStorage.setItem('smaakunst_cart', JSON.stringify(c)); updateBadge(); }
function cartCount() { return Object.values(getCart()).reduce((n, l) => n + l.qty, 0); }
function cartTotal() { return Object.values(getCart()).reduce((t, l) => t + l.price * l.qty, 0); }
function updateBadge() {
  const b = document.getElementById('cartBadge'), n = cartCount();
  if (!b) return;
  b.textContent = n; b.style.display = n > 0 ? 'inline-flex' : 'none';
}

function addToCart(pid, size) {
  const p = CATALOG[pid]; if (!p) return;
  const v = p.variants.find(v => v.size === size); if (!v) return;
  const cart = getCart(), key = pid + '|' + size;
  if (cart[key]) cart[key].qty++;
  else cart[key] = { product_id: pid, name: p.name, size, price: v.price, image_url: v.image_url || '', qty: 1 };
  saveCart(cart); go('cart');
}
function setQty(key, qty) {
  const cart = getCart(); qty = Math.max(0, parseInt(qty) || 0);
  if (qty === 0) delete cart[key]; else cart[key].qty = qty;
  saveCart(cart); renderCart();
}
function removeLine(key) { const c = getCart(); delete c[key]; saveCart(c); renderCart(); }

/* ---------- Datahentning -------------------------------------------------- */
let CATALOG = {};

async function fetchTab(tab) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${tab}?key=${CONFIG.apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Sheet ' + tab + ' svarede ' + res.status);
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const o = {}; headers.forEach((h, i) => o[h] = (r[i] ?? '').toString().trim()); return o;
  });
}

async function loadCatalog() {
  const [products, variants] = await Promise.all([fetchTab('Products'), fetchTab('Variants')]);

  const byProduct = {};
  variants.forEach(v => {
    if (!v.product_id) return;
    v.price = parseFloat(String(v.price).replace(',', '.')) || 0;
    (byProduct[v.product_id] ||= []).push(v);
  });

  const want = SHOP.category.toLowerCase();
  const catalog = {};
  products.forEach(p => {
    if (String(p.available).toUpperCase() !== 'TRUE') return;
    const cat = String(p.category || '').toLowerCase();
    const inCategory = cat === want || (!cat && SHOP.includeUncategorized);
    if (!inCategory) return;
    const vs = byProduct[p.id]; if (!vs || !vs.length) return;
    vs.sort((a, b) => a.price - b.price);
    catalog[p.id] = {
      id: p.id, name: p.name || SHOP.defaultName, description: p.description || '',
      variants: vs, min_price: vs[0].price, thumb: vs[0].image_url || '',
    };
  });
  return catalog;
}

/* ---------- Visninger ----------------------------------------------------- */
function go(view, arg) {
  location.hash = view + (arg ? '/' + arg : '');
}

function router() {
  const [view, arg] = location.hash.replace(/^#/, '').split('/');
  window.scrollTo(0, 0);
  switch (view) {
    case 'product':  renderProduct(arg); break;
    case 'cart':     renderCart(); break;
    case 'checkout': renderCheckout(); break;
    case 'done':     renderDone(); break;
    default:         renderShop();
  }
}

function renderShop() {
  const items = Object.values(CATALOG);
  if (!items.length) { renderEmptyData(); return; }
  app.innerHTML = `
    <section class="hero reveal">
      <span class="tag">${SHOP.hero.tag}</span>
      <h1>${SHOP.hero.title}</h1>
      <p>${SHOP.hero.intro}</p>
    </section>
    <section class="grid">
      ${items.map((p, i) => `
        <button class="card reveal" style="animation-delay:${i * .04}s" onclick="go('product','${esc(p.id)}')">
          <div class="thumb">
            ${p.thumb ? `<img src="${esc(p.thumb)}" alt="${esc(p.name)}" loading="lazy">`
                      : `<span class="ph">Billede på vej</span>`}
          </div>
          <div class="body">
            <h3>${esc(p.name)}</h3>
            <div class="price"><small>fra</small> ${kr(p.min_price)}</div>
          </div>
        </button>`).join('')}
    </section>`;
}

function renderProduct(id) {
  const p = CATALOG[id];
  if (!p) { go('shop'); return; }
  let sel = 0;
  app.innerHTML = `
    <button class="back" onclick="go('shop')">${SHOP.backLabel}</button>
    <section class="detail">
      <div class="imgcol reveal ${p.thumb ? 'zoomable' : ''}" id="imgCol" title="${p.thumb ? 'Klik for at forstørre' : ''}">
        ${p.thumb ? `<img id="mainImg" src="${esc(p.thumb)}" alt="${esc(p.name)}">`
                  : `<span class="ph">Billede på vej</span>`}
      </div>
      <div class="reveal">
        <h1>${esc(p.name)}</h1>
        <p class="desc">${esc(p.description)}</p>
        <div class="price-now" id="priceNow">${kr(p.min_price)}</div>
        <div class="sizes" id="sizes">
          ${p.variants.map((v, i) => `
            <button class="size-opt ${i === 0 ? 'active' : ''}" data-i="${i}">
              <span class="s-size">${esc(v.size)}</span>
              <span class="s-price">${kr(v.price)}</span>
            </button>`).join('')}
        </div>
        <button class="btn" id="addBtn">Læg i kurv</button>
        ${SHOP.ecoNote ? `
        <div class="note-eco">
          <span class="leaf">${SHOP.ecoNote.icon}</span>
          <span>${SHOP.ecoNote.text}</span>
        </div>` : ''}
      </div>
    </section>`;

  const img = document.getElementById('mainImg');
  const price = document.getElementById('priceNow');
  app.querySelectorAll('.size-opt').forEach(btn => btn.addEventListener('click', () => {
    sel = +btn.dataset.i;
    app.querySelectorAll('.size-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    price.textContent = kr(p.variants[sel].price);
    if (img && p.variants[sel].image_url) img.src = p.variants[sel].image_url;
  }));
  if (img) document.getElementById('imgCol').addEventListener('click', () => openLightbox(img.src, p.name));
  document.getElementById('addBtn').addEventListener('click', () => addToCart(p.id, p.variants[sel].size));
}

function renderCart() {
  const cart = getCart(), keys = Object.keys(cart);
  app.innerHTML = `
    <div class="panel reveal">
      <h1>Din kurv</h1>
      ${keys.length === 0 ? `
        <div class="empty">
          <h2>Kurven er tom endnu</h2>
          <p style="margin-bottom:22px;">${SHOP.emptyLead}</p>
          <button class="btn" onclick="go('shop')">${SHOP.emptyBtn}</button>
        </div>` : `
        ${keys.map(key => { const l = cart[key]; return `
          <div class="cart-row">
            ${l.image_url ? `<img class="ci-img" src="${esc(l.image_url)}" alt="${esc(l.name)}">`
                          : `<div class="ci-img"></div>`}
            <div class="ci-info">
              <h3>${esc(l.name)}</h3>
              <div class="ci-size">${esc(l.size)} · ${kr(l.price)} pr. stk.</div>
              <div class="qty">
                <input type="number" min="0" value="${l.qty}"
                       onchange="setQty('${esc(key)}', this.value)">
                <span style="color:var(--ink-soft);font-size:0.85rem;">stk.</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="ci-price">${kr(l.price * l.qty)}</div>
              <button class="remove" onclick="removeLine('${esc(key)}')">Fjern</button>
            </div>
          </div>`; }).join('')}
        <div class="cart-total">
          <span class="lbl">I alt</span>
          <span class="amt">${kr(cartTotal())}</span>
        </div>
        <div style="margin-top:28px; display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn ghost" onclick="go('shop')">Fortsæt med at kigge</button>
          <button class="btn" onclick="go('checkout')">Til bestilling</button>
        </div>`}
    </div>`;
  updateBadge();
}

function renderCheckout() {
  const cart = getCart(), keys = Object.keys(cart);
  if (keys.length === 0) { renderCart(); return; }
  app.innerHTML = `
    <div class="panel reveal">
      <h1>Bestilling</h1>
      <p style="color:var(--ink-soft); margin-bottom:26px;">
        Skriv dit navn og din e-mail, så sender jeg dig en bekræftelse og vender tilbage med
        betaling og levering. Der er ingen online-betaling endnu — vi tager den sammen på mail.
      </p>
      <div id="formErrors"></div>
      <div class="layout-2">
        <div>
          <div class="field">
            <label for="name">Navn</label>
            <input type="text" id="name" required>
          </div>
          <div class="field">
            <label for="email">E-mail</label>
            <input type="email" id="email" required>
          </div>
          <div class="field">
            <label for="note">Besked til Sofie <span style="font-weight:400;color:var(--ink-soft);">(valgfrit)</span></label>
            <textarea id="note" placeholder="Et ønske, et spørgsmål, en hilsen…"></textarea>
          </div>
          <button class="btn full" onclick="checkout()">Send bestilling</button>
        </div>
        <div>
          <div class="panel" style="margin:0; box-shadow:none; border:1px solid var(--line);">
            <h3 style="font-family:'Fraunces',serif; font-size:1.2rem; margin-bottom:16px;">Din ordre</h3>
            ${keys.map(key => { const l = cart[key]; return `
              <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:0.95rem;">
                <span>${esc(l.name)} <span style="color:var(--ink-soft);">(${esc(l.size)} × ${l.qty})</span></span>
                <span style="font-weight:700;">${kr(l.price * l.qty)}</span>
              </div>`; }).join('')}
            <div class="cart-total" style="margin-top:14px; padding-top:14px;">
              <span class="lbl" style="font-size:1.1rem;">I alt</span>
              <span class="amt" style="font-size:1.2rem;">${kr(cartTotal())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ---------- Checkout ------------------------------------------------------
   Lige nu: samler ordren og åbner en færdigskrevet mail til Sofie.
   SENERE (Stripe): i stedet for mailto kalder du her et Stripe Payment Link
   eller Stripe Checkout. Kurvens linjer (getCart) er allerede struktureret,
   så de kan mappes direkte til Stripe line_items.
--------------------------------------------------------------------------- */
function checkout() {
  const name  = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const note  = document.getElementById('note').value.trim();
  const cart  = getCart(), keys = Object.keys(cart);

  const errors = [];
  if (!name) errors.push('Skriv venligst dit navn.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Tjek lige din e-mailadresse.');
  if (!keys.length) errors.push('Din kurv er tom.');

  const box = document.getElementById('formErrors');
  if (errors.length) {
    box.innerHTML = `<div class="errors"><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    window.scrollTo(0, 0);
    return;
  }

  let body = 'Ny bestilling fra Småkunst\n----------------------------------\n\n';
  body += `Navn:   ${name}\nE-mail: ${email}\n\nBestilling:\n`;
  keys.forEach(key => { const l = cart[key];
    body += `  • ${l.name} — ${l.size} × ${l.qty} = ${kr(l.price * l.qty)}\n`; });
  body += `\nI alt: ${kr(cartTotal())}\n`;
  if (note) body += `\nBesked fra kunden:\n${note}\n`;
  body += '\n----------------------------------\n';

  const subject = 'Ny bestilling — ' + name;
  const mailto = `mailto:${CONFIG.ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  localStorage.setItem('smaakunst_lastname', name);
  window.location.href = mailto;
  saveCart({});
  setTimeout(() => go('done'), 400);
}

function renderDone() {
  const name = localStorage.getItem('smaakunst_lastname') || '';
  app.innerHTML = `
    <div class="panel reveal">
      <div class="empty">
        <div style="font-size:3rem; margin-bottom:10px;">🧡</div>
        <h2>Tusind tak${name ? ', ' + esc(name) : ''}!</h2>
        <p style="margin-bottom:8px;">Din mail er klar i dit mailprogram — tryk send, så har jeg din bestilling.</p>
        <p style="margin-bottom:24px; color:var(--ink-soft);">Jeg vender tilbage til dig med betaling og levering så hurtigt, jeg kan. — Sofie</p>
        <button class="btn" onclick="go('shop')">Tilbage til shoppen</button>
      </div>
    </div>`;
  updateBadge();
}

function renderEmptyData() {
  app.innerHTML = `
    <div class="data-warn">
      <strong>Ingen ${SHOP.emptyDataNoun} kunne hentes lige nu.</strong><br>
      Tjek at Google Sheets-API-nøglen er sat korrekt i CONFIG, at arket er delt offentligt (læseadgang),
      og at produkterne har kategorien «${esc(SHOP.category)}» i Products-arket.
    </div>`;
}

/* ---------- Lightbox (forstør produktbillede) ----------------------------- */
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');

function openLightbox(src, alt) {
  lbImg.src = src; lbImg.alt = alt || '';
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
// Klik på baggrund eller luk-knap lukker; klik på selve billedet gør ikke.
lightbox.addEventListener('click', e => { if (e.target !== lbImg) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ---------- Opstart ------------------------------------------------------- */
(async function init() {
  updateBadge();
  try {
    CATALOG = await loadCatalog();
  } catch (err) {
    console.error(err);
    renderEmptyData();
    return;
  }
  window.addEventListener('hashchange', router);
  router();
})();
