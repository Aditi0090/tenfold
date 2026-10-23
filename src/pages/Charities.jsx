import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { money } from '../lib/format.js';
import CharityCover from '../components/CharityCover.jsx';
import Loader from '../components/Loader.jsx';

/** Charity directory with search + category filter (PRD §08.2). */
export default function Charities() {
  const [charities, setCharities] = useState(null);
  const [totals, setTotals] = useState({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  useEffect(() => {
    supabase.from('charities').select('*').eq('active', true).order('featured', { ascending: false }).order('name')
      .then(({ data }) => setCharities(data || []));
    supabase.rpc('charity_totals').then(({ data }) =>
      setTotals(Object.fromEntries((data || []).map((t) => [t.charity_id, t]))));
  }, []);

  const categories = useMemo(() => [...new Set((charities || []).map((c) => c.category).filter(Boolean))].sort(), [charities]);
  const list = useMemo(() => (charities || []).filter((c) => {
    const text = `${c.name} ${c.tagline} ${c.description} ${c.location}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!cat || c.category === cat);
  }), [charities, q, cat]);

  return (
    <div className="wrap section">
      <h1>Choose who you play for</h1>
      <p className="lede">Every member picks one of these charities. Members can switch at any time, and anyone can donate directly.</p>

      <div className="row" style={{ margin: '28px 0' }}>
        <input className="input" style={{ maxWidth: 360 }} type="search" placeholder="Search by name, cause or place"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search charities" />
        <select className="input" style={{ maxWidth: 240 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by cause">
          <option value="">All causes</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {!charities ? <Loader /> : list.length === 0 ? (
        <div className="empty">No charities match that search. Try a different word or clear the filter.</div>
      ) : (
        <div className="grid-3">
          {list.map((c) => (
            <Link key={c.id} to={`/charities/${c.slug}`} className="charity-card">
              <CharityCover charity={c} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  {c.category && <span className="pill">{c.category}</span>}
                  {c.featured && <span className="pill pill-rose">Featured</span>}
                </div>
                <h3>{c.name}</h3>
                <p className="small muted" style={{ marginBottom: 4 }}>{c.tagline}</p>
                <p className="small"><b>{money(totals[c.id]?.total_cents || 0)}</b> raised · {totals[c.id]?.supporters || 0} members</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
