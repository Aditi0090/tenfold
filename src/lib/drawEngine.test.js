// Unit tests for the draw engine. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawRandomNumbers, drawWeightedNumbers, countMatches, splitPool,
  settleDraw, computePoolTotal, monthlyContributionCents,
} from './drawEngine.js';

/** Deterministic RNG for repeatable tests. */
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

test('random draw gives 5 distinct sorted numbers in 1..45', () => {
  for (let i = 0; i < 200; i++) {
    const n = drawRandomNumbers(seeded(i));
    assert.equal(n.length, 5);
    assert.equal(new Set(n).size, 5);
    assert.ok(n.every((x) => x >= 1 && x <= 45));
    assert.deepEqual(n, [...n].sort((a, b) => a - b));
  }
});

test('weighted draw favours frequent scores with bias "most"', () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({ userId: `u${i}`, numbers: [36, 36, 36, 36, 36] }));
  let hits = 0;
  for (let i = 0; i < 200; i++) if (drawWeightedNumbers(entries, 'most', seeded(i)).includes(36)) hits++;
  assert.ok(hits > 150, `36 drawn ${hits}/200 times`);
});

test('weighted draw avoids frequent scores with bias "least"', () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({ userId: `u${i}`, numbers: [36, 36, 36, 36, 36] }));
  let hits = 0;
  for (let i = 0; i < 200; i++) if (drawWeightedNumbers(entries, 'least', seeded(i)).includes(36)) hits++;
  assert.ok(hits < 10, `36 drawn ${hits}/200 times`);
});

test('countMatches counts distinct values only', () => {
  assert.equal(countMatches([30, 30, 12, 7, 1], [30, 12, 2, 3, 4]), 2);
  assert.equal(countMatches([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 5);
  assert.equal(countMatches([10, 11, 12, 13, 14], [1, 2, 3, 4, 5]), 0);
});

test('pool split is 40/35/25 and always sums exactly', () => {
  const pots = splitPool(10001, 0);
  assert.equal(pots[4], 3500);
  assert.equal(pots[3], 2500);
  assert.equal(pots[5] + pots[4] + pots[3], 10001);
  assert.equal(splitPool(10000, 5000)[5], 9000); // rollover added to jackpot
});

test('pool total uses monthly equivalent of yearly plans', () => {
  assert.equal(monthlyContributionCents({ plan: 'monthly', amount_cents: 1000 }), 300);
  assert.equal(monthlyContributionCents({ plan: 'yearly', amount_cents: 10000 }), 249); // 833 * 0.3
  assert.equal(computePoolTotal([{ plan: 'monthly', amount_cents: 1000 }, { plan: 'yearly', amount_cents: 10000 }]), 549);
});

test('no 5-match winner → jackpot rolls over; unwon 4/3 are unclaimed', () => {
  const r = settleDraw({
    entries: [{ userId: 'a', numbers: [1, 2, 3, 40, 41] }],
    numbers: [1, 2, 3, 4, 5],
    poolTotalCents: 10000,
    rolloverInCents: 2000,
  });
  assert.equal(r.counts[3], 1);
  assert.equal(r.winners[0].prizeCents, 2500);
  assert.equal(r.rolloverOutCents, 6000); // 4000 + 2000 carried in
  assert.equal(r.unclaimedCents, 3500);   // nobody matched 4
});

test('tier prize split equally between winners, pennies accounted for', () => {
  const r = settleDraw({
    entries: [
      { userId: 'a', numbers: [1, 2, 3, 4, 5] },
      { userId: 'b', numbers: [1, 2, 3, 4, 5] },
      { userId: 'c', numbers: [1, 2, 3, 4, 5] },
    ],
    numbers: [1, 2, 3, 4, 5],
    poolTotalCents: 1000, // tier5 = 400 → 133 each, 1p remainder rolls over
  });
  assert.equal(r.counts[5], 3);
  assert.ok(r.winners.every((w) => w.prizeCents === 133));
  assert.equal(r.rolloverOutCents, 1);
  const paid = r.winners.reduce((s, w) => s + w.prizeCents, 0);
  assert.equal(paid + r.rolloverOutCents + r.unclaimedCents, 1000);
});
