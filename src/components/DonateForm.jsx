import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const PRESETS = [5, 10, 25, 50];

/** One-off donation via Stripe Checkout (independent of gameplay). */
export default function DonateForm({ charityId }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState(10);
  const [name, setName] = useState(profile?.full_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!charityId) return setError('Choose a charity first.');
    setBusy(true);
    try {
      const { url } = await api('donate', { body: { charityId, amountCents: Math.round(Number(amount) * 100), donorName: name } });
      window.location.href = url;
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button type="button" key={p} className={`btn btn-sm ${Number(amount) === p ? '' : 'btn-ghost'}`} onClick={() => setAmount(p)}>£{p}</button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="amt">Amount (£)</label>
        <input id="amt" className="input" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="dn">Your name (optional)</label>
        <input id="dn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <button className="btn btn-rose" disabled={busy}>{busy ? 'Opening secure checkout…' : `Donate £${amount || 0}`}</button>
    </form>
  );
}
