/**
 * Keep our `subscriptions` table and `donations` ledger in step with Stripe.
 * Called from the webhook AND from the checkout-success endpoint, so the app
 * works even before a webhook is configured. Both paths are idempotent.
 */
import { supabaseAdmin, must } from './supabaseAdmin.js';
import { stripe, mapStripeStatus, periodEnd, invoiceSubscriptionId } from './stripe.js';

/** Upsert our row from a Stripe Subscription object. */
export async function syncSubscription(sub, userIdHint) {
  const userId = sub.metadata?.user_id || userIdHint;
  if (!userId) throw new Error(`Subscription ${sub.id} has no user_id metadata`);

  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval;
  const plan = sub.metadata?.plan || (interval === 'year' ? 'yearly' : 'monthly');

  must(await supabaseAdmin.from('subscriptions').upsert({
    user_id: userId,
    plan,
    status: mapStripeStatus(sub.status),
    amount_cents: item?.price?.unit_amount ?? 0,
    currency: item?.price?.currency ?? 'gbp',
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd(sub),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    source: 'stripe',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }));
  return userId;
}

/**
 * For each paid invoice, record the member's chosen charity share as a
 * donation. stripe_ref is unique, so replays are ignored.
 */
export async function recordInvoiceDonation(invoice, userIdHint) {
  if (!invoice || invoice.status !== 'paid' || !invoice.amount_paid) return;

  let userId = userIdHint;
  if (!userId) {
    const subId = invoiceSubscriptionId(invoice);
    if (!subId) return;
    const sub = await stripe.subscriptions.retrieve(subId);
    userId = sub.metadata?.user_id;
  }
  if (!userId) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('charity_id, charity_percent').eq('id', userId).single();
  if (!profile?.charity_id) return;

  const amount = Math.floor(invoice.amount_paid * (profile.charity_percent / 100));
  if (amount <= 0) return;

  await supabaseAdmin.from('donations').upsert({
    user_id: userId,
    charity_id: profile.charity_id,
    amount_cents: amount,
    kind: 'subscription',
    stripe_ref: invoice.id,
  }, { onConflict: 'stripe_ref', ignoreDuplicates: true });
}

/** Record a one-off donation from a completed Checkout Session. */
export async function recordIndependentDonation(session) {
  if (session.payment_status !== 'paid') return;
  await supabaseAdmin.from('donations').upsert({
    user_id: session.metadata?.user_id || null,
    charity_id: session.metadata?.charity_id,
    amount_cents: session.amount_total,
    kind: 'independent',
    donor_name: session.metadata?.donor_name || null,
    stripe_ref: session.id,
  }, { onConflict: 'stripe_ref', ignoreDuplicates: true });
}
