/** User management list (PRD §11.01). */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { date } from '../../lib/format.js';
import { subscriptionIsActive } from '../../context/AuthContext.jsx';
import Loader from '../../components/Loader.jsx';

export default function Users() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: subs }, { data: scores }] = await Promise.all([
        supabase.from('profiles').select('*, charity:charities(name)').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*'),
        supabase.from('scores').select('user_id'),
      ]);
      const subBy = new Map((subs || []).map((s) => [s.user_id, s]));
      const countBy = {};
      for (const s of scores || []) countBy[s.user_id] = (countBy[s.user_id] || 0) + 1;
      setRows((profiles || []).map((p) => ({ ...p, sub: subBy.get(p.id), scores: countBy[p.id] || 0 })));
    })();
  }, []);

  const list = useMemo(() => (rows || []).filter((r) => {
    const t = `${r.full_name} ${r.email}`.toLowerCase();
    if (q && !t.includes(q.toLowerCase())) return false;
    if (filter === 'active') return subscriptionIsActive(r.sub);
    if (filter === 'inactive') return !subscriptionIsActive(r.sub);
    if (filter === 'admin') return r.role === 'admin';
    return true;
  }), [rows, q, filter]);

  if (!rows) return <Loader />;
  return (
    <>
      <div className="spread"><h1 style={{ fontSize: 'var(--t-2xl)' }}>Users</h1><span className="muted small">{list.length} of {rows.length}</span></div>
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select className="input" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="all">Everyone</option><option value="active">Active members</option>
          <option value="inactive">No active plan</option><option value="admin">Admins</option>
        </select>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Renews / ends</th><th>Charity</th><th className="num">Scores</th><th /></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}>
            <td>{r.full_name || '—'} {r.role === 'admin' && <span className="pill">admin</span>}</td>
            <td>{r.email}</td>
            <td>{r.sub ? <span className={`pill ${subscriptionIsActive(r.sub) ? 'pill-ok' : 'pill-bad'}`}>{r.sub.plan} · {subscriptionIsActive(r.sub) ? 'active' : r.sub.status}</span> : <span className="pill">none</span>}</td>
            <td>{date(r.sub?.current_period_end)}</td>
            <td>{r.charity?.name || '—'} ({r.charity_percent}%)</td>
            <td className="num">{r.scores}/5</td>
            <td><Link className="btn btn-ghost btn-sm" to={`/admin/users/${r.id}`}>Manage</Link></td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
