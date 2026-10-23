import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { PLANS, CHARITY_MIN_PERCENT, CHARITY_MAX_PERCENT } from '../config/plans.js';

/**
 * Sign up = account + charity choice + plan, then straight into Stripe
 * Checkout. Charity and percentage are stored on the profile by a DB trigger.
 */
export default function Signup() {
  const [params] = useSearchParams();
  const [charities, setCharities] = useState([]);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    charity_id: params.get('charity') || '', charity_percent: CHARITY_MIN_PERCENT,
    plan: params.get('plan') === 'yearly' ? 'yearly' : 'monthly',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    supabase.from('charities').select('id, name, tagline').eq('active', true).order('name').then(({ data }) => setCharities(data || []));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fee = PLANS[form.plan].amountCents;
  const charityAmount = Math.floor(fee * form.charity_percent / 100);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!form.charity_id) return setError('Choose a charity to support.');
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), charity_id: form.charity_id, charity_percent: Number(form.charity_percent) },
        emailRedirectTo: `${window.location.origin}/subscribe?plan=${form.plan}`,
      },
    });
    if (err) { setError(err.message); setBusy(false); return; }
    if (!data.session) { setNeedsConfirm(true); setBusy(false); return; }
    try {
      const { url } = await api('checkout', { body: { plan: form.plan } });
      window.location.href = url;
    } catch (e2) {
      setError(`Your account is ready, but checkout didn’t open: ${e2.message}. Try again from the Subscribe page.`);
      setBusy(false);
    }
  }

  if (needsConfirm) {
    return (
      <div className="auth"><div className="panel">
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>Check your inbox</h1>
        <p>We sent a confirmation link to <b>{form.email}</b>. Open it, sign in, and you&rsquo;ll go straight to payment.</p>
        <Link className="btn" to="/login?next=/subscribe">Go to sign in</Link>
      </div></div>
    );
  }

  return (
    <div className="auth">
      <form className="panel" onSubmit={submit}>
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>Create your account</h1>
        <p className="muted small">Next you&rsquo;ll pay securely with Stripe. You can change your charity later.</p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field"><label htmlFor="n">Full name</label>
          <input id="n" className="input" value={form.full_name} onChange={set('full_name')} required autoComplete="name" /></div>
        <div className="field"><label htmlFor="e">Email</label>
          <input id="e" className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></div>
        <div className="field"><label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          <span className="hint">At least 8 characters.</span></div>

        <div className="field"><label htmlFor="c">Charity you&rsquo;ll play for</label>
          <select id="c" className="input" value={form.charity_id} onChange={set('charity_id')} required>
            <option value="">Choose a charity</option>
            {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>

        <div className="field">
          <label htmlFor="pct">Charity share: {form.charity_percent}%</label>
          <input id="pct" type="range" min={CHARITY_MIN_PERCENT} max={CHARITY_MAX_PERCENT} step="5"
            value={form.charity_percent} onChange={set('charity_percent')} />
          <span className="hint">{money(charityAmount, { exact: true })} of each {PLANS[form.plan].interval}ly payment goes to your charity. Minimum {CHARITY_MIN_PERCENT}%.</span>
        </div>

        <div className="field"><label>Plan</label>
          <div className="row">
            {Object.values(PLANS).map((p) => (
              <label key={p.id} className="check" style={{ marginRight: 16 }}>
                <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={set('plan')} />
                {p.label}, {money(p.amountCents)}/{p.interval}
              </label>
            ))}
          </div></div>

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Setting up…' : 'Create account and pay'}</button>
        <p className="small muted" style={{ marginTop: 14 }}>Already a member? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
