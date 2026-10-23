/** Reports & analytics (PRD §11.05). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { money, monthLabel } from '../../lib/format.js';
import { computePoolTotal } from '../../lib/drawEngine.js';
import { subscriptionIsActive } from '../../context/AuthContext.jsx';
import Loader from '../../components/Loader.jsx';

export default function Overview() {
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const [users, subs, donations, charities, draws, winners] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*'),
        supabase.from('donations').select('charity_id, amount_cents, kind'),
        supabase.from('charities').select('id, name'),
        supabase.from('draws').select('*').order('draw_month', { ascending: false }),
        supabase.from('winners').select('prize_cents, payout_status, verification_status'),
      ]);
      const active = (subs.data || []).filter(subscriptionIsActive);
      const byCharity = new Map((charities.data || []).map((c) => [c.id, { name: c.name, total: 0 }]));
      for (const x of donations.data || []) if (byCharity.has(x.charity_id)) byCharity.get(x.charity_id).total += x.amount_cents;
      const published = (draws.data || []).filter((x) => x.status === 'published');
      setD({
        totalUsers: users.count || 0,
        active: active.length,
        monthly: active.filter((s) => s.plan === 'monthly').length,
        yearly: active.filter((s) => s.plan === 'yearly').length,
        pool: computePoolTotal(active),
        rollover: published[0]?.rollover_out_cents || 0,
        charityTotal: (donations.data || []).reduce((s, x) => s + x.amount_cents, 0),
        independent: (donations.data || []).filter((x) => x.kind === 'independent').reduce((s, x) => s + x.amount_cents, 0),
        byCharity: [...byCharity.values()].sort((a, b) => b.total - a.total),
        draws: draws.data || [],
        prizesAwarded: (winners.data || []).filter((w) => w.verification_status !== 'rejected').reduce((s, w) => s + w.prize_cents, 0),
        paidOut: (winners.data || []).filter((w) => w.payout_status === 'paid').reduce((s, w) => s + w.prize_cents, 0),
        toReview: (winners.data || []).filter((w) => w.verification_status === 'pending_review').length,
      });
    })();
  }, []);

  if (!d) return <Loader />;
  const maxCharity = Math.max(1, ...d.byCharity.map((c) => c.total));

  return (
    <>
      <h1 style={{ fontSize: 'var(--t-2xl)' }}>Reports</h1>
      {d.toReview > 0 && <div className="alert alert-warn"><Link to="/admin/winners">{d.toReview} winner proof{d.toReview > 1 ? 's' : ''} waiting for review.</Link></div>}
      <div className="stat-grid">
        <Stat label="Total users" value={d.totalUsers} />
        <Stat label="Active subscribers" value={d.active} sub={`${d.monthly} monthly · ${d.yearly} yearly`} />
        <Stat label="This month's prize pool" value={money(d.pool)} sub={d.rollover ? `+ ${money(d.rollover)} jackpot rollover` : 'No rollover'} />
        <Stat label="Raised for charity" value={money(d.charityTotal)} sub={`${money(d.independent)} from one-off donations`} />
        <Stat label="Prizes awarded" value={money(d.prizesAwarded)} sub={`${money(d.paidOut)} paid out`} />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Charity contributions</h3>
          {d.byCharity.map((c) => (
            <div className="bar-row" key={c.name}>
              <span>{c.name}</span>
              <div className="bar"><span style={{ width: `${(c.total / maxCharity) * 100}%` }} /></div>
              <b className="num" style={{ textAlign: 'right' }}>{money(c.total)}</b>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Draw statistics</h3>
          {d.draws.length === 0 ? <p className="muted small">No draws yet. <Link to="/admin/draws">Run a simulation</Link>.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Month</th><th className="num">Entries</th><th className="num">5 / 4 / 3</th><th className="num">Pool</th><th>Status</th></tr></thead>
              <tbody>{d.draws.map((x) => (
                <tr key={x.id}><td>{monthLabel(x.draw_month)}</td><td className="num">{x.eligible_entries}</td>
                  <td className="num">{x.winners_5} / {x.winners_4} / {x.winners_3}</td>
                  <td className="num">{money(x.pool_total_cents + x.rollover_in_cents)}</td>
                  <td><span className={`pill ${x.status === 'published' ? 'pill-ok' : 'pill-warn'}`}>{x.status}</span></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub }) {
  return <div className="stat"><div className="small muted">{label}</div><div className="big-num">{value}</div>{sub && <div className="small muted">{sub}</div>}</div>;
}
