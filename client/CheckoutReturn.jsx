import { useEffect, useState } from 'react';
import OrderConfirmation from './OrderConfirmation.jsx';

const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);

// PayPal sends the buyer here after approving a deposit link that an AI
// assistant created through our MCP server (?token=<order id>).
export default function CheckoutReturn() {
  const cancelled = window.location.pathname.startsWith('/checkout/cancel');
  const orderId = new URLSearchParams(window.location.search).get('token');
  const [state, setState] = useState(cancelled ? { kind: 'cancelled' } : { kind: 'working' });
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cancelled) return;
    if (!orderId) return setState({ kind: 'error', message: 'This link is missing its PayPal order.' });
    fetch(`/api/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not confirm the payment.');
        setState({ kind: 'done', ...json });
      })
      .catch((err) => setState({ kind: 'error', message: err.message }));
  }, [cancelled, orderId]);

  return (
    <div className="return-page">
      <div className="dialog return-card">
        <a className="brand" href="/">
          <img src="/brand/logo.png" alt="" width="40" height="40" />
          <span>Blue Sea Wood</span>
        </a>
        {state.kind === 'working' && <h2>Confirming your deposit…</h2>}
        {state.kind === 'done' && (
          <>
            <OrderConfirmation order={state.order} slab={state.slab} money={money} contact={config?.contact} cancelDays={config?.cancelDays} />
            <p className="hint">You can go back to your AI assistant: it can confirm this order too.</p>
          </>
        )}
        {state.kind === 'cancelled' && (
          <>
            <h2>No payment was made</h2>
            <p>You cancelled on PayPal, so the slab is not reserved. Ask your assistant for a new link any time.</p>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <h2>We could not confirm the payment</h2>
            <p className="error">{state.message}</p>
          </>
        )}
        <a className="btn" href="/">Visit the shop</a>
      </div>
    </div>
  );
}
