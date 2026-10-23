/**
 * GET /api/checkout-status?session_id=cs_test_...
 * Called by the success page. Confirms the Checkout Session with Stripe and
 * syncs the subscription / donation immediately, so the member sees their
 * new status even if the webhook is delayed or not yet configured.
 */
import { stripe } from './_lib/stripe.js';
import { syncSubscription, recordInvoiceDonation, recordIndependentDonation } from './_lib/subscriptionSync.js';
import { json, fail, safe } from './_lib/http.js';

export const GET = safe(async (request) => {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId?.startsWith('cs_')) return fail('Missing session id');

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'subscription.latest_invoice'],
  });
  const kind = session.metadata?.kind;

  if (kind === 'donation') {
    await recordIndependentDonation(session);
    return json({ kind, paid: session.payment_status === 'paid', amount: session.amount_total });
  }

  if (session.status !== 'complete' || !session.subscription) {
    return json({ kind: 'subscription', active: false });
  }
  const sub = session.subscription;
  const userId = await syncSubscription(sub, session.client_reference_id);
  await recordInvoiceDonation(sub.latest_invoice, userId);
  return json({ kind: 'subscription', active: ['active', 'trialing'].includes(sub.status), plan: sub.metadata?.plan });
});
