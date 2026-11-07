// Minimal PayPal REST client (Orders v2) for the sandbox.
const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

export const paypalConfigured = () => Boolean(CLIENT_ID && SECRET);
export const paypalClientId = () => CLIENT_ID;

let cached = { token: null, expires: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.expires) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const json = await res.json();
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return cached.token;
}

async function call(method, path, body, retried = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  // A cached token keeps its old permissions (e.g. Invoicing switched on later
  // in the PayPal dashboard): get a fresh one and try once more.
  if ((res.status === 401 || res.status === 403) && !retried) {
    cached = { token: null, expires: 0 };
    return call(method, path, body, true);
  }
  if (!res.ok) {
    const detail = json.details?.[0]?.description || json.message || res.statusText;
    throw new Error(`PayPal ${method} ${path} failed: ${detail}`);
  }
  return json;
}

// With returnUrl, PayPal sends the buyer back to us after approval (used for
// checkout links handed out by outside AI agents); the order has a payer-action link.
export function createDepositOrder({ slab, amount, currency, returnUrl, cancelUrl, customId, summary }) {
  return call('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    ...(returnUrl && {
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Blue Sea Wood',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
    purchase_units: [
      {
        reference_id: slab.id,
        ...(customId && { custom_id: customId.slice(0, 127) }),
        description: `Deposit for slab ${slab.id}, ${slab.length_cm}x${slab.width_cm} cm${summary ? `; ${summary}` : ''}`.slice(0, 127),
        amount: { currency_code: currency, value: amount.toFixed(2) },
      },
    ],
  });
}

export const getOrder = (orderId) => call('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);

export const captureOrder = (orderId) =>
  call('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {});

// Full refund of a captured deposit (3-day change-of-mind policy).
export const refundCapture = (captureId, note) =>
  call('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    note_to_payer: (note || 'Your Blue Sea Wood deposit has been refunded in full.').slice(0, 255),
  });

// Balance due before shipping: a PayPal invoice the customer pays from email.
export async function sendBalanceInvoice({ order, slab }) {
  const invoice = await call('POST', '/v2/invoicing/invoices', {
    detail: {
      currency_code: order.currency,
      invoice_number: `BSW-${order.id}`.slice(0, 25),
      note: `Balance for slab ${slab.id}. Deposit of ${order.deposit} ${order.currency} already received (PayPal order ${order.id}). Your slab ships after this is paid.`,
      payment_term: { term_type: 'DUE_ON_RECEIPT' },
    },
    primary_recipients: [{ billing_info: { email_address: order.payerEmail } }],
    items: [
      {
        name: `Balance: ${slab.species} slab ${slab.id}`.slice(0, 200),
        description: [
          `${slab.length_cm} x ${slab.width_cm} x ${slab.thickness_cm} cm ${slab.edge} slab: ${order.slabPrice ?? slab.price_thb} ${order.currency}`,
          order.legsPrice ? `${order.legsLabel}: ${order.legsPrice} ${order.currency}` : 'No legs (tabletop only)',
          order.finishLabel ? `Finish: ${order.finishLabel}` : null,
          `Total ${order.total ?? order.deposit + order.balance} ${order.currency}, deposit paid ${order.deposit} ${order.currency}`,
        ].filter(Boolean).join('. ').slice(0, 1000),
        quantity: '1',
        unit_amount: { currency_code: order.currency, value: Number(order.balance).toFixed(2) },
      },
    ],
  });
  await call('POST', `/v2/invoicing/invoices/${encodeURIComponent(invoice.id)}/send`, { send_to_invoicer: true });
  return invoice;
}
