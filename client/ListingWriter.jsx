import { useState } from 'react';
import { resizeImage } from './image.js';

const EDGES = ['live edge', 'single straight edge', 'straight edge', 'round'];
const EMPTY = { width_cm: '', length_cm: '', thickness_cm: '5', edge: 'live edge', price_thb: '' };

function CopyBlock({ label, text }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-block">
      <div className="copy-head">
        <strong>{label}</strong>
        <button
          type="button"
          className="chip"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked: the text is still selectable */
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p>{text}</p>
    </div>
  );
}

export default function ListingWriter({ api, onAdded }) {
  const [image, setImage] = useState(null);
  const [details, setDetails] = useState(EMPTY);
  const [listing, setListing] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const set = (key) => (e) => setDetails((d) => ({ ...d, [key]: e.target.value }));
  const ready = image && details.width_cm && details.length_cm && details.thickness_cm && details.price_thb;

  async function write() {
    setBusy('write');
    setError('');
    try {
      setListing(await api('/api/admin/listing', { method: 'POST', body: JSON.stringify({ image, details }) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function add() {
    setBusy('add');
    setError('');
    try {
      const slab = await api('/api/admin/slabs', { method: 'POST', body: JSON.stringify({ image, details, listing }) });
      onAdded(slab);
      setImage(null);
      setDetails(EMPTY);
      setListing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="section">
      <h2 className="section-title">Add a slab with AI</h2>
      <p className="hint">
        Take a photo of the slab and enter its size. The AI writes the listing, ready for the shop,
        online marketplaces and Instagram.
      </p>
      <div className="writer">
        <div className="writer-form">
          <label className="photo-drop">
            {image ? <img src={image} alt="Slab to list" /> : <span>Tap to take or choose a photo</span>}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setImage(await resizeImage(file));
                  setListing(null);
                } catch (err) {
                  setError(err.message);
                }
              }}
            />
          </label>
          <div className="fields">
            <label>Width (cm)<input inputMode="decimal" value={details.width_cm} onChange={set('width_cm')} /></label>
            <label>Length (cm)<input inputMode="decimal" value={details.length_cm} onChange={set('length_cm')} /></label>
            <label>Thickness (cm)<input inputMode="decimal" value={details.thickness_cm} onChange={set('thickness_cm')} /></label>
            <label>Edge
              <select value={details.edge} onChange={set('edge')}>
                {EDGES.map((e) => <option key={e}>{e}</option>)}
              </select>
            </label>
            <label>Price (THB)<input inputMode="numeric" value={details.price_thb} onChange={set('price_thb')} /></label>
          </div>
          <button className="btn" disabled={!ready || busy} onClick={write}>
            {busy === 'write' ? 'Writing…' : listing ? 'Write again' : 'Write listing with AI'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="writer-result">
          {!listing ? (
            <p className="hint">The listing appears here.</p>
          ) : (
            <>
              <CopyBlock label="Title" text={listing.title_en} />
              <CopyBlock label="Description" text={listing.description_en} />
              <CopyBlock label="Instagram hashtags" text={listing.hashtags.join(' ')} />
              <p className="hint">
                Shop card: {listing.tone}. {listing.figure}. Great for {listing.best_for.join(', ')}.
              </p>
              <button className="btn" disabled={Boolean(busy)} onClick={add}>
                {busy === 'add' ? 'Adding…' : 'Add to shop stock'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
