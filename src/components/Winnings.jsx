/** Member's wins + proof upload (PRD §09). */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { money, monthLabel } from '../lib/format.js';
import { useToast } from './Toast.jsx';

const MAX_BYTES = 5 * 1024 * 1024;

export function verificationPill(status) {
  const map = {
    awaiting_proof: ['pill-warn', 'Proof needed'],
    pending_review: ['', 'In review'],
    approved: ['pill-ok', 'Approved'],
    rejected: ['pill-bad', 'Rejected'],
  };
  const [cls, label] = map[status] || ['', status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function payoutPill(status) {
  return status === 'paid' ? <span className="pill pill-ok">Paid</span> : <span className="pill pill-gold">Payment pending</span>;
}

export default function Winnings({ userId }) {
  const toast = useToast();
  const [wins, setWins] = useState(null);
  const [uploading, setUploading] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('winners').select('*, draw:draws(draw_month, numbers)')
      .eq('user_id', userId).order('created_at', { ascending: false });
    setWins(data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  async function upload(win, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Upload an image (PNG or JPG screenshot).', 'error');
    if (file.size > MAX_BYTES) return toast('That file is over 5 MB. Try a smaller screenshot.', 'error');
    setUploading(win.id);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/${win.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('winner-proofs').upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(null); return toast(upErr.message, 'error'); }
    const { error } = await supabase.rpc('submit_winner_proof', { p_winner_id: win.id, p_path: path });
    setUploading(null);
    if (error) return toast(error.message, 'error');
    toast('Proof sent for review');
    load();
  }

  const total = (wins || []).reduce((s, w) => s + (w.verification_status === 'rejected' ? 0 : w.prize_cents), 0);
  const paid = (wins || []).filter((w) => w.payout_status === 'paid').reduce((s, w) => s + w.prize_cents, 0);

  return (
    <div>
      <h3>Winnings</h3>
      <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
        <div><div className="small muted">Total won</div><div className="big-num">{money(total)}</div></div>
        <div><div className="small muted">Paid to you</div><div className="big-num">{money(paid)}</div></div>
      </div>
      {wins && wins.length === 0 && <p className="small muted">No wins yet. Match three or more numbers in a draw to win.</p>}
      {(wins || []).map((w) => (
        <div key={w.id} className="kv" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="spread">
            <b>{monthLabel(w.draw.draw_month)} · {w.tier} matches · {money(w.prize_cents)}</b>
            <span className="row" style={{ gap: 6 }}>{verificationPill(w.verification_status)}{w.verification_status === 'approved' && payoutPill(w.payout_status)}</span>
          </div>
          {w.admin_note && <p className="small" style={{ margin: '6px 0 0' }}>Note from our team: {w.admin_note}</p>}
          {['awaiting_proof', 'rejected'].includes(w.verification_status) && (
            <label className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              {uploading === w.id ? 'Uploading…' : w.verification_status === 'rejected' ? 'Upload a new screenshot' : 'Upload score screenshot'}
              <input type="file" accept="image/*" hidden disabled={uploading === w.id} onChange={(e) => upload(w, e.target.files?.[0])} />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
