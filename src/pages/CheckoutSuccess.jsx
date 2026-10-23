import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Stripe redirects here. We confirm the payment server-side, then refresh. */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    const id = params.get('session_id');
    api(`checkout-status?session_id=${encodeURIComponent(id || '')}`, { method: 'GET' })
      .then(async (r) => { await refresh(); setState({ loading: false, ...r }); })
      .catch((e) => setState({ loading: false, error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth"><div className="panel">
      {state.loading && <p>Confirming your payment with Stripe…</p>}
      {state.error && <>
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>We couldn&rsquo;t confirm that payment</h1>
        <div className="alert alert-error">{state.error}</div>
        <p className="muted">If you were charged, your membership will appear on your dashboard within a few minutes.</p>
        <Link className="btn" to="/dashboard">Go to my dashboard</Link>
      </>}
      {state.kind === 'donation' && <>
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>Thank you</h1>
        <p className="lede">{state.paid ? `Your ${money(state.amount)} donation is on its way.` : 'Your donation is processing.'}</p>
        <Link className="btn" to="/charities">Back to charities</Link>
      </>}
      {state.kind === 'subscription' && <>
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>{state.active ? 'Welcome to Tenfold' : 'Payment received'}</h1>
        <p className="lede">{state.active ? 'Your membership is active. Log five rounds to enter this month’s draw.' : 'Your membership will activate as soon as Stripe confirms the payment.'}</p>
        <Link className="btn btn-primary" to="/dashboard">Log my scores</Link>
      </>}
    </div></div>
  );
}
