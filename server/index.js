import './secrets.js'; // must stay first: fills process.env from Render secret files
import express from 'express';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  listSlabs, getSlab, setSlabStatus, addOrder, listOrders, updateSlab, updateOrder, addSlab, releaseReservationsOlderThan,
} from './store.js';
import { writeListing } from './listing.js';
import {
  paypalConfigured, paypalClientId, createDepositOrder, captureOrder, sendBalanceInvoice, refundCapture,
} from './paypal.js';
import { conciergeConfigured, converse } from './concierge.js';
import { visualize, checkLimit } from './visualize.js';
import { mountMcp } from './mcp.js';
import { injectSeo, buildLlmsTxt } from './seo.js';
import {
  LEGS, FINISHES, quote, legPrice, encodeChoice, decodeChoice, cleanContact, optionsForClient, POLICY_LINES, CANCEL_DAYS,
  CONTACT,
} from './options.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENCY = process.env.CURRENCY || 'THB';
const DEPOSIT_RATE = Number(process.env.DEPOSIT_RATE || 0.5);

// Deposit is always computed on the server from stored prices (slab + legs).
const depositFor = (slab, choice) => quote(slab, choice, DEPOSIT_RATE).deposit;
// Blue Sea Wood ships every slab free anywhere in Thailand.
const freeShipping = () => true;

// Public demo (hackathon judges): test reservations are released after a while
// so the shop never runs out of slabs. Off unless DEMO_MODE=true.
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_RELEASE_MINUTES = Number(process.env.DEMO_RELEASE_MINUTES || 30);
if (DEMO_MODE) {
  const sweep = () =>
    releaseReservationsOlderThan(DEMO_RELEASE_MINUTES * 60_000)
      .then((ids) => ids.length && console.log(`Demo mode: released ${ids.join(', ')}`))
      .catch((err) => console.error('Demo sweep failed', err));
  setInterval(sweep, 60_000).unref();
  sweep();
}
// "See it in your room" needs a paid Gemini image model; hidden until switched on.
const ROOM_PREVIEW = process.env.ROOM_PREVIEW === 'true';
// Rough guide for overseas visitors only; payments are always in THB.
const USD_PER_THB = Number(process.env.USD_PER_THB || 0.03);

const app = express();
// Small JSON bodies everywhere except the photo uploads, which parse their own.
const smallJson = express.json();
const PHOTO_ROUTES = new Set(['/api/admin/listing', '/api/admin/slabs', '/api/visualize']);
app.set('trust proxy', 1); // behind Render's proxy: req.ip is the visitor
app.use((req, res, next) => (req.method === 'POST' && PHOTO_ROUTES.has(req.path) ? next() : smallJson(req, res, next)));

app.get('/api/config', (_req, res) => {
  res.json({
    currency: CURRENCY,
    depositRate: DEPOSIT_RATE,
    paypal: paypalConfigured() ? { clientId: paypalClientId() } : null,
    concierge: conciergeConfigured(),
    options: optionsForClient(),
    policy: POLICY_LINES,
    cancelDays: CANCEL_DAYS,
    contact: CONTACT,
    demo: DEMO_MODE ? { releaseMinutes: DEMO_RELEASE_MINUTES } : null,
    roomPreview: ROOM_PREVIEW && conciergeConfigured(),
    usdPerThb: USD_PER_THB,
  });
});

app.get('/api/slabs', async (_req, res) => {
  const slabs = await listSlabs();
  res.json(
    slabs.map((s) => ({ ...s, deposit: depositFor(s), leg_price_thb: legPrice(s, 'steel'), free_shipping: freeShipping(s) })),
  );
});

// Price for a slab with chosen legs and finish (shown live in the reserve dialog).
app.get('/api/quote', async (req, res) => {
  const slab = await getSlab(req.query.slabId);
  if (!slab) return res.status(404).json({ error: 'Slab not found.' });
  res.json(quote(slab, { legs: req.query.legs, finish: req.query.finish }, DEPOSIT_RATE));
});

app.post('/api/concierge', async (req, res) => {
  if (!conciergeConfigured()) {
    return res.status(503).json({ error: 'The AI concierge needs a Gemini API key in .env (GEMINI_API_KEY).' });
  }
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-40) : [];
  const message = String(req.body?.message || '').slice(0, 2000).trim();
  if (!message) return res.status(400).json({ error: 'Please type a message.' });
  try {
    res.json(await converse({ history, message, depositRate: DEPOSIT_RATE }));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'The concierge could not answer just now. Please try again.' });
  }
});

app.post('/api/orders', async (req, res) => {
  if (!paypalConfigured()) return res.status(503).json({ error: 'PayPal sandbox keys are not set up yet.' });
  const slab = await getSlab(req.body?.slabId);
  if (!slab) return res.status(404).json({ error: 'Slab not found.' });
  if (slab.status !== 'available') return res.status(409).json({ error: 'Sorry, this slab was just reserved.' });
  if (cleanContact(req.body?.contact).length < 4) {
    return res.status(400).json({ error: 'Please add a phone number or LINE ID so we can arrange delivery.' });
  }
  try {
    const q = quote(slab, req.body, DEPOSIT_RATE);
    const order = await createDepositOrder({
      slab,
      amount: q.deposit,
      currency: CURRENCY,
      customId: encodeChoice(slab.id, { ...q, contact: req.body?.contact }),
      summary: q.summary,
    });
    res.json({ id: order.id });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not start the PayPal payment.' });
  }
});

// PayPal's shipping block as one readable line for the owner and the customer.
function formatShipping(shipping) {
  const a = shipping?.address;
  if (!a) return null;
  return {
    name: shipping.name?.full_name || '',
    address: [a.address_line_1, a.address_line_2, a.admin_area_2, a.admin_area_1, a.postal_code, a.country_code]
      .filter(Boolean)
      .join(', '),
  };
}

// Capture an approved deposit, reserve the slab and save the order.
// Safe to call twice for the same order (page reloads, double clicks).
const inFlight = new Map();
function completeDeposit(orderId) {
  if (!inFlight.has(orderId)) {
    inFlight.set(
      orderId,
      (async () => {
        const existing = (await listOrders()).find((o) => o.id === orderId);
        if (existing) return { order: existing, slab: await getSlab(existing.slabId) };
        const result = await captureOrder(orderId);
        const unit = result.purchase_units?.[0];
        const capture = unit?.payments?.captures?.[0];
        if (result.status !== 'COMPLETED' || !capture) {
          throw Object.assign(new Error('Payment was not completed.'), { status: 402 });
        }
        const slabId = unit.reference_id;
        const choice = decodeChoice(capture.custom_id || unit.custom_id);
        await setSlabStatus(slabId, 'reserved');
        const slab = await getSlab(slabId);
        const q = quote(slab, choice, DEPOSIT_RATE);
        const deposit = Number(capture.amount.value); // what was actually paid
        const order = await addOrder({
          id: result.id,
          slabId,
          captureId: capture.id,
          legs: q.legs,
          legsLabel: LEGS[q.legs].label,
          finish: q.finish,
          finishLabel: FINISHES[q.finish].label,
          slabPrice: q.slabPrice,
          legsPrice: q.legsPrice,
          total: q.total,
          deposit,
          currency: capture.amount.currency_code,
          balance: q.total - deposit,
          buyerName: [result.payer?.name?.given_name, result.payer?.name?.surname].filter(Boolean).join(' '),
          payerEmail: result.payer?.email_address || null,
          contact: choice.contact || null, // phone or LINE ID from our checkout
          shipTo: formatShipping(unit.shipping), // delivery address chosen in PayPal
          createdAt: new Date().toISOString(),
          status: 'deposit_paid',
        });
        return { order, slab };
      })().finally(() => setTimeout(() => inFlight.delete(orderId), 60_000)),
    );
  }
  return inFlight.get(orderId);
}

app.post('/api/orders/:id/capture', async (req, res) => {
  try {
    res.json(await completeDeposit(req.params.id));
  } catch (err) {
    console.error(err.message);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Could not confirm the PayPal payment.' });
  }
});

// Public order status (no personal data) for the checkout return page and agents.
app.get('/api/orders/:id/status', async (req, res) => {
  const order = (await listOrders()).find((o) => o.id === req.params.id);
  if (!order) return res.json({ paid: false });
  res.json({ paid: true, slabId: order.slabId, deposit: order.deposit, balance: order.balance, currency: order.currency });
});

// Model Context Protocol endpoint: lets outside AI assistants shop this store.
const publicUrl = (req) =>
  process.env.PUBLIC_URL || (process.argv.includes('--dev') ? 'http://localhost:5173' : `${req.protocol}://${req.get('host')}`);
mountMcp(app, {
  publicUrl,
  depositFor,
  freeShipping,
  currency: CURRENCY,
  depositRate: DEPOSIT_RATE,
  paypalReady: paypalConfigured,
  completeDeposit,
});

// ---- Owner dashboard API -------------------------------------------------
// Set ADMIN_KEY in .env to lock these routes; the dashboard asks for it once.
const requireOwner = (req, res, next) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.get('x-admin-key') === key) return next();
  res.status(401).json({ error: 'Owner key required.' });
};

app.get('/api/admin/orders', requireOwner, async (_req, res) => res.json(await listOrders()));

app.patch('/api/admin/slabs/:id', requireOwner, async (req, res) => {
  try {
    res.json(await updateSlab(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Photos arrive as data URLs from the owner's phone (resized in the browser).
const bigJson = express.json({ limit: '8mb' });
const EDGE_TYPES = ['live edge', 'single straight edge', 'straight edge', 'round'];

function parsePhoto(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 6 * 1024 * 1024) return null;
  return { ext: m[1] === 'jpeg' ? 'jpg' : m[1], mimeType: `image/${m[1]}`, base64: m[2], buffer };
}

function parseDetails(d = {}) {
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const details = {
    width_cm: num(d.width_cm),
    length_cm: num(d.length_cm),
    thickness_cm: num(d.thickness_cm),
    edge: EDGE_TYPES.includes(d.edge) ? d.edge : null,
    price_thb: num(d.price_thb),
  };
  return Object.values(details).every((v) => v != null) ? details : null;
}

// Customer uploads a room photo; Gemini shows the chosen slab as a table in it.
app.post('/api/visualize', bigJson, async (req, res) => {
  const photo = parsePhoto(req.body?.image);
  if (!photo) return res.status(400).json({ error: 'Please add a JPEG, PNG or WebP photo of your room.' });
  const slab = await getSlab(req.body?.slabId);
  if (!slab) return res.status(404).json({ error: 'Slab not found.' });
  if (!ROOM_PREVIEW || !conciergeConfigured()) return res.status(503).json({ error: 'Room previews are not set up yet.' });
  const limited = checkLimit(req.ip);
  if (limited) return res.status(429).json({ error: limited });
  try {
    const choice = { legs: req.body?.legs, finish: req.body?.finish };
    res.json({ image: await visualize({ roomBase64: photo.base64, roomMime: photo.mimeType, slab, choice }) });
  } catch (err) {
    console.error(err.message.split('\n')[0]);
    res.status(err.quota ? 503 : 502).json({
      error: err.quota
        ? 'Room previews are not available right now (image quota). Please try again later.'
        : 'We could not create the preview just now. Please try another photo.',
    });
  }
});

app.post('/api/admin/listing', requireOwner, bigJson, async (req, res) => {
  const photo = parsePhoto(req.body?.image);
  const details = parseDetails(req.body?.details);
  if (!photo) return res.status(400).json({ error: 'Please add a JPEG, PNG or WebP photo under 6 MB.' });
  if (!details) return res.status(400).json({ error: 'Please fill in width, length, thickness, edge and price.' });
  if (!conciergeConfigured()) return res.status(503).json({ error: 'Add a Gemini API key to use the listing writer.' });
  try {
    res.json(await writeListing({ imageBase64: photo.base64, mimeType: photo.mimeType, details }));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'The AI could not write the listing just now. Please try again.' });
  }
});

app.post('/api/admin/slabs', requireOwner, bigJson, async (req, res) => {
  const photo = parsePhoto(req.body?.image);
  const details = parseDetails(req.body?.details);
  const l = req.body?.listing || {};
  const text = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
  if (!photo || !details) return res.status(400).json({ error: 'Photo and full details are required.' });
  const slab = await addSlab(
    {
      ...details,
      tone: text(l.tone, 200) || 'natural Suar tones',
      figure: text(l.figure, 200) || 'one solid piece',
      best_for: Array.isArray(l.best_for) ? l.best_for.slice(0, 4).map((s) => text(s, 60)) : [],
      listing: {
        title_en: text(l.title_en, 200),
        description_en: text(l.description_en),
        hashtags: Array.isArray(l.hashtags) ? l.hashtags.slice(0, 12).map((s) => text(s, 40)) : [],
      },
    },
    photo,
  );
  res.status(201).json(slab);
});

// Customer changed their mind: refund the deposit in full and put the slab back on sale.
app.post('/api/admin/orders/:id/refund', requireOwner, async (req, res) => {
  const order = (await listOrders()).find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'refunded') return res.status(409).json({ error: 'This deposit was already refunded.' });
  if (order.invoiceId) return res.status(409).json({ error: 'The balance invoice was already sent; cancel it in PayPal first.' });
  try {
    const refund = await refundCapture(order.captureId);
    await setSlabStatus(order.slabId, 'available');
    res.json(
      await updateOrder(order.id, { status: 'refunded', refundId: refund.id, refundedAt: new Date().toISOString() }),
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/admin/orders/:id/invoice', requireOwner, async (req, res) => {
  const order = (await listOrders()).find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.invoiceId) return res.status(409).json({ error: 'Balance invoice already sent.' });
  if (!order.payerEmail) return res.status(400).json({ error: 'No customer email on this order.' });
  try {
    const slab = await getSlab(order.slabId);
    const invoice = await sendBalanceInvoice({ order, slab });
    res.json(
      await updateOrder(order.id, {
        status: 'balance_invoiced',
        invoiceId: invoice.id,
        invoicedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.use('/photos', express.static(path.join(ROOT, 'data', 'photos')));

// For AI assistants and crawlers: a live shop summary, and permission to read it.
app.get('/llms.txt', async (req, res) => {
  res.type('text/markdown; charset=utf-8').send(buildLlmsTxt(await listSlabs(), publicUrl(req), DEPOSIT_RATE));
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /owner\nDisallow: /api/admin/\n\n# Shop summary for AI assistants: ${publicUrl(req)}/llms.txt\n`);
});

// In production, serve the built client. index.html gets live product data
// (schema.org JSON-LD + a no-JavaScript list) so search engines and AI can read the stock.
const dist = path.join(ROOT, 'dist');
if (existsSync(dist)) {
  const template = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const sendPage = async (req, res) => res.type('html').send(injectSeo(template, await listSlabs(), publicUrl(req)));
  app.get('/', sendPage);
  app.use(express.static(dist, { index: false }));
  app.get('/{*splat}', sendPage);
}

// In dev the Vite proxy expects the API on 3001, whatever PORT the shell has.
const port = process.argv.includes('--dev') ? 3001 : Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API on http://localhost:${port} (PayPal ${paypalConfigured() ? 'sandbox ready' : 'not configured'})`);
});
