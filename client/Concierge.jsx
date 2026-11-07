import { useEffect, useRef, useState } from 'react';

const STARTERS = [
  'A dining table for 6 people, my room is 3 m wide',
  'A long conference table for 10–12 people',
  'A bar counter about 4 metres long for my restaurant',
];

// Gemini sometimes uses **bold**; render that, keep everything else as text.
function RichText({ text }) {
  return text.split('\n').map((line, i) => (
    <p key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.replace(/^\s*[*-]\s+/, '• '),
      )}
    </p>
  ));
}

export default function Concierge({ enabled, slabsById, money, onReserve, contact }) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHistory(json.history);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: json.reply, slabIds: json.suggestedSlabIds, checkout: json.checkout },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: err.message || 'Something went wrong.', error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="concierge" aria-label="AI slab concierge">
      <div className="concierge-head">
        <div>
          <h2>Slab Concierge</h2>
          <p>Tell us your room and what you want to build. Our AI concierge searches the slabs in stock right now.</p>
        </div>
        <span className="ai-tag">AI · Gemini</span>
      </div>

      <div className="log" ref={logRef}>
        {messages.length === 0 && (
          <div className="starters">
            {STARTERS.map((s) => (
              <button key={s} className="starter" onClick={() => send(s)} disabled={!enabled}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? ' err' : ''}`}>
            {m.role === 'assistant' ? <RichText text={m.text} /> : <p>{m.text}</p>}
            {m.slabIds?.length > 0 && (
              <div className="picks">
                {m.slabIds.map((id) => slabsById[id]).filter(Boolean).map((s) => (
                  <button key={s.id} className="pick" onClick={() => onReserve(s)} disabled={s.status !== 'available'}>
                    <strong>{s.id}</strong>
                    <span>{s.length_cm}×{s.width_cm} cm · {s.edge}</span>
                    <span>{money(s.price_thb)}</span>
                  </button>
                ))}
              </div>
            )}
            {m.checkout && slabsById[m.checkout.slabId] && (
              <div className="checkout-card">
                <span>
                  Your table: <strong>{m.checkout.slabId}</strong>
                  {m.checkout.legs !== 'none' ? ` with ${m.checkout.legs === 'wood' ? 'wooden' : 'steel'} legs` : ', tabletop only'}
                </span>
                <button
                  className="btn"
                  onClick={() => onReserve(slabsById[m.checkout.slabId], { legs: m.checkout.legs, finish: m.checkout.finish })}
                >
                  Review and pay deposit
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant typing">Checking our slabs…</div>}
      </div>

      {!enabled && <p className="notice">The concierge switches on once a Gemini API key is added to .env.</p>}
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. a 2.5 m dining table with a natural edge"
          disabled={!enabled || busy}
          aria-label="Message the slab concierge"
        />
        <button className="btn" disabled={!enabled || busy || !input.trim()}>Send</button>
      </form>
      {contact && (
        <p className="human-handoff">
          Prefer a person? Chat with our team on{' '}
          <a href={contact.line} target="_blank" rel="noreferrer">LINE</a> or{' '}
          <a href={contact.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>.
        </p>
      )}
    </section>
  );
}
