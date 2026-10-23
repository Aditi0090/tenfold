import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';
import { PLANS, PRIZE_POOL_SHARE, CHARITY_MIN_PERCENT, CHARITY_MAX_PERCENT } from '../config/plans.js';
import Chips from '../components/Chips.jsx';

/** Public explainer for the draw mechanics (PRD §03 "understand draw mechanics"). */
export default function HowItWorks() {
  return (
    <div className="wrap section">
      <h1 style={{ maxWidth: '16ch' }}>How the monthly draw works</h1>
      <p className="lede">No odds tables, no fine print you need a lawyer for. Here is the whole thing.</p>

      <div className="grid-2" style={{ marginTop: 40 }}>
        <div className="panel">
          <h3>Your scores are your numbers</h3>
          <p className="muted">We keep your five most recent Stableford scores. On draw day, those five values are your ticket.</p>
          <Chips numbers={[34, 21, 28, 36, 30]} />
        </div>
        <div className="panel">
          <h3>Five numbers are drawn</h3>
          <p className="muted">Five different numbers from 1 to 45. Any score you hold that appears among them is a match.</p>
          <Chips numbers={[28, 7, 34, 36, 15]} variant="drawn" />
          <p className="small" style={{ marginTop: 12 }}>In this example: 34, 28 and 36 match. That&rsquo;s three, so a share of the 25% prize.</p>
        </div>
      </div>

      <h2 style={{ marginTop: 64 }}>Questions people ask</h2>
      <div style={{ maxWidth: 760 }}>
        <details open><summary>Who can enter a draw?</summary>
          <p>Any member with an active subscription and five scores logged when the draw runs. With fewer than five scores you sit that month out, but your charity still receives its share.</p></details>
        <details><summary>What if I score the same number twice?</summary>
          <p>It counts once. A ticket of 30, 30, 22, 19, 35 can match at most four different numbers.</p></details>
        <details><summary>How big is the prize pool?</summary>
          <p>{PRIZE_POOL_SHARE * 100}% of every active membership each month ({money(PLANS.monthly.amountCents * PRIZE_POOL_SHARE)} per monthly member; yearly fees are spread over 12 months). It is split 40% for five matches, 35% for four and 25% for three.</p></details>
        <details><summary>What happens if nobody wins?</summary>
          <p>If nobody matches all five, the whole five-match share rolls into next month&rsquo;s jackpot. Unwon four- and three-match shares don&rsquo;t roll over.</p></details>
        <details><summary>How are the numbers picked?</summary>
          <p>Either fully at random, like a lottery, or weighted by how often each score appears among members&rsquo; tickets. The method is shown on each published result.</p></details>
        <details><summary>I won. What now?</summary>
          <p>Upload a screenshot of your scores from your golf app or club system on your dashboard. Once an admin approves it, your prize is paid and marked as paid on your dashboard.</p></details>
        <details><summary>How much goes to charity?</summary>
          <p>You choose: anything from {CHARITY_MIN_PERCENT}% to {CHARITY_MAX_PERCENT}% of your fee, paid every time your membership renews. You can also make one-off donations without joining.</p></details>
      </div>
      <div className="row" style={{ marginTop: 40 }}>
        <Link className="btn btn-primary btn-lg" to="/subscribe">Subscribe</Link>
        <Link className="btn btn-ghost btn-lg" to="/results">See past results</Link>
      </div>
    </div>
  );
}
