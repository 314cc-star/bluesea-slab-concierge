import { useEffect, useMemo, useRef, useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import Concierge from './Concierge.jsx';
import RoomPreview from './RoomPreview.jsx';
import OrderConfirmation from './OrderConfirmation.jsx';

const EDGES = [
  { key: 'all', label: 'All slabs' },
  { key: 'live edge', label: 'Live edge' },
  { key: 'single straight edge', label: 'One straight edge' },
  { key: 'straight edge', label: 'Straight edge' },
  { key: 'round', label: 'Round' },
];

const STEPS = [
  ['Choose your slab', 'Pick a real slab from stock, or ask the concierge to find one that fits your room.'],
  ['Reserve with 50%', 'Pay the deposit securely with PayPal. The slab is held for you, and you have 3 days to change your mind for a full refund.'],
  ['Made in about 14 days', 'After the 3 days we cut, sand, fit bow ties where needed and finish your table in our workshop in Phrae.'],
  ['Balance & free delivery', 'Pay the balance before shipping. Delivery is free anywhere in Thailand.'],
];

const PROMISES = [
  ['Free delivery', 'Anywhere in Thailand, for every slab.'],
  ['3-day full refund', 'Change your mind within 3 days of your deposit.'],
  ['Wooden bow ties', 'Natural cracks are stabilised by hand, at no extra cost.'],
  ['Lifetime repair', 'Free repairs for the life of your table.'],
];

// From blueseawood.co customer reviews.
const REVIEWS = [
  ['I love it so much, it’s the most beautiful I’ve ever seen. It has a pearl-like shine and is a very heavy wood slab.', 'Nutnicha P.'],
  ['This is the third time I’ve ordered wood slabs from this store. The product quality is consistently good.', 'Santaphop N.'],
  ['They found wood in the exact size I needed. Got a larger piece than I ordered, but the store didn’t charge extra.', 'Verified customer'],
];

// Finished tables from our workshop, shown next to the raw slab photos.
const FINISHED = [
  { src: '/brand/table.jpg', caption: 'Finished live-edge Suar dining table on steel legs' },
  { src: '/brand/table-legs.jpg', caption: 'Finished slab table on solid wood legs' },
];

function ContactButtons({ contact, compact }) {
  if (!contact) return null;
  return (
    <div className={`contact${compact ? ' compact' : ''}`}>
      <a className="contact-btn line" href={contact.line} target="_blank" rel="noreferrer">Chat on LINE</a>
      <a className="contact-btn wa" href={contact.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
    </div>
  );
}

function PhotoViewer({ slab, onClose, onReserve }) {
  const photos = [{ src: slab.photo, caption: `Slab ${slab.id} as it is today: raw, before sanding and finishing` }, ...FINISHED];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, photos.length]);
  const current = photos[index];
  return (
    <div className="overlay viewer" onClick={onClose}>
      <div className="viewer-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Photos of slab ${slab.id}`}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <img className="viewer-main" src={current.src} alt={current.caption} />
        <p className="viewer-caption">{current.caption}</p>
        <div className="viewer-thumbs">
          {photos.map((p, i) => (
            <button key={p.src} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={p.caption}>
              <img src={p.src} alt="" />
              <span>{i === 0 ? 'This slab (raw)' : 'Finished example'}</span>
            </button>
          ))}
        </div>
        <div className="viewer-foot">
          <span>Every slab is sanded smooth and finished before delivery; the oil or lacquer brings out a richer colour.</span>
          {slab.status === 'available' && <button className="btn" onClick={() => onReserve(slab)}>Reserve this slab</button>}
        </div>
      </div>
    </div>
  );
}

// Live-edge slabs are measured at both ends and the middle.
const widthText = (s) =>
  s.widths_cm?.length ? `${Math.min(...s.widths_cm)}–${Math.max(...s.widths_cm)} cm` : `${s.width_cm} cm`;

const makeMoney = (currency) => (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

// Until real photos arrive, draw a wood-grain swatch shaped like the slab.
function SlabVisual({ slab, onOpen }) {
  if (slab.photo) {
    return (
      <figure className="slab-photo-wrap">
        <button className="photo-btn" onClick={() => onOpen(slab)} aria-label={`View larger photos of slab ${slab.id}`}>
          <img className="slab-photo" src={slab.photo} alt={`Raw slab ${slab.id} in our yard`} loading="lazy" />
          <span className="zoom-hint">View photos</span>
        </button>
        <figcaption>Raw slab, before sanding and finishing</figcaption>
      </figure>
    );
  }
  const dark = /dark|chocolate|deep/.test(slab.tone);
  const light = /light|honey/.test(slab.tone);
  const base = dark ? '#5a3a24' : light ? '#b98a55' : '#94643a';
  const round = slab.edge === 'round';
  const straight = slab.edge === 'straight edge';
  const ratio = round ? 1 : Math.max(1.6, Math.min(3.4, slab.length_cm / slab.width_cm));
  return (
    <div className="slab-swatch-wrap">
      <div
        className={`slab-swatch${round ? ' round' : ''}${straight ? ' straight' : ''}${slab.edge === 'single straight edge' ? ' single' : ''}`}
        style={{ '--wood': base, aspectRatio: String(ratio) }}
        role="img"
        aria-label={`Illustration of a ${slab.edge} slab`}
      />
    </div>
  );
}

function SlabCard({ slab, money, onReserve, onPreview, onOpen, highlight }) {
  const available = slab.status === 'available';
  return (
    <article className={`card${highlight ? ' highlight' : ''}`} id={`slab-${slab.id}`}>
      <SlabVisual slab={slab} onOpen={onOpen} />
      <div className="card-body">
        <div className="card-top">
          <span className="slab-id">{slab.id}</span>
          {!available ? <span className="badge taken">Reserved</span> : slab.free_shipping && <span className="badge">Free delivery</span>}
        </div>
        <h3>{slab.length_cm} cm long · {widthText(slab)} wide</h3>
        <p className="dims">
          {slab.thickness_cm} cm thick · {slab.species} · {slab.edge}
        </p>
        <p className="desc">{slab.tone}. {slab.figure}.</p>
        <p className="uses">Great for {slab.best_for.join(', ')}</p>
        {available && onPreview && (
          <button className="link-btn" onClick={() => onPreview(slab)}>
            See it in your room
          </button>
        )}
        <div className="card-foot">
          <div>
            <div className="price">
              {money(slab.price_thb)} <span className="usd">{money.usd(slab.price_thb)}</span>
            </div>
            <div className="deposit">{money(slab.deposit)} deposit reserves it</div>
          </div>
          <button className="btn" disabled={!available} onClick={() => onReserve(slab)}>
            {available ? 'Reserve' : 'Taken'}
          </button>
        </div>
      </div>
    </article>
  );
}

function TableOptions({ slab, options, choice, setChoice, money }) {
  return (
    <div className="table-options">
      <fieldset>
        <legend>Legs</legend>
        <div className="opt-row">
          {options.legs.map((l) => (
            <label key={l.id} className={`opt${choice.legs === l.id ? ' on' : ''}`}>
              <input type="radio" name="legs" value={l.id} checked={choice.legs === l.id} onChange={() => setChoice({ ...choice, legs: l.id })} />
              {l.image ? <img src={l.image} alt="" /> : <span className="opt-none" aria-hidden="true">Top only</span>}
              <span>{l.label}</span>
              <small>{l.id === 'none' ? 'Use your own base' : `+ ${money(slab.leg_price_thb)}`}</small>
            </label>
          ))}
        </div>
        {options.legs.find((l) => l.id === choice.legs)?.note && (
          <p className="fine-print">{options.legs.find((l) => l.id === choice.legs).note}</p>
        )}
      </fieldset>
      <fieldset>
        <legend>Finish <small>(included)</small></legend>
        <div className="finish-row">
          {options.finishes.map((f) => (
            <label key={f.id} className={`finish${choice.finish === f.id ? ' on' : ''}`} title={f.note}>
              <input type="radio" name="finish" value={f.id} checked={choice.finish === f.id} onChange={() => setChoice({ ...choice, finish: f.id })} />
              <img src={f.image} alt="" />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        <p className="fine-print">{options.finishes.find((f) => f.id === choice.finish)?.note}</p>
      </fieldset>
    </div>
  );
}

function ReserveDialog({ slab, config, money, previewFirst, initialChoice, onClose, onReserved }) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(Boolean(previewFirst));
  const [choice, setChoice] = useState({ legs: 'none', finish: 'lacquer', ...initialChoice });
  const [contact, setContact] = useState('');
  // PayPal keeps its first callbacks, so read the latest values from a ref.
  const choiceRef = useRef(choice);
  choiceRef.current = { ...choice, contact };
  const contactOk = contact.trim().length >= 4;
  const legsPrice = choice.legs === 'none' ? 0 : slab.leg_price_thb;
  const total = slab.price_thb + legsPrice;
  const deposit = Math.round(total * config.depositRate);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reserve-title">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        {done ? (
          <>
            <OrderConfirmation order={done.order} slab={done.slab} money={money} contact={config.contact} cancelDays={config.cancelDays} />
            <button className="btn" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <h2 id="reserve-title">Reserve slab {slab.id}</h2>
            <p className="dims">
              {slab.species} · {slab.length_cm} cm long · {widthText(slab)} wide · {slab.thickness_cm} cm thick
            </p>
            <TableOptions slab={slab} options={config.options} choice={choice} setChoice={setChoice} money={money} />
            {config.roomPreview && <RoomPreview slab={slab} choice={choice} open={previewOpen} onToggle={setPreviewOpen} />}
            <dl className="summary">
              <dt>Slab (finished tabletop)</dt>
              <dd>{money(slab.price_thb)}</dd>
              <dt>{choice.legs === 'none' ? 'Legs' : config.options.legs.find((l) => l.id === choice.legs)?.label}</dt>
              <dd>{legsPrice ? money(legsPrice) : 'None'}</dd>
              <dt>Finish</dt>
              <dd>Included</dd>
              <dt className="total">Total</dt>
              <dd className="total">
                {money(total)} <span className="usd">{money.usd(total)}</span>
              </dd>
              <dt>Deposit today ({Math.round(config.depositRate * 100)}%)</dt>
              <dd className="strong">{money(deposit)}</dd>
              <dt>Balance before shipping</dt>
              <dd>{money(total - deposit)}</dd>
              <dt>Delivery in Thailand</dt>
              <dd>Free</dd>
            </dl>
            <ul className="assurance">
              <li>Full refund if you change your mind within {config.cancelDays} days</li>
              <li>Cracks stabilised with wooden bow ties · lifetime free repair</li>
            </ul>
            <label className="contact-field">
              Phone or LINE ID <small>(to arrange delivery; you choose the delivery address in PayPal)</small>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 081 234 5678 or @yourline"
                autoComplete="tel"
                maxLength={60}
                aria-invalid={Boolean(error) && !contactOk}
              />
            </label>
            {error && <p className="error">{error}</p>}
            {config.paypal ? (
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', color: 'gold' }}
                onClick={(_data, actions) => {
                  if (choiceRef.current.contact.trim().length >= 4) {
                    setError('');
                    return actions.resolve();
                  }
                  setError('Please add a phone number or LINE ID first, so we can arrange delivery.');
                  return actions.reject();
                }}
                createOrder={async () => {
                  setError('');
                  const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slabId: slab.id, ...choiceRef.current }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  return json.id;
                }}
                onApprove={async ({ orderID }) => {
                  const res = await fetch(`/api/orders/${orderID}/capture`, { method: 'POST' });
                  const json = await res.json();
                  if (!res.ok) return setError(json.error);
                  setDone(json);
                  onReserved(json.slab);
                }}
                onError={(err) => setError(err?.message || 'PayPal could not complete the payment.')}
              />
            ) : (
              <p className="notice">PayPal sandbox keys are not set up yet, so payment is switched off.</p>
            )}
            <p className="hint ask-human">Questions before you pay? Talk to us:</p>
            <ContactButtons contact={config.contact} compact />
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [slabs, setSlabs] = useState([]);
  const [edge, setEdge] = useState('all');
  const [minLength, setMinLength] = useState(0);
  const [selected, setSelected] = useState(null);
  const [previewFirst, setPreviewFirst] = useState(false);
  const [initialChoice, setInitialChoice] = useState(null);
  const openReserve = (slab, choice = null) => {
    setPreviewFirst(false);
    setInitialChoice(choice);
    setSelected(slab);
  };
  const openPreview = (slab) => {
    setPreviewFirst(true);
    setInitialChoice(null);
    setSelected(slab);
  };
  const [loadError, setLoadError] = useState('');
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
    // Retry briefly: the API may still be starting when the page first loads.
    const load = (attempt) =>
      Promise.all([getJson('/api/config'), getJson('/api/slabs')])
        .then(([c, s]) => {
          if (cancelled) return;
          setConfig(c);
          setSlabs(s);
          setLoadError('');
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 5) setTimeout(() => load(attempt + 1), 1000 * (attempt + 1));
          else setLoadError('Could not load the slab collection. Please refresh the page.');
        });
    load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  const money = useMemo(() => {
    const fmt = makeMoney(config?.currency || 'THB');
    // Rough US-dollar hint for overseas visitors; checkout stays in THB.
    const rate = config?.usdPerThb;
    fmt.usd = (n) => (rate ? `≈ US$${Math.round((n * rate) / 10) * 10}` : '');
    return fmt;
  }, [config]);
  const slabsById = useMemo(() => Object.fromEntries(slabs.map((s) => [s.id, s])), [slabs]);
  const shown = useMemo(
    () => slabs.filter((s) => (edge === 'all' || s.edge === edge) && s.length_cm >= minLength),
    [slabs, edge, minLength],
  );

  const page = (
    <>
      <div className="topbar">Free delivery anywhere in Thailand · 3-day full refund · Lifetime free repair</div>
      {config?.demo && (
        <div className="demo-bar">
          Demo shop for the PayPal AI Hackathon: pay with a PayPal sandbox account (no real money). Test reservations are
          released after {config.demo.releaseMinutes} minutes.
        </div>
      )}
      <header className="site-head">
        <div className="wrap head-inner">
          <a className="brand" href="/">
            <img src="/brand/logo.png" alt="" width="44" height="44" />
            <span>Blue Sea Wood</span>
          </a>
          <nav>
            <a href="#concierge">Concierge</a>
            <a href="#slabs">Slabs in stock</a>
            <a href="#how">How ordering works</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-text">
            <p className="eyebrow">Premium wood slabs from Phrae, Thailand</p>
            <h1>Every slab has its own story. Let us find yours.</h1>
            <p className="lede">
              Solid Suar (Monkey Pod) slabs in one single piece, kiln-dried and finished in our workshop. Describe your
              room and our concierge finds the right slab in stock, then you reserve it with a PayPal deposit.
            </p>
            <p className="rating">
              <span aria-hidden="true">★★★★★</span> 4.8 average from 7,000+ customer reviews
            </p>
            <ContactButtons contact={config?.contact} />
          </div>
          <img className="hero-photo" src="/brand/table.jpg" alt="Live edge Suar wood dining table by Blue Sea Wood" />
        </div>
      </section>

      <main className="wrap">
        <ul className="promises" aria-label="Our promises">
          {PROMISES.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div id="concierge">
          {config && (
            <Concierge enabled={config.concierge} slabsById={slabsById} money={money} onReserve={openReserve} contact={config.contact} />
          )}
        </div>

        <section id="slabs" className="section">
          <h2 className="section-title">Slabs in stock</h2>
          <div className="filters">
            <div className="chips">
              {EDGES.filter((e) => e.key === 'all' || slabs.some((s) => s.edge === e.key)).map((e) => (
                <button key={e.key} className={`chip${edge === e.key ? ' on' : ''}`} onClick={() => setEdge(e.key)}>
                  {e.label}
                </button>
              ))}
            </div>
            <label className="range">
              Minimum length: <strong>{minLength} cm</strong>
              <input type="range" min="0" max="400" step="20" value={minLength} onChange={(e) => setMinLength(Number(e.target.value))} />
            </label>
          </div>

          {loadError && <p className="error">{loadError}</p>}
          <div className="grid">
            {shown.map((s) => (
              <SlabCard
                key={s.id}
                slab={s}
                money={money}
                onReserve={openReserve}
                onPreview={config?.roomPreview ? openPreview : null}
                onOpen={setViewing}
              />
            ))}
            {config && shown.length === 0 && <p className="empty">No slabs match these filters. Ask the concierge about a custom cut.</p>}
          </div>
        </section>

        <section id="how" className="section">
          <h2 className="section-title">How ordering works</h2>
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-n">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="reviews-title">
          <h2 className="section-title" id="reviews-title">What customers say</h2>
          <ul className="reviews">
            {REVIEWS.map(([quote, who]) => (
              <li key={who}>
                <span className="stars" aria-label="5 stars">★★★★★</span>
                <blockquote>“{quote}”</blockquote>
                <cite>{who}</cite>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="site-foot">
        <div className="wrap foot-inner">
          <div>
            <strong>Blue Sea Wood</strong>
            <p>Phrae, Thailand · sales@blueseawood.co</p>
            <ContactButtons contact={config?.contact} compact />
          </div>
          <p className="fine">Hackathon demo: payments run in the PayPal sandbox, so no real money is charged.</p>
        </div>
      </footer>

      {viewing && (
        <PhotoViewer
          slab={slabsById[viewing.id] || viewing}
          onClose={() => setViewing(null)}
          onReserve={(s) => {
            setViewing(null);
            openReserve(s);
          }}
        />
      )}

      {selected && config && (
        <ReserveDialog
          key={selected.id}
          slab={slabsById[selected.id] || selected}
          previewFirst={previewFirst}
          initialChoice={initialChoice}
          config={config}
          money={money}
          onClose={() => setSelected(null)}
          onReserved={(updated) => setSlabs((all) => all.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))}
        />
      )}
    </>
  );

  if (config?.paypal) {
    return (
      <PayPalScriptProvider options={{ clientId: config.paypal.clientId, currency: config.currency, intent: 'capture' }}>
        {page}
      </PayPalScriptProvider>
    );
  }
  return page;
}
