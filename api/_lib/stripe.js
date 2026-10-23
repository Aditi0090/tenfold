/** Stripe client (test-mode secret key from env). */
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing');

/** Map Stripe's subscription statuses onto ours. */
export function mapStripeStatus(status) {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled': return 'canceled';
    default: return 'inactive'; // incomplete, incomplete_expired, paused
  }
}

/**
 * Period end moved from the subscription to its items in newer Stripe API
 * versions — support both shapes.
 */
export function periodEnd(sub) {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Same for an invoice's subscription id. */
export function invoiceSubscriptionId(invoice) {
  const s = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  return typeof s === 'string' ? s : s?.id ?? null;
}
