import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { money, date } from '../lib/format.js';
import CharityCover from '../components/CharityCover.jsx';
import Loader from '../components/Loader.jsx';
import DonateForm from '../components/DonateForm.jsx';

/** Charity profile: description, image, upcoming events, totals, donate. */
export default function CharityDetail() {
  const { slug } = useParams();
  const [charity, setCharity] = useState(undefined);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    supabase.from('charities').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      setCharity(data);
      if (data) supabase.rpc('charity_totals').then(({ data: t }) => setTotal((t || []).find((x) => x.charity_id === data.id)));
    });
  }, [slug]);

  if (charity === undefined) return <Loader />;
  if (!charity) return <div className="wrap section"><h1>Charity not found</h1><Link to="/charities">Back to all charities</Link></div>;

  const events = (charity.events || []).filter((e) => !e.date || new Date(e.date) >= new Date(Date.now() - 864e5))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div className="wrap section">
      <Link to="/charities" className="small muted">All charities</Link>
      <div className="spotlight" style={{ marginTop: 16 }}>
        <CharityCover charity={charity} style={{ aspectRatio: '4 / 3' }} />
        <div>
          <div className="row" style={{ gap: 6 }}>
            {charity.category && <span className="pill">{charity.category}</span>}
            {charity.location && <span className="pill">{charity.location}</span>}
          </div>
          <h1 style={{ fontSize: 'var(--t-2xl)', marginTop: 14 }}>{charity.name}</h1>
          <p className="lede">{charity.tagline}</p>
          <p>{charity.description}</p>
          <p className="small"><b>{money(total?.total_cents || 0)}</b> raised through Tenfold · {total?.supporters || 0} members playing for them</p>
          <div className="row">
            <Link className="btn btn-primary" to={`/subscribe?charity=${charity.id}`}>Play for {charity.name.split(' ')[0]}</Link>
            {charity.website && <a className="btn btn-ghost" href={charity.website} target="_blank" rel="noreferrer">Visit website</a>}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 56 }}>
        <div>
          <h2>Upcoming events</h2>
          {events.length === 0 ? <p className="muted">No events announced yet.</p> : events.map((e, i) => (
            <div className="event" key={i}>
              <div className="event-date">
                <b>{e.date ? new Date(e.date).getDate() : '—'}</b>
                <span className="small muted">{e.date ? date(e.date, { month: 'short' }) : ''}</span>
              </div>
              <div><b>{e.title}</b><div className="small muted">{e.location}</div></div>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Give directly</h3>
          <p className="small muted">A one-off donation, separate from membership and the draw.</p>
          <DonateForm charityId={charity.id} />
        </div>
      </div>
    </div>
  );
}
