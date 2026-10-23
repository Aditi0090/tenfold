/**
 * POST /api/admin/draw   (administrators only)
 *
 *   { action: "simulate", month: "2026-11", mode: "random"|"weighted", bias?: "most"|"least" }
 *       Snapshots every eligible ticket, draws numbers, calculates prizes and
 *       stores the result as an unpublished simulation. Can be re-run freely.
 *
 *   { action: "publish", drawId }
 *       Releases EXACTLY the simulated result: writes entries + winners and
 *       makes the draw visible to members. Irreversible.
 *
 *   { action: "discard", drawId }
 *       Deletes an unpublished simulation.
 */
import { supabaseAdmin, must } from '../_lib/supabaseAdmin.js';
import { requireAdmin } from '../_lib/auth.js';
import { json, fail, safe, readJson } from '../_lib/http.js';
import { runDraw, computePoolTotal } from '../../src/lib/drawEngine.js';
import { SCORES_KEPT } from '../../src/config/plans.js';

export const POST = safe(async (request) => {
  await requireAdmin(request);
  const body = await readJson(request);
  if (body.action === 'simulate') return simulate(body);
  if (body.action === 'publish') return publish(body.drawId);
  if (body.action === 'discard') return discard(body.drawId);
  return fail('Unknown action');
});

/** Jackpot carried in = rollover of the latest published draw before this month. */
async function rolloverBefore(monthDate) {
  const { data } = await supabaseAdmin.from('draws')
    .select('rollover_out_cents').eq('status', 'published').lt('draw_month', monthDate)
    .order('draw_month', { ascending: false }).limit(1).maybeSingle();
  return data?.rollover_out_cents ?? 0;
}

/** Draws must be published in month order so the jackpot chain stays correct. */
async function laterPublishedExists(monthDate) {
  const { count } = await supabaseAdmin.from('draws')
    .select('id', { count: 'exact', head: true }).eq('status', 'published').gt('draw_month', monthDate);
  return (count ?? 0) > 0;
}

async function simulate({ month, mode = 'random', bias = 'most' }) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return fail('Month must look like 2026-11');
  if (!['random', 'weighted'].includes(mode)) return fail('Mode must be random or weighted');
  if (!['most', 'least'].includes(bias)) return fail('Bias must be most or least');
  const monthDate = `${month}-01`;

  const existing = must(await supabaseAdmin.from('draws').select('id, status').eq('draw_month', monthDate).maybeSingle());
  if (existing?.status === 'published') return fail('This month has already been published', 409);
  if (await laterPublishedExists(monthDate)) return fail('A later month is already published — draws must run in order', 409);

  // 1. Active subscribers right now (real-time status, not cached flags).
  const nowIso = new Date().toISOString();
  const subs = must(await supabaseAdmin.from('subscriptions')
    .select('user_id, plan, amount_cents, status, current_period_end')
    .in('status', ['active', 'trialing'])
    .or(`current_period_end.is.null,current_period_end.gt."${nowIso}"`));

  // 2. Their tickets: exactly 5 stored scores, newest first.
  const ids = subs.map((s) => s.user_id);
  const scores = ids.length
    ? must(await supabaseAdmin.from('scores').select('user_id, score, played_on')
        .in('user_id', ids).order('played_on', { ascending: false }))
    : [];
  const byUser = new Map();
  for (const s of scores) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id).push(s.score);
  }
  const entries = [...byUser.entries()]
    .filter(([, list]) => list.length === SCORES_KEPT)
    .map(([userId, numbers]) => ({ userId, numbers }));

  // 3. Prize pool + jackpot rollover, then draw.
  const poolTotalCents = computePoolTotal(subs);
  const rolloverInCents = await rolloverBefore(monthDate);
  const result = runDraw({ entries, mode, bias, poolTotalCents, rolloverInCents });

  const row = {
    draw_month: monthDate,
    mode,
    weight_bias: mode === 'weighted' ? bias : null,
    status: 'simulated',
    numbers: result.numbers,
    active_subscribers: subs.length,
    eligible_entries: entries.length,
    pool_total_cents: poolTotalCents,
    rollover_in_cents: rolloverInCents,
    pool_5_cents: result.pots[5],
    pool_4_cents: result.pots[4],
    pool_3_cents: result.pots[3],
    rollover_out_cents: result.rolloverOutCents,
    unclaimed_cents: result.unclaimedCents,
    winners_5: result.counts[5],
    winners_4: result.counts[4],
    winners_3: result.counts[3],
    simulation: { results: result.results, winners: result.winners },
    simulated_at: new Date().toISOString(),
  };
  const saved = must(await supabaseAdmin.from('draws').upsert(row, { onConflict: 'draw_month' }).select().single());
  return json({ draw: saved });
}

async function publish(drawId) {
  const draw = must(await supabaseAdmin.from('draws').select('*').eq('id', drawId).maybeSingle());
  if (!draw) return fail('Draw not found', 404);
  if (draw.status === 'published') return fail('Already published', 409);
  if (!draw.simulation) return fail('Run a simulation first');
  if (await laterPublishedExists(draw.draw_month)) return fail('A later month is already published', 409);
  if ((await rolloverBefore(draw.draw_month)) !== draw.rollover_in_cents) {
    return fail('An earlier draw was published since this simulation — please re-simulate', 409);
  }

  const { results, winners } = draw.simulation;
  const entryRows = results.map((r) => ({ draw_id: draw.id, user_id: r.userId, numbers: r.numbers, match_count: r.matchCount }));
  const winnerRows = winners.map((w) => ({ draw_id: draw.id, user_id: w.userId, tier: w.tier, prize_cents: w.prizeCents }));

  try {
    if (entryRows.length) must(await supabaseAdmin.from('draw_entries').insert(entryRows));
    if (winnerRows.length) must(await supabaseAdmin.from('winners').insert(winnerRows));
    const updated = must(await supabaseAdmin.from('draws')
      .update({ status: 'published', published_at: new Date().toISOString(), simulation: null })
      .eq('id', draw.id).select().single());
    return json({ draw: updated });
  } catch (err) {
    // Best-effort rollback so a retry starts clean.
    await supabaseAdmin.from('draw_entries').delete().eq('draw_id', draw.id);
    await supabaseAdmin.from('winners').delete().eq('draw_id', draw.id);
    throw err;
  }
}

async function discard(drawId) {
  const draw = must(await supabaseAdmin.from('draws').select('id, status').eq('id', drawId).maybeSingle());
  if (!draw) return fail('Draw not found', 404);
  if (draw.status === 'published') return fail('Published draws cannot be deleted', 409);
  must(await supabaseAdmin.from('draws').delete().eq('id', drawId));
  return json({ ok: true });
}
