/* ============================================================================
   Småkunst — delt datalag
   Google Sheet-konfiguration + hentning/parsing af produkter. Indlæses FØR
   shop.js på produktsiderne, og på forsiden (index.html) før home.js.
   Eneste sted hvor Sheet-ID, API-nøgle, valuta og ejer-mail bor.
============================================================================ */

/* ---------- Konfiguration ------------------------------------------------- */
const CONFIG = {
  sheetId:    '1xRqlwRXiyKWymnxP4s28IGXDTa-2-E-LlOW9wGtlaI8',
  apiKey:     'AIzaSyArsm9StOFP-nEvR27RAmPD7NjS7WWETxk',          // <- indsæt din Google Sheets API-nøgle
  ownerEmail: 'nikolaj@smaakunst.dk',         // <- din mailadresse
  currency:   'kr.',
};

/* ---------- Hjælpere ------------------------------------------------------ */
const kr = n => new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' ' + CONFIG.currency;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------- Datahentning -------------------------------------------------- */
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

/* Henter ALLE tilgængelige produkter (alle kategorier) med varianter,
   laveste pris, miniature og kategori. Filtrering pr. side sker hos kalderen. */
async function loadProducts() {
  const [products, variants] = await Promise.all([fetchTab('Products'), fetchTab('Variants')]);

  const byProduct = {};
  variants.forEach(v => {
    if (!v.product_id) return;
    v.price = parseFloat(String(v.price).replace(',', '.')) || 0;
    (byProduct[v.product_id] ||= []).push(v);
  });

  const out = [];
  products.forEach(p => {
    if (String(p.available).toUpperCase() !== 'TRUE') return;
    const vs = byProduct[p.id]; if (!vs || !vs.length) return;
    vs.sort((a, b) => a.price - b.price);
    out.push({
      id: p.id, name: p.name || '', description: p.description || '',
      category: String(p.category || '').toLowerCase(),
      variants: vs, min_price: vs[0].price, thumb: vs[0].image_url || '',
    });
  });
  return out;
}
