/**
 * Score entry + edit (PRD §05).
 * - 1–45 Stableford points, one score per date, dated today or earlier.
 * - Only the latest 5 are kept: the database trigger drops the oldest.
 * - Shown newest first.
 * Used by members on their dashboard and by admins (adminUserId set).
 */
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase.js';
import { date, errMsg, todayISO } from '../lib/format.js';
import { SCORE_MIN, SCORE_MAX, SCORES_KEPT } from '../config/plans.js';
import { useToast } from './Toast.jsx';

export default function ScoreManager({ userId, canEdit = true, lockedMessage, onChange }) {
  const toast = useToast();
  const [scores, setScores] = useState(null);
  const [score, setScore] = useState('');
  const [playedOn, setPlayedOn] = useState(todayISO());
  const [editing, setEditing] = useState(null); // { id, score, played_on }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('scores').select('*').eq('user_id', userId)
      .order('played_on', { ascending: false });
    setScores(data || []);
    onChange?.(data || []);
  }, [userId, onChange]);

  useEffect(() => { load(); }, [load]);

  function validate(s, d) {
    const n = Number(s);
    if (!Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX) return `Enter a whole number from ${SCORE_MIN} to ${SCORE_MAX}.`;
    if (!d) return 'Choose the date you played.';
    if (d > todayISO()) return 'That date is in the future.';
    return '';
  }

  async function add(e) {
    e.preventDefault();
    const v = validate(score, playedOn);
    if (v) return setError(v);
    if (scores?.some((s) => s.played_on === playedOn)) return setError('You already have a score for that date. Edit it instead.');
    setBusy(true); setError('');
    const { error: err } = await supabase.from('scores').insert({ user_id: userId, score: Number(score), played_on: playedOn });
    setBusy(false);
    if (err) return setError(errMsg(err));
    const dropped = (scores?.length || 0) >= SCORES_KEPT;
    toast(dropped ? 'Score added. Your oldest round dropped off.' : 'Score added');
    setScore('');
    load();
  }

  async function saveEdit(e) {
    e.preventDefault();
    const v = validate(editing.score, editing.played_on);
    if (v) return setError(v);
    setBusy(true); setError('');
    const { error: err } = await supabase.from('scores')
      .update({ score: Number(editing.score), played_on: editing.played_on }).eq('id', editing.id);
    setBusy(false);
    if (err) return setError(errMsg(err));
    toast('Score updated');
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this score?')) return;
    const { error: err } = await supabase.from('scores').delete().eq('id', id);
    if (err) return toast(errMsg(err), 'error');
    toast('Score deleted');
    load();
  }

  const count = scores?.length || 0;

  return (
    <div>
      <div className="spread">
        <h3 style={{ margin: 0 }}>Your last five rounds</h3>
        <span className="small muted">{count} of {SCORES_KEPT}</span>
      </div>
      <div className="slots" aria-hidden="true">
        {Array.from({ length: SCORES_KEPT }, (_, i) => <span key={i} className={`slot ${i < count ? 'on' : ''}`} />)}
      </div>
      <p className="small muted">{count < SCORES_KEPT
        ? `Add ${SCORES_KEPT - count} more to enter the draw.`
        : 'Your ticket is complete. A new round replaces your oldest.'}</p>

      {error && <div className="alert alert-error">{error}</div>}

      {scores && scores.length === 0 && <div className="empty">No rounds yet. Add the Stableford points from your most recent round below.</div>}
      <ul className="score-list">
        <AnimatePresence initial={false}>
          {(scores || []).map((s) => (
            <motion.li key={s.id} className="score-item" layout
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, height: 0 }}>
              {editing?.id === s.id ? (
                <form className="row" onSubmit={saveEdit} style={{ width: '100%' }}>
                  <input className="input" style={{ width: 90 }} type="number" min={SCORE_MIN} max={SCORE_MAX} aria-label="Score"
                    value={editing.score} onChange={(e) => setEditing({ ...editing, score: e.target.value })} />
                  <input className="input" style={{ width: 170 }} type="date" max={todayISO()} aria-label="Date played"
                    value={editing.played_on} onChange={(e) => setEditing({ ...editing, played_on: e.target.value })} />
                  <button className="btn btn-sm" disabled={busy}>Save</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span className="chip">{s.score}</span>
                  <span className="date">{date(s.played_on, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {canEdit && <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: s.id, score: s.score, played_on: s.played_on })}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Delete</button>
                  </>}
                </>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {canEdit ? (
        <form className="score-form" onSubmit={add}>
          <div className="field"><label htmlFor="sc">Stableford points</label>
            <input id="sc" className="input" type="number" inputMode="numeric" min={SCORE_MIN} max={SCORE_MAX} placeholder="e.g. 34"
              value={score} onChange={(e) => setScore(e.target.value)} required /></div>
          <div className="field"><label htmlFor="pd">Date played</label>
            <input id="pd" className="input" type="date" max={todayISO()} value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} required /></div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add round'}</button>
        </form>
      ) : (
        <div className="alert alert-warn" style={{ marginTop: 16 }}>{lockedMessage}</div>
      )}
    </div>
  );
}
