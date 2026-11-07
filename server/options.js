// Table options: legs and finish. Prices live here, on the server, so the
// deposit is always computed from trusted numbers.

export const LEGS = {
  none: { label: 'No legs (tabletop only)' },
  steel: { label: 'Steel legs (1 pair)' },
  wood: { label: 'Wooden legs (1 pair)' },
};

// Steel and wooden legs cost the same: 2,500 THB a pair for slabs up to 70 cm
// wide, 3,000 THB for wider slabs.
export const legPrice = (slab, legs) => (legs === 'none' ? 0 : slab.width_cm <= 70 ? 2500 : 3000);

// From blueseawood.co/en/wood-finish. Matte lacquer is the standard finish;
// no finish adds to the price.
export const FINISHES = {
  lacquer: {
    label: 'Matte lacquer (standard)',
    note: 'Enhances colour and grain, smooth surface. Best for indoor dining tables and desks.',
    image: '/brand/finish/lacquer.jpg',
  },
  polyurethane: {
    label: 'Polyurethane',
    note: 'Durable, better moisture resistance. Best for busy tabletops.',
    image: '/brand/finish/polyurethane.jpg',
  },
  teak_oil: {
    label: 'Teak oil',
    note: 'Natural matte oiled look; needs re-oiling from time to time.',
    image: '/brand/finish/teak-oil.jpg',
  },
  natural_oil: {
    label: 'Natural oil (food grade)',
    note: 'Oil finish suitable for food contact; needs some care.',
    image: '/brand/finish/natural-oil.webp',
  },
  ultra_matte: {
    label: 'Ultra-matte raw natural',
    note: 'Keeps the light, raw-wood look with almost no sheen.',
    image: '/brand/finish/ultra-matte.webp',
  },
};

export const DEFAULT_CHOICE = { legs: 'none', finish: 'lacquer' };

// Shop promises, shown to customers and given to the AI agents.
export const CANCEL_DAYS = 3;
export const POLICY_LINES = [
  'Free delivery anywhere in Thailand for every slab.',
  `The deposit reserves the slab for ${CANCEL_DAYS} days: change your mind in that time and we refund it in full. Production starts after the ${CANCEL_DAYS} days and takes about 14 days.`,
  'Natural cracks are stabilised with hand-fitted wooden bow ties (butterfly keys) at no extra cost.',
  'Lifetime free repair warranty on every table.',
];
export const policyGuide = () => `Shop promises:\n${POLICY_LINES.map((l) => `- ${l}`).join('\n')}`;
export const CONTACT = {
  line: 'https://line.me/R/ti/p/@blueseawood',
  whatsapp: 'https://wa.me/66614702555',
  email: 'sales@blueseawood.co',
};

export function normalizeChoice(choice = {}) {
  return {
    legs: LEGS[choice.legs] ? choice.legs : DEFAULT_CHOICE.legs,
    finish: FINISHES[choice.finish] ? choice.finish : DEFAULT_CHOICE.finish,
  };
}

export function quote(slab, choice, depositRate) {
  const { legs, finish } = normalizeChoice(choice);
  const legsPrice = legPrice(slab, legs);
  const total = slab.price_thb + legsPrice;
  const deposit = Math.round(total * depositRate);
  return {
    legs,
    finish,
    slabPrice: slab.price_thb,
    legsPrice,
    total,
    deposit,
    balance: total - deposit,
    summary: `${LEGS[legs].label}, ${FINISHES[finish].label}`,
  };
}

// Options travel with the PayPal order as custom_id (max 127 chars), e.g. "BSW-177|steel|lacquer".
export const encodeChoice = (slabId, { legs, finish }) => `${slabId}|${legs}|${finish}`;
export function decodeChoice(customId) {
  const [slabId, legs, finish] = String(customId || '').split('|');
  return { slabId, ...normalizeChoice({ legs, finish }) };
}

export const optionsForClient = () => ({
  legs: Object.entries(LEGS).map(([id, v]) => ({ id, ...v })),
  finishes: Object.entries(FINISHES).map(([id, v]) => ({ id, ...v })),
});

// Plain-text price guide for the AI concierge and MCP instructions.
export const optionsGuide = () =>
  `Table options (chosen at checkout):
- Legs: none (tabletop only), steel or wooden, 1 pair. Steel and wood cost the same: 2,500 THB for slabs up to 70 cm wide, 3,000 THB for wider slabs.
- Finish (no extra cost): ${Object.entries(FINISHES).map(([id, f]) => `${id} = ${f.label}: ${f.note}`).join(' ')}
- The deposit is 50% of slab + legs.`;
