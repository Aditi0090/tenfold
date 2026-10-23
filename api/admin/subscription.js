/**
 * POST /api/admin/subscription   (administrators only)
 *   { userId, action: "cancel_now" }          end immediately (Stripe + DB)
 *   { userId, action: "cancel_at_period_end" }
 *   { userId, action: "resume" }
 *   { userId, action: "grant", plan, months } complimentary/manual access,
 *                                             e.g. for test accounts or support cases
 */
import { stripe } from '../_lib/stripe.js';
import { supabaseAdmin, must } from '../_lib/supabaseAdmin.js';
import { requireAdmin } from '../_lib/auth.js';
import { syncSubscription } from '../_lib/subscriptionSync.js';
import { json, fail, safe, readJson } from '../_lib/http.js';
import { PLANS } from '../../src/config/plans.js';

export const POST = safe(async (request) => {
  await requireAdmin(request);
  const { userId, action, plan = 'monthly', months = 1 } = await readJson(request);
  if (!userId) return fail('userId required');

  const sub = must(await supabaseAdmin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle());
  const isStripe = sub?.source === 'stripe' && sub?.stripe_subscription_id;

  if (action === 'grant') {
    if (!PLANS[plan]) return fail('Unknown plan');
    if (isStripe && ['active', 'trialing'].includes(sub.status)) return fail('User already has a paid Stripe subscription', 409);
    const end = new Date();
    end.setMonth(end.getMonth() + Math.max(1, Math.min(24, Number(months) || 1)));
    must(await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId, plan, status: 'active', amount_cents: PLANS[plan].amountCents,
      current_period_end: end.toISOString(), cancel_at_period_end: false,
      source: 'manual', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));
    return json({ ok: true });
  }

  if (!sub) return fail('User has no subscription', 404);

  if (action === 'cancel_now') {
    if (isStripe) {
      const s = await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      await syncSubscription(s, userId);
    } else {
      must(await supabaseAdmin.from('subscriptions')
        .update({ status: 'canceled', current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId));
    }
    return json({ ok: true });
  }

  if (action === 'cancel_at_period_end' || action === 'resume') {
    const flag = action === 'cancel_at_period_end';
    if (isStripe) {
      const s = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: flag });
      await syncSubscription(s, userId);
    } else {
      must(await supabaseAdmin.from('subscriptions')
        .update({ cancel_at_period_end: flag, updated_at: new Date().toISOString() }).eq('user_id', userId));
    }
    return json({ ok: true });
  }

  return fail('Unknown action');
});
