/**
 * Draw engine — pure functions, no database or network access.
 *
 * Used by the server (/api/admin/draw.js) to simulate and publish draws,
 * and covered by unit tests in drawEngine.test.js.
 *
 * HOW A DRAW WORKS (our resolution of PRD §06–07)
 * ------------------------------------------------
 * 1. Each eligible member's "ticket" is their 5 stored Stableford scores
 *    (each 1–45). Eligible = active subscription + exactly 5 scores.
 * 2. Five distinct winning numbers between 1 and 45 are drawn, either:
 *      - random:   every number equally likely (lottery style), or
 *      - weighted: probability follows how often each value appears across
 *                  all tickets. bias "most" favours common scores (more
 *                  winners), bias "least" favours rare scores (fewer winners,
 *                  bigger rollovers).
 * 3. A ticket's match count = how many DISTINCT ticket values appear in the
 *    winning numbers. (If you scored 30 twice it can only match "30" once.)
 * 4. Tiers: 5 matches → 40% (+ jackpot rollover), 4 → 35%, 3 → 25%.
 *    Each tier is split equally between its winners, rounded down to the
 *    penny. Leftover pennies from the jackpot roll over; from tiers 4/3
 *    they are recorded as unclaimed.
 * 5. If nobody matches 5, the whole 5-tier pot rolls over to next month.
 *    Unwon 4- and 3-tier pots do NOT roll over (PRD §07) — they are
 *    recorded as "unclaimed" and retained by the platform.
 */

import {
  PRIZE_POOL_SHARE, TIER_SHARES, SCORE_MIN, SCORE_MAX, NUMBERS_PER_DRAW, PLANS,
} from '../config/plans.js';

/** Cryptographically strong random float in [0, 1). Injected in tests. */
export function secureRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** All valid numbers: [1, 2, ..., 45]. */
const ALL_NUMBERS = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => i + SCORE_MIN);

/** Lottery-style draw: 5 distinct numbers, uniformly random. */
export function drawRandomNumbers(rng = secureRandom) {
  return weightedSampleWithoutReplacement(ALL_NUMBERS.map((n) => [n, 1]), NUMBERS_PER_DRAW, rng);
}

/** How many times each score value appears across all tickets. */
export function scoreFrequencies(entries) {
  const freq = new Map(ALL_NUMBERS.map((n) => [n, 0]));
  for (const e of entries) for (const s of e.numbers) freq.set(s, (freq.get(s) || 0) + 1);
  return freq;
}

/**
 * Algorithmic draw weighted by score frequency.
 * Every number keeps a base weight of 1 so any number can still be drawn.
 */
export function drawWeightedNumbers(entries, bias = 'most', rng = secureRandom) {
  const freq = scoreFrequencies(entries);
  const maxFreq = Math.max(0, ...freq.values());
  const weighted = ALL_NUMBERS.map((n) => {
    const f = freq.get(n) || 0;
    const w = bias === 'least' ? 1 + (maxFreq - f) : 1 + f;
    return [n, w];
  });
  return weightedSampleWithoutReplacement(weighted, NUMBERS_PER_DRAW, rng);
}

/** Pick k distinct items from [[value, weight], ...]. Returns sorted values. */
function weightedSampleWithoutReplacement(pairs, k, rng) {
  const pool = pairs.slice();
  const picked = [];
  while (picked.length < k && pool.length) {
    const total = pool.reduce((sum, [, w]) => sum + w, 0);
    let r = rng() * total;
    let idx = pool.findIndex(([, w]) => (r -= w) < 0);
    if (idx === -1) idx = pool.length - 1; // floating-point guard
    picked.push(pool[idx][0]);
    pool.splice(idx, 1);
  }
  return picked.sort((a, b) => a - b);
}

/** Number of distinct ticket values found in the winning numbers. */
export function countMatches(ticket, winning) {
  const win = new Set(winning);
  return [...new Set(ticket)].filter((n) => win.has(n)).length;
}

/** Monthly prize-pool contribution of one subscription (pence). */
export function monthlyContributionCents(sub) {
  const plan = PLANS[sub.plan];
  const amount = sub.amount_cents ?? plan?.amountCents ?? 0;
  const monthly = sub.plan === 'yearly' ? Math.round(amount / 12) : amount;
  return Math.floor(monthly * PRIZE_POOL_SHARE);
}

/** Total prize pool generated this month by all active subscriptions. */
export function computePoolTotal(activeSubscriptions) {
  return activeSubscriptions.reduce((sum, s) => sum + monthlyContributionCents(s), 0);
}

/** Split the pool into tier pots. The jackpot rollover is added to tier 5. */
export function splitPool(poolTotalCents, rolloverInCents = 0) {
  const pool4 = Math.floor(poolTotalCents * TIER_SHARES[4]);
  const pool3 = Math.floor(poolTotalCents * TIER_SHARES[3]);
  // Tier 5 takes the remainder so the three pots always sum exactly.
  const pool5 = poolTotalCents - pool4 - pool3 + rolloverInCents;
  return { 5: pool5, 4: pool4, 3: pool3 };
}

/**
 * Run a full draw.
 * @param {object}   p
 * @param {Array<{userId:string, numbers:number[]}>} p.entries  eligible tickets
 * @param {number[]} p.numbers          winning numbers (already drawn)
 * @param {number}   p.poolTotalCents   this month's new contributions
 * @param {number}   p.rolloverInCents  jackpot carried in from last month
 * @returns full, serialisable result object
 */
export function settleDraw({ entries, numbers, poolTotalCents, rolloverInCents = 0 }) {
  const pots = splitPool(poolTotalCents, rolloverInCents);

  const results = entries.map((e) => ({
    userId: e.userId,
    numbers: e.numbers,
    matchCount: countMatches(e.numbers, numbers),
  }));

  const byTier = { 5: [], 4: [], 3: [] };
  for (const r of results) if (r.matchCount >= 3) byTier[r.matchCount].push(r.userId);

  const winners = [];
  let rolloverOut = 0;
  let unclaimed = 0;

  for (const tier of [5, 4, 3]) {
    const ids = byTier[tier];
    const pot = pots[tier];
    if (ids.length === 0) {
      if (tier === 5) rolloverOut += pot; else unclaimed += pot;
      continue;
    }
    const share = Math.floor(pot / ids.length);
    const remainder = pot - share * ids.length;
    if (tier === 5) rolloverOut += remainder; else unclaimed += remainder;
    for (const userId of ids) winners.push({ userId, tier, prizeCents: share });
  }

  return {
    numbers,
    pots,
    results,
    winners,
    counts: { 5: byTier[5].length, 4: byTier[4].length, 3: byTier[3].length },
    rolloverOutCents: rolloverOut,
    unclaimedCents: unclaimed,
  };
}

/** Convenience: draw numbers with the chosen mode, then settle. */
export function runDraw({ entries, mode = 'random', bias = 'most', poolTotalCents, rolloverInCents = 0, rng = secureRandom }) {
  const numbers = mode === 'weighted'
    ? drawWeightedNumbers(entries, bias, rng)
    : drawRandomNumbers(rng);
  return settleDraw({ entries, numbers, poolTotalCents, rolloverInCents });
}
