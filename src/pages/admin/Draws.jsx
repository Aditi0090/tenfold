/**
 * Draw management (PRD §11.02): configure logic, simulate, review, publish.
 * Simulations are private to admins; publishing releases exactly the
 * simulated numbers and winners.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { money, monthLabel, date } from '../../lib/format.js';
import Chips from '../../components/Chips.jsx';
import Loader from '../../components/Loader.jsx';
import { useToast } from '../../components/Toast.jsx';

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Draws() {
  const toast = useToast();
  const [draws, setDraws] = useState(null);
  const [names, setNames] = useState({});
  const [cfg, setCfg] = useState({ month: thisMonth(), mode: 'random', bias: 'most' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('draws').select('*').order('draw_month', { ascending: false });
    setDraws(data || []);
    const ids = [...new Set((data || []).flatMap((d) => (d.simulation?.winners || []).map((w) => w.userId)))];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      setNames(Object.fromEntries((ps || []).map((p) => [p.id, p.full_name || p.email])));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(body, okMsg) {
    setBusy(true);
    try { await api('admin/draw', { body }); toast(okMsg); await load(); }
    catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }

  if (!draws) return <Loader />;
  return (
    <>
      <h1 style={{ fontSize: 'var(--t-2xl)' }}>Draws</h1>
      <p className="muted">Simulate as often as you like. Members only see a draw once you publish it, and publishing can&rsquo;t be undone.</p>

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>Run a simulation</h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}><label htmlFor="m">Draw month</label>
            <input id="m" className="input" type="month" value={cfg.month} onChange={(e) => setCfg({ ...cfg, month: e.target.value })} /></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="mo">Number logic</label>
            <select id="mo" className="input" value={cfg.mode} onChange={(e) => setCfg({ ...cfg, mode: e.target.value })}>
              <option value="random">Random (lottery style)</option>
              <option value="weighted">Weighted by score frequency</option>
            </select></div>
          {cfg.mode === 'weighted' && (
            <div className="field" style={{ margin: 0 }}><label htmlFor="b">Favour</label>
              <select id="b" className="input" value={cfg.bias} onChange={(e) => setCfg({ ...cfg, bias: e.target.value })}>
                <option value="most">Most common scores</option>
                <option value="least">Least common scores</option>
              </select></div>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => run({ action: 'simulate', ...cfg }, 'Simulation ready to review')}>
            {busy ? 'Working…' : 'Simulate draw'}
          </button>
        </div>
      </div>

      {draws.length === 0 && <div className="empty">No draws yet. Simulate this month&rsquo;s draw above.</div>}
      <div className="stack">
        {draws.map((d) => (
          <div className="panel" key={d.id}>
            <div className="spread">
              <div>
                <h3 style={{ marginBottom: 4 }}>{monthLabel(d.draw_month)}</h3>
                <span className={`pill ${d.status === 'published' ? 'pill-ok' : 'pill-warn'}`}>
                  {d.status === 'published' ? `Published ${date(d.published_at)}` : `Simulation · ${date(d.simulated_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                </span>{' '}
                <span className="pill">{d.mode === 'weighted' ? `Weighted · ${d.weight_bias}` : 'Random'}</span>
              </div>
              <Chips numbers={d.numbers || []} variant="drawn" />
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}><table>
              <thead><tr><th>Tier</th><th className="num">Pot</th><th className="num">Winners</th><th className="num">Each</th></tr></thead>
              <tbody>{[5, 4, 3].map((t) => {
                const pot = d[`pool_${t}_cents`]; const n = d[`winners_${t}`];
                return <tr key={t}><td>{t} matches{t === 5 && d.rollover_in_cents > 0 ? ` (incl. ${money(d.rollover_in_cents)} rollover)` : ''}</td>
                  <td className="num">{money(pot)}</td><td className="num">{n}</td><td className="num">{n ? money(Math.floor(pot / n), { exact: true }) : '—'}</td></tr>;
              })}</tbody>
            </table></div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {d.active_subscribers} active members, {d.eligible_entries} eligible tickets. New pool {money(d.pool_total_cents)}.
              Jackpot rolling over: <b>{money(d.rollover_out_cents)}</b>. Unclaimed 4/3-tier funds: {money(d.unclaimed_cents)}.
            </p>

            {d.status === 'simulated' && (
              <>
                {(d.simulation?.winners || []).length > 0 && (
                  <div className="small" style={{ marginBottom: 12 }}>
                    <b>Winners if published:</b>{' '}
                    {d.simulation.winners.map((w) => `${names[w.userId] || w.userId.slice(0, 8)} (${w.tier})`).join(', ')}
                  </div>
                )}
                <div className="row">
                  <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => window.confirm(`Publish the ${monthLabel(d.draw_month)} draw? Members will see results and winners will be notified on their dashboards.`) && run({ action: 'publish', drawId: d.id }, 'Draw published')}>
                    Publish results
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => run({ action: 'simulate', month: d.draw_month.slice(0, 7), mode: d.mode, bias: d.weight_bias || 'most' }, 'Re-simulated')}>Re-run simulation</button>
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run({ action: 'discard', drawId: d.id }, 'Simulation discarded')}>Discard</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
