import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { money } from '../lib/format.js';
import { PLANS } from '../config/plans.js';

/** Pricing + start Stripe Checkout. Signed-out visitors go to signup first. */
export default function Subscribe() {
  const { user, profile, isActive, refresh } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(params.get('plan') === 'yearly' ? 'yearly' : 'monthly');
  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('charities').select('id, name').eq('active', true).order('name').then(({ data }) => setCharities(data || []));
  }, []);
  useEffect(() => { setCharityId(profile?.charity_id || params.get('charity') || ''); }, [profile, params]);

  const yearlySaving = PLANS.monthly.amountCents * 12 - PLANS.yearly.amountCents;

  async function start() {
    setError('');
    if (!user) {
      const q = new URLSearchParams({ plan, ...(params.get('charity') ? { charity: params.get('charity') } : {}) });
      return navigate(`/signup?${q}`);
    }
    if (!charityId) return setError('Choose the charity you want to support.');
    setBusy(true);
    try {
      if (charityId !== profile?.charity_id) {
        const { error: e } = await supabase.from('profiles').update({ charity_id: charityId }).eq('id', user.id);
        if (e) throw e;
        await refresh();
      }
      const { url } = await api('checkout', { body: { plan } });
      window.location.href = url;
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (user && isActive) {
    return (
      <div className="wrap section">
        <h1>You&rsquo;re already a member</h1>
        <p className="lede">Your membership is active. Log your rounds and manage your plan from your dashboard.</p>
        <Link className="btn btn-primary btn-lg" to="/dashboard">Go to my dashboard</Link>
      </div>
    );
  }

  return (
    <div className="wrap section">
      <h1 style={{ maxWidth: '14ch' }}>Pick a plan, pick a cause</h1>
      <p className="lede">Both plans include every monthly draw and the same charity contribution. Payments are handled securely by Stripe.</p>
      {params.get('canceled') && <div className="alert alert-info" style={{ maxWidth: 820 }}>Checkout was cancelled and you haven&rsquo;t been charged. Pick a plan when you&rsquo;re ready.</div>}
      {error && <div className="alert alert-error" style={{ maxWidth: 820 }}>{error}</div>}

      <div className="plans" role="radiogroup" aria-label="Plan" style={{ marginTop: 28 }}>
        {Object.values(PLANS).map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={plan === p.id}
            className={`plan ${plan === p.id ? 'selected' : ''}`} onClick={() => setPlan(p.id)}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{p.label}</h3>
              {p.id === 'yearly' && <span className="pill pill-gold">Save {money(yearlySaving)}</span>}
            </div>
            <div className="plan-price">{money(p.amountCents)}<small> / {p.interval}</small></div>
            <p className="small muted" style={{ margin: 0 }}>{p.blurb}</p>
          </button>
        ))}
      </div>

      {user && (
        <div className="field" style={{ maxWidth: 420, marginTop: 24 }}>
          <label htmlFor="charity">Charity you&rsquo;re playing for</label>
          <select id="charity" className="input" value={charityId} onChange={(e) => setCharityId(e.target.value)}>
            <option value="">Choose a charity</option>
            {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
          {busy ? 'Opening secure checkout…' : user ? `Pay ${money(PLANS[plan].amountCents)} and join` : 'Create account and subscribe'}
        </button>
        {!user && <Link to="/login?next=/subscribe" className="small">Already have an account? Sign in</Link>}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.</p>
    </div>
  );
}
