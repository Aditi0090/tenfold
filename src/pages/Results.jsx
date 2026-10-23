import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { money, monthLabel } from '../lib/format.js';
import Chips from '../components/Chips.jsx';
import Loader from '../components/Loader.jsx';

/** Public list of published draws. */
export default function Results() {
  const [draws, setDraws] = useState(null);
  useEffect(() => {
    supabase.from('draws').select('*').eq('status', 'published').order('draw_month', { ascending: false })
      .then(({ data }) => setDraws(data || []));
  }, []);
  return (
    <div className="wrap section">
      <h1>Draw results</h1>
      <p className="lede">Every published draw, newest first.</p>
      {!draws ? <Loader /> : draws.length === 0 ? <div className="empty" style={{ marginTop: 24 }}>The first draw hasn&rsquo;t been published yet. It runs at the end of the month.</div> : (
        <div className="stack" style={{ marginTop: 28 }}>
          {draws.map((d) => (
            <div className="panel" key={d.id}>
              <div className="spread">
                <div>
                  <h3>{monthLabel(d.draw_month)}</h3>
                  <span className="pill">{d.mode === 'weighted' ? `Weighted (${d.weight_bias === 'least' ? 'rarer scores favoured' : 'common scores favoured'})` : 'Random'}</span>
                </div>
                <Chips numbers={d.numbers || []} variant="drawn" />
              </div>
              <div className="grid-3 small" style={{ marginTop: 18 }}>
                <div><b>5 matches:</b> {d.winners_5 ? `${d.winners_5} winner${d.winners_5 > 1 ? 's' : ''} share ${money(d.pool_5_cents)}` : `No winner, ${money(d.rollover_out_cents)} rolled over`}</div>
                <div><b>4 matches:</b> {d.winners_4} winner{d.winners_4 === 1 ? '' : 's'} share {money(d.pool_4_cents)}</div>
                <div><b>3 matches:</b> {d.winners_3} winner{d.winners_3 === 1 ? '' : 's'} share {money(d.pool_3_cents)}</div>
              </div>
              <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>{d.eligible_entries} tickets entered from {d.active_subscribers} active members.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
