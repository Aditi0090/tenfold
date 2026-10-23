import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { money, nextDrawDate, date } from '../lib/format.js';
import { PLANS, PRIZE_POOL_SHARE, CHARITY_MIN_PERCENT, TIER_SHARES } from '../config/plans.js';
import TicketDemo from '../components/TicketDemo.jsx';
import CharityCover from '../components/CharityCover.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { isActive } = useAuth();
  const [stats, setStats] = useState(null);
  const [charities, setCharities] = useState([]);

  useEffect(() => {
    supabase.rpc('platform_stats').then(({ data }) => setStats(data));
    supabase.from('charities').select('*').eq('active', true).order('featured', { ascending: false }).order('name')
      .limit(3).then(({ data }) => setCharities(data || []));
  }, []);

  const fee = PLANS.monthly.amountCents;
  const charityCut = fee * (CHARITY_MIN_PERCENT / 100);
  const poolCut = fee * PRIZE_POOL_SHARE;
  const rest = fee - charityCut - poolCut;
  const [spot, ...others] = charities;

  return (
    <>
      {/* HERO — the ticket is the one animated moment on the page */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Every round you play funds a cause you choose.</h1>
            <p className="lede">
              Log your Stableford scores and your last five become your numbers in a monthly prize draw.
              At least {CHARITY_MIN_PERCENT}% of every membership goes straight to the charity you pick.
            </p>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={isActive ? '/dashboard' : '/subscribe'}>
                {isActive ? 'Go to my dashboard' : `Subscribe from ${money(fee)} a month`}
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/how-it-works">How the draw works</Link>
            </div>
            <p className="hero-note">Next draw {date(nextDrawDate(), { day: 'numeric', month: 'long' })}. Cancel any time.</p>
          </div>
          <TicketDemo />
        </div>
      </section>

      {/* IMPACT — charity leads the story */}
      <section className="band section">
        <div className="wrap">
          <h2 style={{ maxWidth: '20ch' }}>Where your {money(fee)} goes, every month</h2>
          <p className="lede">You choose the charity and how much it gets, from {CHARITY_MIN_PERCENT}% up to 60%. The prize-pool share is fixed.</p>
          <div className="split-bar" aria-hidden="true">
            <div style={{ flex: charityCut, background: 'var(--rose)' }}>{money(charityCut)}</div>
            <div style={{ flex: poolCut, background: 'var(--marigold)', color: 'var(--ink)' }}>{money(poolCut)}</div>
            <div style={{ flex: rest, background: 'rgba(255,255,255,0.12)' }}>{money(rest)}</div>
          </div>
          <div className="split-legend">
            <div><b>Your charity</b><br /><span className="muted">{CHARITY_MIN_PERCENT}% minimum, paid on every renewal</span></div>
            <div><b>Prize pool</b><br /><span className="muted">{PRIZE_POOL_SHARE * 100}% of every fee, shared by winners</span></div>
            <div><b>Running Tenfold</b><br /><span className="muted">Payments, verification, the platform</span></div>
          </div>
          <div className="impact-row">
            <div><strong>{money(stats?.total_raised_cents ?? 0)}</strong><span>raised for charity so far</span></div>
            <div><strong>{stats?.active_members ?? 0}</strong><span>members playing this month</span></div>
            <div><strong>{stats?.charities ?? 0}</strong><span>charities to choose from</span></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — a real sequence, so numbered */}
      <section className="section">
        <div className="wrap">
          <h2>Three things to do. One of them is golf.</h2>
          <div className="steps" style={{ marginTop: 32 }}>
            <div className="step">
              <div className="step-n">1</div>
              <h3>Join and pick a charity</h3>
              <p className="muted">Monthly or yearly. Choose who you&rsquo;re playing for when you sign up, and change it whenever you like.</p>
            </div>
            <div className="step">
              <div className="step-n">2</div>
              <h3>Log your last five rounds</h3>
              <p className="muted">Stableford points, 1 to 45, one per date. Add a new round and the oldest one drops off.</p>
            </div>
            <div className="step">
              <div className="step-n">3</div>
              <h3>Match the monthly draw</h3>
              <p className="muted">Five numbers are drawn at the end of each month. Match three, four or all five of your scores to win.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRIZES */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="panel panel-peri">
            <div className="spread" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2>How the prize pool is shared</h2>
                <p className="muted">If several people match the same number of scores, they split that share equally. If no one matches all five, the jackpot rolls into next month.</p>
              </div>
              {stats?.current_jackpot_rollover_cents > 0 && (
                <div className="panel" style={{ minWidth: 220 }}>
                  <div className="small muted">Jackpot carried into this month</div>
                  <div className="big-num">{money(stats.current_jackpot_rollover_cents)}</div>
                </div>
              )}
            </div>
            <div className="grid-3" style={{ marginTop: 20 }}>
              {[5, 4, 3].map((tier) => (
                <div key={tier} className="panel">
                  <div className="chips" style={{ marginBottom: 12 }}>
                    {Array.from({ length: 5 }, (_, i) => <span key={i} className={`chip chip-sm ${i < tier ? 'hit' : ''}`} />)}
                  </div>
                  <h3>{tier} matches</h3>
                  <div className="big-num">{TIER_SHARES[tier] * 100}%</div>
                  <p className="small muted" style={{ marginTop: 8 }}>{tier === 5 ? 'of the pool, plus any rolled-over jackpot' : 'of the pool, split between winners'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CHARITY SPOTLIGHT */}
      {spot && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="spotlight">
              <CharityCover charity={spot} style={{ aspectRatio: '4 / 3' }} />
              <div>
                <span className="pill pill-rose">Charity spotlight</span>
                <h2 style={{ marginTop: 14 }}>{spot.name}</h2>
                <p className="lede">{spot.tagline}</p>
                <p className="muted">{spot.description}</p>
                <div className="row">
                  <Link className="btn" to={`/charities/${spot.slug}`}>Read about {spot.name.split(' ')[0]}</Link>
                  <Link className="btn btn-ghost" to="/charities">See all charities</Link>
                </div>
              </div>
            </div>
            {others.length > 0 && (
              <div className="grid-2" style={{ marginTop: 40 }}>
                {others.map((c) => (
                  <Link key={c.id} to={`/charities/${c.slug}`} className="charity-card">
                    <CharityCover charity={c} />
                    <div><h3>{c.name}</h3><p className="muted small">{c.tagline}</p></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="band-rose section">
        <div className="wrap">
          <h2 style={{ maxWidth: '18ch' }}>Your next round could pay for someone&rsquo;s counselling session.</h2>
          <p className="lede" style={{ color: '#fff' }}>Join for {money(fee)} a month or {money(PLANS.yearly.amountCents)} a year.</p>
          <Link className="btn btn-lg" style={{ background: '#fff', color: 'var(--ink)' }} to={isActive ? '/dashboard' : '/subscribe'}>
            {isActive ? 'Log a round' : 'Subscribe now'}
          </Link>
        </div>
      </section>
    </>
  );
}
