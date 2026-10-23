/**
 * POST /api/stripe-webhook
 * Receives Stripe events. Signature is verified against STRIPE_WEBHOOK_SECRET.
 * Handles: renewals, cancellations, lapsed payments and one-off donations.
 *
 * Stripe Dashboard → Developers → Webhooks → add endpoint
 *   https://<your-site>/api/stripe-webhook
 * Events: checkout.session.completed, customer.subscription.created,
 *         customer.subscription.updated, customer.subscription.deleted, invoice.paid
 */
import { stripe } from './_lib/stripe.js';
import { syncSubscription, recordInvoiceDonation, recordIndependentDonation } from './_lib/subscriptionSync.js';
import { json, fail } from './_lib/http.js';

export async function POST(request) {
  const signature = request.headers.get('stripe-signature');
  const raw = await request.text(); // raw body is required for signature checks

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return fail(`Webhook signature verification failed: ${err.message}`, 400);
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.metadata?.kind === 'donation') await recordIndependentDonation(obj);
        else if (obj.subscription) {
          const sub = await stripe.subscriptions.retrieve(obj.subscription);
          await syncSubscription(sub, obj.client_reference_id);
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(obj);
        break;
      case 'invoice.paid':
        await recordInvoiceDonation(obj);
        break;
      default:
        break; // ignore everything else
    }
  } catch (err) {
    console.error('[webhook]', event.type, err);
    return fail(err.message, 500); // Stripe will retry
  }
  return json({ received: true });
}
