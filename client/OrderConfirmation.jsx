// What the customer sees right after paying the deposit: order number,
// what they bought, what happens next and how to reach us.
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const addDays = (iso, days) => new Date(new Date(iso).getTime() + days * 86_400_000);

export default function OrderConfirmation({ order, slab, money, contact, cancelDays = 3 }) {
  const created = order.createdAt || new Date().toISOString();
  const total = order.total ?? order.deposit + order.balance;
  const steps = [
    ['Today', `Deposit of ${money(order.deposit)} received. Slab ${slab.id} is reserved for you, and PayPal has emailed your receipt.`],
    [`Until ${fmtDate(addDays(created, cancelDays))}`, 'Your slab is held for you. Changed your mind? Message us and we refund the deposit in full.'],
    [`From ${fmtDate(addDays(created, cancelDays))}`, 'Production starts: we cut, sand, fit bow ties where needed and finish your table in Phrae.'],
    [`Around ${fmtDate(addDays(created, cancelDays + 14))}`, 'Your table is finished and checked.'],
    ['Before shipping', `We email a PayPal invoice for the balance of ${money(order.balance)}.`],
    ['Delivery', 'Free delivery to your door anywhere in Thailand. Lifetime free repairs after that.'],
  ];

  return (
    <div className="confirmation">
      <p className="eyebrow">Order {order.id}</p>
      <h2 id="reserve-title">Slab {slab.id} is reserved for you</h2>

      <dl className="summary">
        <dt>Slab {slab.id} ({slab.length_cm} cm, finished tabletop)</dt>
        <dd>{money(order.slabPrice ?? slab.price_thb)}</dd>
        <dt>{order.legsPrice ? order.legsLabel : 'Legs'}</dt>
        <dd>{order.legsPrice ? money(order.legsPrice) : 'None (tabletop only)'}</dd>
        <dt>Finish: {order.finishLabel || 'Matte lacquer (standard)'}</dt>
        <dd>Included</dd>
        <dt>Delivery</dt>
        <dd>Free</dd>
        <dt className="total">Total</dt>
        <dd className="total">{money(total)}</dd>
        <dt>Deposit paid</dt>
        <dd className="strong">{money(order.deposit)}</dd>
        <dt>Balance before shipping</dt>
        <dd>{money(order.balance)}</dd>
      </dl>

      {(order.shipTo || order.contact) && (
        <p className="ship-to">
          <strong>Delivering to:</strong> {order.shipTo ? `${order.shipTo.name}, ${order.shipTo.address}` : 'the address you gave in PayPal'}
          {order.contact && (
            <>
              <br />
              <strong>We will contact you on:</strong> {order.contact}
            </>
          )}
        </p>
      )}

      <h3 className="timeline-title">What happens next</h3>
      <ol className="timeline">
        {steps.map(([when, what]) => (
          <li key={when}>
            <strong>{when}</strong>
            <span>{what}</span>
          </li>
        ))}
      </ol>

      <p className="hint">Questions about your table? Quote order {order.id}.</p>
      {contact && (
        <div className="contact">
          <a className="contact-btn line" href={contact.line} target="_blank" rel="noreferrer">Chat on LINE</a>
          <a className="contact-btn wa" href={contact.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      )}
    </div>
  );
}
