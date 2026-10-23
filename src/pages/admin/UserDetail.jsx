/** Edit one user: profile, subscription, scores, wins (PRD §11.01). */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { date, money, monthLabel, errMsg } from '../../lib/format.js';
import { CHARITY_MIN_PERCENT, CHARITY_MAX_PERCENT, PLANS } from '../../config/plans.js';
import { subscriptionIsActive } from '../../context/AuthContext.jsx';
import ScoreManager from '../../components/ScoreManager.jsx';
import { verificationPill, payoutPill } from '../../components/Winnings.jsx';
import { useToast } from '../../components/Toast.jsx';
import Loader from '../../components/Loader.jsx';

export default function UserDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [sub, setSub] = useState(null);
  const [charities, setCharities] = useState([]);
  const [wins, setWins] = useState([]);
  const [grant, setGrant] = useState({ plan: 'monthly', months: 1 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: prof }, { data: s }, { data: w }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('winners').select('*, draw:draws(draw_month)').eq('user_id', id).order('created_at', { ascending: false }),
    ]);
    setP(prof); setSub(s); setWins(w || []);
  }, [id]);

  useEffect(() => {
    load();
    supabase.from('charities').select('id, name').order('name').then(({ data }) => setCharities(data || []));
  }, [load]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: p.full_name, role: p.role, charity_id: p.charity_id || null, charity_percent: Number(p.charity_percent),
    }).eq('id', id);
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    toast('Profile saved');
  }

  async function subAction(action) {
    if (action === 'cancel_now' && !window.confirm('End this subscription immediately?')) return;
    setBusy(true);
    try {
      await api('admin/subscription', { body: { userId: id, action, ...grant } });
      toast('Subscription updated');
      await load();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }

  if (!p) return <Loader />;
  const active = subscriptionIsActive(sub);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  return (
    <>
      <Link to="/admin/users" className="small muted">All users</Link>
      <h1 style={{ fontSize: 'var(--t-2xl)', marginTop: 8 }}>{p.full_name || p.email}</h1>
      <p className="muted">{p.email} · joined {date(p.created_at)}</p>

      <div className="grid-2">
        <form className="panel" onSubmit={saveProfile}>
          <h3>Profile</h3>
          <div className="field"><label htmlFor="fn">Full name</label><input id="fn" className="input" value={p.full_name || ''} onChange={set('full_name')} /></div>
          <div className="field"><label htmlFor="rl">Role</label>
            <select id="rl" className="input" value={p.role} onChange={set('role')}><option value="user">Member</option><option value="admin">Administrator</option></select></div>
          <div className="field"><label htmlFor="ch">Charity</label>
            <select id="ch" className="input" value={p.charity_id || ''} onChange={set('charity_id')}>
              <option value="">None</option>{charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="field"><label htmlFor="pc">Charity share (%)</label>
            <input id="pc" className="input" type="number" min={CHARITY_MIN_PERCENT} max={CHARITY_MAX_PERCENT} value={p.charity_percent} onChange={set('charity_percent')} /></div>
          <button className="btn btn-sm" disabled={busy}>Save profile</button>
        </form>

        <div className="panel">
          <div className="spread"><h3 style={{ margin: 0 }}>Subscription</h3>
            <span className={`pill ${active ? 'pill-ok' : 'pill-bad'}`}>{active ? 'Active' : sub?.status || 'None'}</span></div>
          {sub && <div style={{ marginTop: 10 }}>
            <div className="kv"><span>Plan</span><b>{PLANS[sub.plan]?.label} · {money(sub.amount_cents)}</b></div>
            <div className="kv"><span>Period ends</span><b>{date(sub.current_period_end)}</b></div>
            <div className="kv"><span>Cancels at period end</span><b>{sub.cancel_at_period_end ? 'Yes' : 'No'}</b></div>
            <div className="kv"><span>Source</span><b>{sub.source === 'stripe' ? 'Stripe' : 'Manual (admin)'}</b></div>
          </div>}
          <div className="row" style={{ marginTop: 12 }}>
            {active && !sub.cancel_at_period_end && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => subAction('cancel_at_period_end')}>Cancel at period end</button>}
            {active && sub.cancel_at_period_end && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => subAction('resume')}>Resume</button>}
            {active && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => subAction('cancel_now')}>End now</button>}
          </div>
          {!(active && sub?.source === 'stripe') && (
            <div style={{ marginTop: 18 }}>
              <p className="small muted">Grant complimentary access (no charge). Useful for support cases and test accounts.</p>
              <div className="row">
                <select className="input" style={{ width: 140 }} value={grant.plan} onChange={(e) => setGrant({ ...grant, plan: e.target.value })} aria-label="Plan">
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
                <input className="input" style={{ width: 100 }} type="number" min="1" max="24" value={grant.months} onChange={(e) => setGrant({ ...grant, months: e.target.value })} aria-label="Months" />
                <span className="small">months</span>
                <button className="btn btn-sm" disabled={busy} onClick={() => subAction('grant')}>Grant access</button>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <ScoreManager userId={id} canEdit />
          <p className="small muted" style={{ marginTop: 12 }}>Admins can edit scores regardless of subscription status.</p>
        </div>

        <div className="panel">
          <h3>Wins</h3>
          {wins.length === 0 ? <p className="small muted">No wins.</p> : wins.map((w) => (
            <div className="kv" key={w.id}><span>{monthLabel(w.draw.draw_month)} · {w.tier} matches</span>
              <b className="row" style={{ gap: 6 }}>{money(w.prize_cents)} {verificationPill(w.verification_status)} {payoutPill(w.payout_status)}</b></div>
          ))}
        </div>
      </div>
    </>
  );
}
