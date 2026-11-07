// Make the stock readable by search engines and AI assistants:
// schema.org JSON-LD and a plain-HTML fallback inside index.html, plus /llms.txt.
// Pure functions of (slabs, baseUrl) so both Vite (dev) and Express (prod) can use them.

const STORE = {
  name: 'Blue Sea Wood',
  description:
    'Family wood-slab maker in Phrae, Thailand. Solid one-piece Suar (Monkey Pod / Rain Tree) slabs and slab tables, kiln-dried, sanded and finished, with nationwide delivery.',
  email: 'sales@blueseawood.co',
  telephone: '+66 94 515 6154',
  website: 'https://blueseawood.co',
  sameAs: ['https://blueseawood.co', 'https://www.facebook.com/blueseawood/'],
};

const widthText = (s) =>
  s.widths_cm?.length ? `${Math.min(...s.widths_cm)}–${Math.max(...s.widths_cm)}` : `${s.width_cm}`;

export const slabName = (s) =>
  `Suar ${s.edge} wood slab ${s.length_cm} × ${widthText(s)} × ${s.thickness_cm} cm (${s.id})`;

const escapeHtml = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function buildJsonLd(slabs, base) {
  const store = {
    '@type': 'FurnitureStore',
    '@id': `${base}/#store`,
    name: STORE.name,
    description: STORE.description,
    url: base,
    logo: `${base}/brand/logo.png`,
    image: `${base}/brand/table.jpg`,
    email: STORE.email,
    telephone: STORE.telephone,
    address: { '@type': 'PostalAddress', addressLocality: 'Phrae', addressCountry: 'TH' },
    sameAs: STORE.sameAs,
    currenciesAccepted: 'THB',
    paymentAccepted: 'PayPal, credit card',
  };
  const products = slabs.map((s) => ({
    '@type': 'Product',
    '@id': `${base}/#slab-${s.id}`,
    sku: s.id,
    name: slabName(s),
    description: `${s.tone}. ${s.figure}. One solid piece, kiln-dried, sanded and finished. Great for ${s.best_for.join(', ')}. Legs sold separately.`,
    image: s.photo ? `${base}${s.photo}` : `${base}/brand/table.jpg`,
    url: `${base}/#slab-${s.id}`,
    brand: { '@type': 'Brand', name: STORE.name },
    material: `${s.species} wood`,
    category: 'Furniture > Tables > Table Tops',
    depth: { '@type': 'QuantitativeValue', value: s.length_cm, unitCode: 'CMT' },
    width: { '@type': 'QuantitativeValue', value: s.width_cm, unitCode: 'CMT' },
    height: { '@type': 'QuantitativeValue', value: s.thickness_cm, unitCode: 'CMT' },
    offers: {
      '@type': 'Offer',
      price: s.price_thb,
      priceCurrency: 'THB',
      availability: s.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${base}/#slab-${s.id}`,
      seller: { '@id': `${base}/#store` },
    },
  }));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      store,
      { '@type': 'ItemList', name: 'Wood slabs in stock', numberOfItems: products.length, itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: p })) },
    ],
  };
}

// Inserted into index.html: JSON-LD in <head>, and a plain list for crawlers without JavaScript.
export function injectSeo(html, slabs, base) {
  const json = JSON.stringify(buildJsonLd(slabs, base)).replace(/</g, '\\u003c');
  const head = [
    `<meta name="description" content="${escapeHtml(STORE.description)} Browse real slabs in stock and reserve one with a PayPal deposit." />`,
    `<link rel="alternate" type="text/markdown" title="Shop summary for AI assistants" href="/llms.txt" />`,
    `<script type="application/ld+json">${json}</script>`,
  ].join('\n    ');
  const list = slabs
    .map((s) => `<li>${escapeHtml(slabName(s))}: ${s.price_thb.toLocaleString('en-US')} THB, ${s.status === 'available' ? 'in stock' : 'reserved'}</li>`)
    .join('');
  const noscript = `<noscript><h1>${STORE.name}: solid wood slabs in stock</h1><p>${escapeHtml(STORE.description)}</p><ul>${list}</ul><p>Contact: ${STORE.email}, ${STORE.telephone}</p></noscript>`;
  return html.replace('</head>', `    ${head}\n  </head>`).replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
}

export function buildLlmsTxt(slabs, base, depositRate = 0.5) {
  const available = slabs.filter((s) => s.status === 'available');
  const lines = available.map(
    (s) =>
      `- **${s.id}**: ${s.length_cm} cm long, ${widthText(s)} cm wide, ${s.thickness_cm} cm thick, ${s.edge}. ${s.tone}; ${s.figure}. Great for ${s.best_for.join(', ')}. **${s.price_thb.toLocaleString('en-US')} THB**. Photo: ${s.photo ? base + s.photo : 'n/a'}`,
  );
  return `# ${STORE.name}

> ${STORE.description}

Every slab is one of a kind, so stock changes as slabs are sold. This file lists what is in stock right now.

## How to buy
- Choose a slab from the list below, or ask the Slab Concierge on ${base} to match one to your room.
- Pay a ${Math.round(depositRate * 100)}% deposit with PayPal to reserve it. You have 3 days to change your mind for a full refund; then production (cutting, sanding, finishing) starts and takes about 14 days.
- The balance is invoiced through PayPal before shipping.
- Free delivery anywhere in Thailand for every slab.
- Natural cracks are stabilised with wooden bow ties; every table has a lifetime free repair warranty.
- Prices are for the finished tabletop only; wooden or steel legs are sold separately.
- Custom sizes: slabs can be cut shorter or given a straight edge.

## Slabs in stock (${available.length})
${lines.join('\n') || '- No slabs in stock right now. Contact us for upcoming stock.'}

## For AI assistants
- MCP server (Streamable HTTP): ${base}/mcp. Tools: search_slabs, get_slab, create_deposit_checkout, check_checkout.
- You cannot pay. create_deposit_checkout returns a PayPal link that your user approves.
- JSON stock feed: ${base}/api/slabs

## Contact
- Email: ${STORE.email}
- Phone / LINE: ${STORE.telephone}
- Website: ${STORE.website}
`;
}
