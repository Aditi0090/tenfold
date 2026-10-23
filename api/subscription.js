/**
 * POST /api/subscription  { action: "cancel" | "resume" }
 * Members cancel (at the end of the paid period) or undo a cancellation.
 */
import { stripe } from './_lib/stripe.js';
import { supabaseAdmin, must } from './_lib/supabaseAdmin.js';
import { getAuth } from './_lib/auth.js';
import { syncSubscription } from './_lib/subscriptionSync.js';
import { json, fail, safe, readJson } from './_lib/http.js';

export const POST = safe(async (request) => {
  const { user } = await getAuth(request);
  const { action } = await readJson(request);
  if (!['cancel', 'resume'].includes(action)) return fail('Unknown action');

  const sub = must(await supabaseAdmin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle());
  if (!sub) return fail('No subscription found', 404);

  const cancelAtEnd = action === 'cancel';
  if (sub.source === 'stripe' && sub.stripe_subscription_id) {
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: cancelAtEnd });
    await syncSubscription(updated, user.id);
  } else {
    must(await supabaseAdmin.from('subscriptions')
      .update({ cancel_at_period_end: cancelAtEnd, updated_at: new Date().toISOString() })
      .eq('user_id', user.id));
  }
  return json({ ok: true });
});
