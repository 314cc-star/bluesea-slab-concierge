// AI slab concierge: a Gemini agent that searches real stock and
// proposes a PayPal deposit checkout. The customer always approves payment.
import { listSlabs, getSlab } from './store.js';
import { LEGS, FINISHES, quote, optionsGuide, policyGuide } from './options.js';

const API_KEY = process.env.GEMINI_API_KEY || '';
// Free-tier models are sometimes overloaded (503) or out of daily quota (429),
// so fall back through a few models before giving up. Lite models come first:
// they are fast, handle this simple tool use well, and their free quota is larger.
const MODELS = [
  ...new Set([
    process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
  ]),
];
const endpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// 404 too: Google retires older models for new keys.
const RETRYABLE = new Set([404, 429, 500, 503, 504]);
const COOLDOWN_MS = 2 * 60_000;
const coolingUntil = new Map();
const MAX_TOOL_ROUNDS = 5;

export const conciergeConfigured = () => Boolean(API_KEY);

const systemPrompt = (depositRate) => `You are the slab concierge for Blue Sea Wood, a family wood-slab maker in Phrae, Thailand.
Customers tell you about their room and what they want to build; you find the right solid Suar (Monkey Pod / Rain Tree) slab from current stock.

How Blue Sea Wood works:
- Every slab is one solid piece (no joined boards), kiln-dried, cut, sanded and finished, ready as a tabletop. Legs are sold separately (wooden or steel).
- Edge styles: live edge (both natural edges), single straight edge (one straight side for walls), straight edge (rectangular), round.
- Custom cutting to size is possible; reference prices: 60x150x5 cm 5,700 THB, 80x200x5 cm 13,200 THB, 90x250x7.5 cm 32,000 THB, 100x300x7.5 cm 40,000 THB, round 80 cm 6,000 THB.
- Ordering: the customer picks a real slab, pays a ${Math.round(depositRate * 100)}% deposit to reserve it, and pays the balance before shipping. Production starts 3 days after the deposit (the free-cancellation window) and takes about 14 days.
${policyGuide()}
  If a slab has a natural crack, reassure the customer: we fit wooden bow ties and the table has a lifetime free repair warranty.
${optionsGuide()}
  Suggest legs and a finish that suit the customer's use (e.g. polyurethane for busy family tables, ultra-matte for a light raw look, food-grade oil for food contact). Slabs over 3 m may need a middle support; mention we will advise.
- Care: wipe with a soft damp cloth, avoid standing water, hot pots and dragging sharp objects.

Stock notes: live-edge slabs are measured at both ends and the middle (widths_cm), so width_cm is the widest middle point. Stock photos show raw slabs before sanding; the oil finish makes the colour richer and darker. Slabs can be cut shorter or trimmed to a straight edge for a custom size.

Sizing guide: allow about 60 cm of table length per seated person; dining tables are usually 80-100 cm wide; desks 60-80 cm deep; leave about 90 cm around a dining table for chairs.

Rules:
- Always call search_slabs before recommending; only recommend slabs it returns, by their ID. Never invent stock, prices or IDs.
- Recommend at most 3 slabs and say briefly why each fits (size, edge, tone).
- If nothing fits, say so and offer a custom cut using the reference prices.
- When the customer clearly wants a specific slab, call start_checkout with its ID. You cannot take payment yourself; the customer confirms in PayPal.
- Language: always reply in English.
- Keep replies short and warm, like a helpful shop owner.`;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'search_slabs',
        description: 'Search available slabs in stock. All filters are optional. Sizes are in centimetres, price in THB.',
        parameters: {
          type: 'object',
          properties: {
            min_length_cm: { type: 'number' },
            max_length_cm: { type: 'number' },
            min_width_cm: { type: 'number' },
            max_width_cm: { type: 'number' },
            edge: { type: 'string', enum: ['live edge', 'single straight edge', 'straight edge', 'round'] },
            max_price_thb: { type: 'number' },
          },
        },
      },
      {
        name: 'start_checkout',
        description:
          'Show the customer the checkout for one slab with their chosen legs and finish, and a PayPal button for the deposit. Use only after the customer chooses a slab. If they have not chosen legs or finish, leave them out; they can still change both in the checkout.',
        parameters: {
          type: 'object',
          properties: {
            slab_id: { type: 'string' },
            legs: { type: 'string', enum: Object.keys(LEGS) },
            finish: { type: 'string', enum: Object.keys(FINISHES) },
          },
          required: ['slab_id'],
        },
      },
    ],
  },
];

async function searchSlabs(args) {
  const slabs = await listSlabs();
  return slabs
    .filter((s) => s.status === 'available')
    .filter((s) => args.min_length_cm == null || s.length_cm >= args.min_length_cm)
    .filter((s) => args.max_length_cm == null || s.length_cm <= args.max_length_cm)
    .filter((s) => args.min_width_cm == null || s.width_cm >= args.min_width_cm)
    .filter((s) => args.max_width_cm == null || s.width_cm <= args.max_width_cm)
    .filter((s) => !args.edge || s.edge === args.edge)
    .filter((s) => args.max_price_thb == null || s.price_thb <= args.max_price_thb)
    .map(({ id, length_cm, width_cm, widths_cm, thickness_cm, edge, tone, figure, best_for, price_thb }) => ({
      id, length_cm, width_cm, widths_cm, thickness_cm, edge, tone, figure, best_for, price_thb,
      free_shipping: true,
    }));
}

function gemini(contents, depositRate) {
  return generate({
    systemInstruction: { parts: [{ text: systemPrompt(depositRate) }] },
    contents,
    tools,
    // Low thinking keeps chat replies fast; the task is simple tool use.
    generationConfig: { temperature: 0.6, thinkingConfig: { thinkingLevel: 'low' } },
  });
}

// Any Gemini request, with model fallback. Returns the first candidate's content.
export async function generate(payload, { models = MODELS, timeoutMs = 20_000 } = {}) {
  const body = JSON.stringify(payload);
  // Skip models that failed recently; if all are cooling down, try them anyway.
  const ready = models.filter((m) => !(coolingUntil.get(m) > Date.now()));
  let lastError = new Error('No Gemini model available');
  // One model at a time: asking several in parallel burns the small free quota.
  for (const model of ready.length ? ready : models) {
    try {
      return await askModel(model, body, timeoutMs);
    } catch (err) {
      lastError = err;
      if (err.fatal) break;
    }
  }
  throw lastError;
}

// Google says how long to wait (e.g. "67684s" when the daily quota is gone).
function retryDelayMs(json) {
  const info = json.error?.details?.find((d) => d.retryDelay);
  const seconds = parseFloat(info?.retryDelay);
  return Number.isFinite(seconds) ? seconds * 1000 : COOLDOWN_MS;
}

async function askModel(model, body, timeoutMs) {
  let res;
  try {
    res = await fetch(endpoint(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    coolingUntil.set(model, Date.now() + COOLDOWN_MS);
    console.warn(`Gemini ${model} did not answer (${err.name})`);
    throw new Error(`Gemini ${model} did not answer`);
  }
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    const content = json.candidates?.[0]?.content;
    if (content?.parts) return content;
    throw new Error(`Gemini ${model} returned no content`);
  }
  const error = new Error(`Gemini ${model} ${res.status}: ${json.error?.message || res.statusText}`);
  if (res.status === 429) error.quota = true;
  if (RETRYABLE.has(res.status)) {
    coolingUntil.set(model, Date.now() + (res.status === 429 ? retryDelayMs(json) : COOLDOWN_MS));
    console.warn(error.message.split('\n')[0]);
  } else {
    error.fatal = true; // e.g. bad key: no point trying other models
  }
  throw error;
}

// history: Gemini `contents` from earlier turns (returned to the client and sent back).
export async function converse({ history, message, depositRate }) {
  // Small models drift into Thai because the shop is Thai; pin English on every turn.
  const contents = [...history, { role: 'user', parts: [{ text: message }, { text: '(Reply in English.)' }] }];
  const suggested = new Set();
  let checkout = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await gemini(contents, depositRate);
    contents.push({ role: 'model', parts: reply.parts });

    const calls = reply.parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const text = reply.parts.map((p) => p.text || '').join('').trim();
      return { reply: text, history: contents, suggestedSlabIds: [...suggested], checkout };
    }

    const responses = [];
    for (const { functionCall } of calls) {
      const args = functionCall.args || {};
      let result;
      if (functionCall.name === 'search_slabs') {
        const found = await searchSlabs(args);
        found.slice(0, 3).forEach((s) => suggested.add(s.id));
        result = { slabs: found };
      } else if (functionCall.name === 'start_checkout') {
        const slab = await getSlab(args.slab_id);
        if (!slab) result = { ok: false, error: 'No slab with that ID.' };
        else if (slab.status !== 'available') result = { ok: false, error: 'That slab is already reserved.' };
        else {
          const q = quote(slab, args, depositRate);
          checkout = { slabId: slab.id, legs: q.legs, finish: q.finish };
          result = {
            ok: true,
            note: 'The checkout with a PayPal deposit button is now shown to the customer; they can still change legs and finish there.',
            chosen: q.summary,
            slab_thb: q.slabPrice,
            legs_thb: q.legsPrice,
            total_thb: q.total,
            deposit_thb: q.deposit,
            balance_thb: q.balance,
          };
        }
      } else {
        result = { error: `Unknown tool ${functionCall.name}` };
      }
      responses.push({ functionResponse: { name: functionCall.name, response: result } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return {
    reply: 'Sorry, I got a bit lost. Could you tell me the size you need again?',
    history: contents,
    suggestedSlabIds: [...suggested],
    checkout,
  };
}
