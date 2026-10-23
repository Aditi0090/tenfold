import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import DonateForm from '../components/DonateForm.jsx';

/** Standalone donation page — no membership needed. */
export default function Donate() {
  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState('');
  useEffect(() => {
    supabase.from('charities').select('id, name').eq('active', true).order('name').then(({ data }) => {
      setCharities(data || []);
      if (data?.[0]) setCharityId(data[0].id);
    });
  }, []);
  return (
    <div className="auth">
      <div className="panel">
        <h1 style={{ fontSize: 'var(--t-2xl)' }}>Make a one-off donation</h1>
        <p className="muted">100% of a direct donation goes to the charity you choose. It isn&rsquo;t an entry into the draw.</p>
        <div className="field">
          <label htmlFor="ch">Charity</label>
          <select id="ch" className="input" value={charityId} onChange={(e) => setCharityId(e.target.value)}>
            {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <DonateForm charityId={charityId} />
      </div>
    </div>
  );
}
