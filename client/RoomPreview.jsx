import { useState } from 'react';
import { resizeImage } from './image.js';

export default function RoomPreview({ slab, choice, open, onToggle }) {
  const [room, setRoom] = useState(null);
  const [result, setResult] = useState(null);
  const [showBefore, setShowBefore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function render() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: room, slabId: slab.id, ...choice }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Something went wrong.');
      setResult(json.image);
      setShowBefore(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="room-preview" open={open} onToggle={(e) => onToggle?.(e.currentTarget.open)}>
      <summary>See this slab in your room</summary>
      <p className="hint">Take a photo of the space where the table will go. Our AI places slab {slab.id} in it, at its real size.</p>

      <label className="photo-drop room-drop">
        {result || room ? (
          <img src={result && !showBefore ? result : room} alt={result && !showBefore ? `AI preview of slab ${slab.id} in your room` : 'Your room'} />
        ) : (
          <span>Tap to take or choose a photo of your room</span>
        )}
        {!busy && (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setRoom(await resizeImage(file, 1024));
                setResult(null);
                setError('');
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        )}
        {busy && <span className="painting">Placing your slab… about 20 seconds</span>}
      </label>

      <div className="preview-actions">
        {result ? (
          <>
            <button type="button" className="chip" onClick={() => setShowBefore((v) => !v)}>
              {showBefore ? 'Show with table' : 'Show my room before'}
            </button>
            <button type="button" className="chip" onClick={render} disabled={busy}>Try again</button>
          </>
        ) : (
          <button type="button" className="btn" disabled={!room || busy} onClick={render}>
            {busy ? 'Creating preview…' : 'Show it in my room'}
          </button>
        )}
      </div>
      {result && <p className="fine-print">AI preview for inspiration. Your real slab is the one in our photos, with its own natural grain.</p>}
      {error && <p className="error">{error}</p>}
    </details>
  );
}
