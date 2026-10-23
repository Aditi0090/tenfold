import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setError(err.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : err.message); setBusy(false); return; }
    const next = params.get('next');
    if (next?.startsWith('/')) return navigate(next);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    navigate(p?.role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <div className="auth">
      <form className="panel" onSubmit={submit}>
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>Sign in</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field"><label htmlFor="e">Email</label>
          <input id="e" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="small muted" style={{ marginTop: 14 }}>New here? <Link to="/subscribe">Choose a plan</Link></p>
      </form>
    </div>
  );
}
