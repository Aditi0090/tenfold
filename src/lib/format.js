import { CURRENCY_SYMBOL } from '../config/plans.js';

/** 1234 → "£12.34"; whole pounds drop the pence. */
export function money(cents = 0, { exact = false } = {}) {
  const v = (cents || 0) / 100;
  const whole = Number.isInteger(v) && !exact;
  return CURRENCY_SYMBOL + v.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  });
}

export function date(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', opts);
}

export function monthLabel(d) {
  return new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Today in YYYY-MM-DD (local). */
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Last day of the current month — when this month's draw happens. */
export function nextDrawDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Friendly message from a Supabase/Postgres error. */
export function errMsg(err) {
  const m = err?.message || String(err);
  if (/scores_user_id_played_on_key|duplicate key/.test(m)) return 'You already have a score for that date — edit it instead.';
  if (/row-level security/.test(m)) return 'Your membership needs to be active to do that.';
  if (/check constraint.*score/.test(m)) return 'Scores must be between 1 and 45.';
  return m;
}

/** Deterministic gradient for charities without an image. */
export function coverGradient(seed = '') {
  const palettes = [
    ['#e8436f', '#ffb627'], ['#1e1b4b', '#e8436f'], ['#5b5bd6', '#9ee6d8'],
    ['#ffb627', '#ff7a59'], ['#2b2a7a', '#7c7cf2'], ['#138a78', '#c9cbfb'],
  ];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = palettes[h % palettes.length];
  return `radial-gradient(circle at 80% 15%, ${b} 0 22%, transparent 23%), linear-gradient(135deg, ${a}, ${b})`;
}
