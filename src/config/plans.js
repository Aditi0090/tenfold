/**
 * Business constants shared by the React app AND the /api server functions.
 * Change prices or splits here and both sides stay in sync.
 *
 * All money values are integer pence (minor units).
 */

export const CURRENCY = 'gbp';
export const CURRENCY_SYMBOL = '£';

/** Subscription plans. Yearly is discounted (~17% vs 12 × monthly). */
export const PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    amountCents: 1000,         // £10.00 / month
    interval: 'month',
    monthlyEquivalentCents: 1000,
    blurb: 'Flexible. Cancel any time.',
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly',
    amountCents: 10000,        // £100.00 / year
    interval: 'year',
    monthlyEquivalentCents: Math.round(10000 / 12), // 833p — used for the monthly prize pool
    blurb: 'Two months free.',
  },
};

/**
 * How each subscription fee is split (PRD §07 + §08):
 *   - PRIZE_POOL_SHARE  is fixed: this portion of every fee funds the draw.
 *   - Charity share     is chosen by the member: min 10%, max 60%.
 *   - Platform share    is whatever remains (always ≥ 10%).
 */
export const PRIZE_POOL_SHARE = 0.30;
export const CHARITY_MIN_PERCENT = 10;
export const CHARITY_MAX_PERCENT = 60;

/** Prize pool split by match tier (PRD §07). Must sum to 1. */
export const TIER_SHARES = { 5: 0.40, 4: 0.35, 3: 0.25 };

/** Score rules (PRD §05). */
export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const SCORES_KEPT = 5;
export const NUMBERS_PER_DRAW = 5;

/** Minimum independent donation. */
export const MIN_DONATION_CENTS = 100;
