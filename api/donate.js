/**
 * POST /api/donate  { charityId, amountCents, donorName? }
 * Independent one-off donation, not tied to the draw (PRD §08).
 * Works for signed-out visitors too.
 */
import { stripe } from './_lib/stripe.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { getAuth } from './_lib/auth.js';
import { json, fail, safe, siteOrigin, readJson } from './_lib/http.js';
import { CURRENCY, MIN_DONATION_CENTS } from '../src/config/plans.js';

export const POST = safe(async (request) => {
  const auth = await getAuth(request, { required: false });
  const { charityId, amountCents, donorName } = await readJson(request);

  const amount = Math.round(Number(amountCents));
  if (!Number.isFinite(amount) || amount < MIN_DONATION_CENTS) return fail('Minimum donation is £1');
  if (amount > 1_000_000) return fail('For donations over £10,000 please contact us');

  const { data: charity } = await supabaseAdmin
    .from('charities').select('id, name, slug').eq('id', charityId).eq('active', true).maybeSingle();
  if (!charity) return fail('Charity not found', 404);

  const origin = siteOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: auth?.user?.email,
    line_items: [{
      quantity: 1,
      price_data: { currency: CURRENCY, unit_amount: amount, product_data: { name: `Donation to ${charity.name}` } },
    }],
    metadata: {
      kind: 'donation',
      charity_id: charity.id,
      user_id: auth?.user?.id || '',
      donor_name: (donorName || auth?.profile?.full_name || '').slice(0, 80),
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/charities/${charity.slug}`,
  });
  return json({ url: session.url });
});
