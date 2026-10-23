/** Winner verification + payout tracking (PRD §09, §11.04). */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { money, monthLabel, date } from '../../lib/format.js';
import { verificationPill, payoutPill } from '../../components/Winnings.jsx';
import Modal from '../../components/Modal.jsx';
import Loader from '../../components/Loader.jsx';
import { useToast } from '../../components/Toast.jsx';

const FILTERS = [
  ['pending_review', 'Needs review'], ['awaiting_proof', 'Waiting for proof'],
  ['to_pay', 'Approved, not paid'], ['paid', 'Paid'], ['all', 'All'],
];

export default function Winners() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending_review');
  const [review, setReview] = useState(null); // { win, url, note }

  const load = useCallback(async () => {
    const { data } = await supabase.from('winners')
      .select('*, draw:draws(draw_month), user:profiles(full_name, email)').order('created_at', { ascending: false });
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = (rows || []).filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'to_pay') return w.verification_status === 'approved' && w.payout_status === 'pending';
    if (filter === 'paid') return w.payout_status === 'paid';
    return w.verification_status === filter;
  });

  async function open(win) {
    let url = null;
    if (win.proof_path) {
      const { data } = await supabase.storage.from('winner-proofs').createSignedUrl(win.proof_path, 600);
      url = data?.signedUrl;
    }
    setReview({ win, url, note: win.admin_note || '' });
  }

  async function update(id, patch, msg) {
    const { error } = await supabase.from('winners').update(patch).eq('id', id);
    if (error) return toast(error.message, 'error');
    toast(msg); setReview(null); load();
  }

  if (!rows) return <Loader />;
  return (
    <>
      <h1 style={{ fontSize: 'var(--t-2xl)' }}>Winners</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? '' : 'btn-ghost'}`} onClick={() => setFilter(k)}>
            {label} ({(rows || []).filter((w) => k === 'all' || (k === 'to_pay' ? w.verification_status === 'approved' && w.payout_status === 'pending' : k === 'paid' ? w.payout_status === 'paid' : w.verification_status === k)).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? <div className="empty">Nothing here right now.</div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Draw</th><th>Member</th><th className="num">Tier</th><th className="num">Prize</th><th>Verification</th><th>Payout</th><th /></tr></thead>
          <tbody>{list.map((w) => (
            <tr key={w.id}>
              <td>{monthLabel(w.draw.draw_month)}</td>
              <td>{w.user?.full_name || '—'}<div className="small muted">{w.user?.email}</div></td>
              <td className="num">{w.tier}</td><td className="num">{money(w.prize_cents, { exact: true })}</td>
              <td>{verificationPill(w.verification_status)}</td>
              <td>{payoutPill(w.payout_status)}{w.paid_at && <div className="small muted">{date(w.paid_at)}</div>}</td>
              <td className="row" style={{ gap: 6 }}>
                {w.proof_path && <button className="btn btn-ghost btn-sm" onClick={() => open(w)}>Review proof</button>}
                {w.verification_status === 'approved' && w.payout_status === 'pending' && (
                  <button className="btn btn-sm" onClick={() => update(w.id, { payout_status: 'paid', paid_at: new Date().toISOString() }, 'Marked as paid')}>Mark paid</button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {review && (
        <Modal title={`Proof from ${review.win.user?.full_name || 'member'}`} onClose={() => setReview(null)}>
          <p className="small muted">{monthLabel(review.win.draw.draw_month)} · {review.win.tier} matches · {money(review.win.prize_cents, { exact: true })}. Submitted {date(review.win.proof_submitted_at)}.</p>
          {review.url ? <a href={review.url} target="_blank" rel="noreferrer"><img src={review.url} alt="Score screenshot submitted by the winner" style={{ borderRadius: 12, border: '1px solid var(--line)' }} /></a>
            : <div className="empty">Proof file couldn&rsquo;t be loaded.</div>}
          <div className="field" style={{ marginTop: 14 }}><label htmlFor="note">Note to member (shown on their dashboard)</label>
            <textarea id="note" className="input" value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} placeholder="Required when rejecting, e.g. the dates don't match" /></div>
          {review.win.verification_status === 'pending_review' && (
            <div className="row">
              <button className="btn btn-primary" onClick={() => update(review.win.id, { verification_status: 'approved', reviewed_at: new Date().toISOString(), admin_note: review.note || null }, 'Win approved')}>Approve</button>
              <button className="btn btn-danger" onClick={() => {
                if (!review.note.trim()) return toast('Add a note so the member knows what to fix.', 'error');
                update(review.win.id, { verification_status: 'rejected', reviewed_at: new Date().toISOString(), admin_note: review.note }, 'Submission rejected');
              }}>Reject</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
