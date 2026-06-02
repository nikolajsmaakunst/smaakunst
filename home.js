/* ============================================================================
   Småkunst — forside
   Viser en række pr. kategori med et lille, tilfældigt udvalg af produkter.
   Forudsætter at catalog.js er indlæst først (loadProducts, kr, esc).
   Hver kategori peger på sin egen shop-side; kortene linker direkte til
   produktet via hash (fx plakater.html#product/<id>).
============================================================================ */

const HOME_CATEGORIES = [
  { label: 'Plakater', category: 'plakat',  page: 'plakater.html', includeUncategorized: true,  seeAll: 'Se alle plakater' },
  { label: 'Keramik',  category: 'keramik', page: 'keramik.html',  includeUncategorized: false, seeAll: 'Se al keramik' },
];
const SHOWCASE_COUNT = 4;

const home = document.getElementById('home');

function syncBadge() {
  try {
    const cart = JSON.parse(localStorage.getItem('smaakunst_cart')) || {};
    const count = Object.values(cart).reduce((n, l) => n + l.qty, 0);
    const badge = document.getElementById('cartBadge');
    if (count > 0 && badge) { badge.textContent = count; badge.style.display = 'inline-flex'; }
  } catch (e) {}
}

// Fisher–Yates: tilfældig rækkefølge uden at mutere originalen.
function pickRandom(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function cardHTML(page, p) {
  return `
    <a class="card" href="${page}#product/${esc(p.id)}">
      <div class="thumb">
        ${p.thumb ? `<img src="${esc(p.thumb)}" alt="${esc(p.name)}" loading="lazy">`
                  : `<span class="ph">Billede på vej</span>`}
      </div>
      <div class="body">
        <h3>${esc(p.name)}</h3>
        <div class="price"><small>fra</small> ${kr(p.min_price)}</div>
      </div>
    </a>`;
}

function sectionHTML(cat, products) {
  const picks = pickRandom(products, SHOWCASE_COUNT);
  const body = picks.length
    ? `<div class="showcase">${picks.map(p => cardHTML(cat.page, p)).join('')}</div>`
    : `<p class="showcase-empty">Kommer snart — kig forbi igen.</p>`;
  return `
    <section class="cat-section reveal">
      <div class="cat-head">
        <h2>${esc(cat.label)}</h2>
        <a class="cat-seeall" href="${cat.page}">${esc(cat.seeAll)} →</a>
      </div>
      ${body}
    </section>`;
}

(async function init() {
  syncBadge();
  let products = [];
  try {
    products = await loadProducts();
  } catch (err) {
    console.error(err);
    // Vis stadig rækkerne (tomme) så indgangene til siderne bevares.
  }
  home.innerHTML = HOME_CATEGORIES.map(cat => {
    const items = products.filter(p =>
      p.category === cat.category || (!p.category && cat.includeUncategorized));
    return sectionHTML(cat, items);
  }).join('');
})();
