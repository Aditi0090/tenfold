/**
 * POST /api/checkout  { plan: "monthly" | "yearly" }
 * Creates a Stripe Checkout Session for a subscription and returns its URL.
 * Prices are defined in src/config/plans.js (no Stripe dashboard setup needed).
 */
import { stripe } from './_lib/stripe.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { getAuth } from './_lib/auth.js';
import { json, fail, safe, siteOrigin, readJson } from './_lib/http.js';
import { PLANS, CURRENCY } from '../src/config/plans.js';

export const POST = safe(async (request) => {
  const { user, profile } = await getAuth(request);
  const { plan } = await readJson(request);
  const chosen = PLANS[plan];
  if (!chosen) return fail('Choose a monthly or yearly plan');
  if (!profile?.charity_id) return fail('Please choose a charity before subscribing');

  // Prevent double subscriptions.
  const { data: existing } = await supabaseAdmin
    .from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
  const live = existing && ['active', 'trialing'].includes(existing.status)
    && (!existing.current_period_end || new Date(existing.current_period_end) > new Date());
  if (live) return fail('You already have an active subscription', 409);

  // Re-use the Stripe customer if we have one.
  let customerId = existing?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile.full_name || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  const origin = siteOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: chosen.amountCents,
        recurring: { interval: chosen.interval },
        product_data: { name: `Tenfold membership — ${chosen.label}` },
      },
    }],
    metadata: { kind: 'subscription', user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/subscribe?canceled=1`,
  });

  return json({ url: session.url });
});
