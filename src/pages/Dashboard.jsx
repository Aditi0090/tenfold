import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { money, date, monthLabel, nextDrawDate, errMsg } from '../lib/format.js';
import { PLANS, CHARITY_MIN_PERCENT, CHARITY_MAX_PERCENT, SCORES_KEPT } from '../config/plans.js';
import ScoreManager from '../components/ScoreManager.jsx';
import Winnings from '../components/Winnings.jsx';
import Chips from '../components/Chips.jsx';
import { useToast } from '../components/Toast.jsx';

/** Member dashboard — every module required by PRD §10. */
export default function Dashboard() {
  const { user, profile, subscription, isActive, refresh } = useAuth();
  const [scoreCount, setScoreCount] = useState(0);
  const onScores = useCallback((list) => setScoreCount(list.length), []);

  if (!profile) return <div className="loader">Loading your dashboard…</div>;

  return (
    <div className="wrap">
      <div className="dash-head spread">
        <div>
          <h1 style={{ fontSize: 'var(--t-2xl)', marginBottom: 4 }}>Hi {profile.full_name?.split(' ')[0] || 'there'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {isActive
              ? scoreCount >= SCORES_KEPT ? `You're in the ${date(nextDrawDate(), { day: 'numeric', month: 'long' })} draw.` : `Add ${SCORES_KEPT - scoreCount} more round${SCORES_KEPT - scoreCount === 1 ? '' : 's'} to enter this month's draw.`
              : 'Your membership isn’t active, so score entry and draws are paused.'}
          </p>
        </div>
        {!isActive && <Link className="btn btn-primary" to="/subscribe">Subscribe to play</Link>}
      </div>

      <div className="dash-grid">
        <div className="stack">
          <div className="panel">
            <ScoreManager userId={user.id} canEdit={isActive} onChange={onScores}
              lockedMessage={<>Score entry needs an active membership. <Link to="/subscribe">Subscribe</Link> to log rounds.</>} />
          </div>
          <div className="panel"><Participation userId={user.id} eligible={isActive && scoreCount >= SCORES_KEPT} /></div>
          <div className="panel"><Winnings userId={user.id} /></div>
        </div>
        <div className="stack">
          <div className="panel"><Membership subscription={subscription} isActive={isActive} refresh={refresh} /></div>
          <div className="panel"><CharityChoice profile={profile} subscription={subscription} refresh={refresh} /></div>
          <div className="panel panel-peri">
            <h3>Give a little extra</h3>
            <p className="small muted">One-off donations go entirely to the charity and don&rsquo;t affect the draw.</p>
            <Link className="btn btn-rose btn-sm" to="/donate">Make a donation</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusPill(sub, isActive) {
  if (isActive && sub?.cancel_at_period_end) return <span className="pill pill-warn">Ends {date(sub.current_period_end)}</span>;
  if (isActive) return <span className="pill pill-ok">Active</span>;
  if (sub?.status === 'past_due') return <span className="pill pill-bad">Payment failed</span>;
  if (sub?.status === 'canceled') return <span className="pill pill-bad">Cancelled</span>;
  if (sub && sub.current_period_end && new Date(sub.current_period_end) < new Date()) return <span className="pill pill-bad">Lapsed</span>;
  return <span className="pill">Inactive</span>;
}

function Membership({ subscription: sub, isActive, refresh }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function act(action) {
    if (action === 'cancel' && !window.confirm('Cancel at the end of your current period? You keep access until then.')) return;
    setBusy(true);
    try {
      await api('subscription', { body: { action } });
      await refresh();
      toast(action === 'cancel' ? 'Your membership will end at the end of this period' : 'Your membership will renew');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }
  return (
    <div>
      <div className="spread"><h3 style={{ margin: 0 }}>Membership</h3>{statusPill(sub, isActive)}</div>
      <div style={{ marginTop: 12 }}>
        <div className="kv"><span>Plan</span><b>{sub ? `${PLANS[sub.plan]?.label} · ${money(sub.amount_cents)}` : 'None'}</b></div>
        <div className="kv"><span>{sub?.cancel_at_period_end || !isActive ? 'Access until' : 'Renews on'}</span><b>{date(sub?.current_period_end)}</b></div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        {isActive && !sub?.cancel_at_period_end && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act('cancel')}>Cancel membership</button>}
        {isActive && sub?.cancel_at_period_end && <button className="btn btn-sm" disabled={busy} onClick={() => act('resume')}>Keep my membership</button>}
        {!isActive && <Link className="btn btn-primary btn-sm" to="/subscribe">{sub ? 'Renew membership' : 'Subscribe'}</Link>}
      </div>
    </div>
  );
}

function CharityChoice({ profile, subscription, refresh }) {
  const toast = useToast();
  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState(profile.charity_id || '');
  const [pct, setPct] = useState(profile.charity_percent);
  const [given, setGiven] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('charities').select('id, name').eq('active', true).order('name').then(({ data }) => setCharities(data || []));
    supabase.from('donations').select('amount_cents').eq('user_id', profile.id)
      .then(({ data }) => setGiven((data || []).reduce((s, d) => s + d.amount_cents, 0)));
  }, [profile.id]);

  const fee = subscription?.amount_cents || PLANS.monthly.amountCents;
  const changed = charityId !== (profile.charity_id || '') || Number(pct) !== profile.charity_percent;

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ charity_id: charityId || null, charity_percent: Number(pct) }).eq('id', profile.id);
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    await refresh();
    toast('Charity settings saved');
  }

  return (
    <div>
      <h3>Your charity</h3>
      <div className="field"><label htmlFor="dc">Playing for</label>
        <select id="dc" className="input" value={charityId} onChange={(e) => setCharityId(e.target.value)}>
          <option value="">Choose a charity</option>
          {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="dp">Contribution: {pct}%</label>
        <input id="dp" type="range" min={CHARITY_MIN_PERCENT} max={CHARITY_MAX_PERCENT} step="5" value={pct} onChange={(e) => setPct(e.target.value)} />
        <span className="hint">{money(Math.floor(fee * pct / 100), { exact: true })} from each payment. Applies from your next renewal.</span></div>
      {changed && <button className="btn btn-sm" disabled={busy} onClick={save}>Save charity settings</button>}
      <div className="kv" style={{ marginTop: 10 }}><span>You&rsquo;ve given so far</span><b>{money(given, { exact: true })}</b></div>
      {profile.charity && <Link className="small" to={`/charities/${profile.charity.slug}`}>About {profile.charity.name}</Link>}
    </div>
  );
}

function Participation({ userId, eligible }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    supabase.from('draw_entries').select('*, draw:draws(draw_month, numbers)').eq('user_id', userId)
      .then(({ data }) => setEntries((data || []).sort((a, b) => b.draw.draw_month.localeCompare(a.draw.draw_month))));
  }, [userId]);
  return (
    <div>
      <h3>Draws</h3>
      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div><div className="small muted">Draws entered</div><div className="big-num">{entries?.length ?? '–'}</div></div>
        <div><div className="small muted">Next draw</div>
          <div className="big-num" style={{ fontSize: 'var(--t-xl)' }}>{date(nextDrawDate(), { day: 'numeric', month: 'short' })}</div>
          <span className={`pill ${eligible ? 'pill-ok' : 'pill-warn'}`}>{eligible ? 'You’re entered' : 'Not entered yet'}</span></div>
      </div>
      {(entries || []).slice(0, 6).map((e) => (
        <div className="kv" key={e.id} style={{ alignItems: 'center' }}>
          <span>{monthLabel(e.draw.draw_month)}<br /><span className="small muted">{e.match_count} match{e.match_count === 1 ? '' : 'es'}</span></span>
          <Chips small numbers={e.numbers} hits={e.draw.numbers || []} />
        </div>
      ))}
      {entries && entries.length === 0 && <p className="small muted" style={{ margin: 0 }}>Past draws you entered will show here with your matched numbers highlighted.</p>}
    </div>
  );
}
