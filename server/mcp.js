// Agentic commerce: an MCP server so any AI assistant (Claude, ChatGPT, ...)
// can search Blue Sea Wood stock and hand its user a PayPal deposit link.
// The agent never pays: the human approves the payment on PayPal.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { listSlabs, getSlab } from './store.js';
import { createDepositOrder, getOrder } from './paypal.js';
import { LEGS, FINISHES, quote, legPrice, encodeChoice, optionsGuide, policyGuide } from './options.js';

const EDGES = ['live edge', 'single straight edge', 'straight edge', 'round'];
const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });

function buildServer(req, opts) {
  const { publicUrl, depositFor, freeShipping, currency, depositRate, paypalReady, completeDeposit } = opts;
  const base = publicUrl(req);
  const view = (s) => ({
    id: s.id,
    species: s.species,
    size_cm: { width: s.width_cm, widths_ends_and_middle: s.widths_cm, length: s.length_cm, thickness: s.thickness_cm },
    edge: s.edge,
    tone: s.tone,
    figure: s.figure,
    best_for: s.best_for,
    price: { amount: s.price_thb, currency, note: 'finished tabletop, legs not included' },
    legs_price_per_pair: { amount: legPrice(s, 'steel'), currency, note: 'steel or wooden, same price' },
    deposit_to_reserve_tabletop_only: { amount: depositFor(s), currency },
    free_delivery_in_thailand: freeShipping(s),
    status: s.status,
    photo_url: s.photo ? `${base}${s.photo}` : null,
    page_url: `${base}/#slab-${s.id}`,
  });

  const server = new McpServer(
    { name: 'blue-sea-wood', version: '1.0.0' },
    {
      instructions: `Blue Sea Wood sells one-of-a-kind solid Suar (Monkey Pod) wood slabs and slab tabletops, made in Phrae, Thailand.
Every slab is unique: search stock first, then recommend by ID. Prices are in ${currency}; legs are sold separately.
To buy, a ${Math.round(depositRate * 100)}% deposit reserves the slab; the customer can cancel for a full refund within 3 days, then production starts (about 14 days); the balance is invoiced before shipping.
You cannot pay: create a checkout link and give it to your user to approve on PayPal.
${optionsGuide()}
${policyGuide()}`,
    },
  );

  server.registerTool(
    'search_slabs',
    {
      title: 'Search slabs in stock',
      description: 'Find available wood slabs. All filters are optional. Sizes in centimetres, price in THB.',
      inputSchema: {
        min_length_cm: z.number().positive().optional(),
        max_length_cm: z.number().positive().optional(),
        min_width_cm: z.number().positive().optional(),
        max_width_cm: z.number().positive().optional(),
        edge: z.enum(EDGES).optional(),
        max_price_thb: z.number().positive().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) => {
      const slabs = (await listSlabs()).filter(
        (s) =>
          s.status === 'available' &&
          (a.min_length_cm == null || s.length_cm >= a.min_length_cm) &&
          (a.max_length_cm == null || s.length_cm <= a.max_length_cm) &&
          (a.min_width_cm == null || s.width_cm >= a.min_width_cm) &&
          (a.max_width_cm == null || s.width_cm <= a.max_width_cm) &&
          (!a.edge || s.edge === a.edge) &&
          (a.max_price_thb == null || s.price_thb <= a.max_price_thb),
      );
      return json({ count: slabs.length, slabs: slabs.map(view) });
    },
  );

  server.registerTool(
    'get_slab',
    {
      title: 'Get one slab',
      description: 'Full details for one slab by ID, including its photo and whether it is still available.',
      inputSchema: { slab_id: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slab_id }) => {
      const slab = await getSlab(slab_id);
      return slab ? json(view(slab)) : fail(`No slab with ID ${slab_id}.`);
    },
  );

  server.registerTool(
    'create_deposit_checkout',
    {
      title: 'Create a PayPal deposit link',
      description:
        'Create a PayPal checkout link for the deposit that reserves one slab, with the chosen legs and finish (ask your user first; defaults: no legs, matte lacquer). Give the link to your user: they review and approve the payment on PayPal themselves. Nothing is charged until they approve.',
      inputSchema: {
        slab_id: z.string(),
        legs: z.enum(Object.keys(LEGS)).optional().describe('none (tabletop only), steel or wood'),
        finish: z.enum(Object.keys(FINISHES)).optional().describe('finish id; all finishes are included in the price'),
        customer_phone: z
          .string()
          .max(60)
          .optional()
          .describe("Your user's phone number or LINE ID, so the shop can arrange delivery. Ask your user first; the delivery address is chosen in PayPal."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ slab_id, legs, finish, customer_phone }) => {
      if (!paypalReady()) return fail('Checkout is not available right now.');
      const slab = await getSlab(slab_id);
      if (!slab) return fail(`No slab with ID ${slab_id}.`);
      if (slab.status !== 'available') return fail(`Slab ${slab_id} is already reserved. Search again for another slab.`);
      const q = quote(slab, { legs, finish }, depositRate);
      const order = await createDepositOrder({
        slab,
        amount: q.deposit,
        currency,
        returnUrl: `${base}/checkout/return`,
        cancelUrl: `${base}/checkout/cancel`,
        customId: encodeChoice(slab.id, { ...q, contact: customer_phone }),
        summary: q.summary,
      });
      const link = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
      if (!link) return fail('PayPal did not return a checkout link. Please try again.');
      return json({
        order_id: order.id,
        checkout_url: link,
        slab_id: slab.id,
        table: q.summary,
        slab_price: { amount: q.slabPrice, currency },
        legs_price: { amount: q.legsPrice, currency },
        total: { amount: q.total, currency },
        deposit: { amount: q.deposit, currency },
        balance_before_shipping: { amount: q.balance, currency },
        next_step:
          'Share checkout_url with your user and ask them to approve the deposit on PayPal. Afterwards call check_checkout with order_id to confirm the reservation.',
      });
    },
  );

  server.registerTool(
    'check_checkout',
    {
      title: 'Check a deposit payment',
      description: 'Check whether the user has paid the deposit for an order_id from create_deposit_checkout, and whether the slab is now reserved.',
      inputSchema: { order_id: z.string() },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ order_id }) => {
      let order;
      try {
        order = await getOrder(order_id);
      } catch {
        return fail(`No PayPal order ${order_id}.`);
      }
      // The user approved on PayPal but did not come back to our page: finish it here.
      if (order.status === 'APPROVED' || order.status === 'COMPLETED') {
        try {
          const { order: saved } = await completeDeposit(order_id);
          return json({
            paid: true,
            slab_id: saved.slabId,
            deposit_paid: { amount: saved.deposit, currency: saved.currency },
            balance_due_before_shipping: { amount: saved.balance, currency: saved.currency },
            message: 'Deposit received. The slab is reserved; full refund possible within 3 days, then production starts (about 14 days).',
          });
        } catch (err) {
          return fail(`Payment could not be confirmed: ${err.message}`);
        }
      }
      return json({ paid: false, paypal_status: order.status, message: 'Waiting for the user to approve the payment on PayPal.' });
    },
  );

  return server;
}

export function mountMcp(app, opts) {
  app.post('/mcp', async (req, res) => {
    // Stateless: a fresh server and transport per request.
    const server = buildServer(req, opts);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP error', err);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  });
  const notAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
}
