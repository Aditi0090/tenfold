/**
 * Hero animation: a member's five scores are checked against the month's
 * drawn numbers, one ball at a time. Loops through a few scenarios.
 * With reduced motion it shows a single settled state.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const SCENARIOS = [
  { scores: [32, 18, 27, 36, 41], drawn: [27, 9, 36, 41, 14], charity: 'Bright Minds' },
  { scores: [24, 30, 30, 19, 35], drawn: [5, 30, 19, 44, 12], charity: 'Clean Water Collective' },
  { scores: [38, 22, 29, 33, 26], drawn: [22, 29, 33, 38, 26], charity: 'Open Book Literacy' },
];

function outcome(matches) {
  if (matches === 5) return 'Five matches. The jackpot is yours.';
  if (matches === 4) return 'Four matches. A share of 35% of the pool.';
  if (matches === 3) return 'Three matches. A share of 25% of the pool.';
  return 'No prize this month. Your charity still got paid.';
}

export default function TicketDemo() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(reduce ? 5 : 0);
  const s = SCENARIOS[idx];

  useEffect(() => {
    if (reduce) return undefined;
    if (revealed < 5) {
      const t = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 1100 : 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setIdx((i) => (i + 1) % SCENARIOS.length); setRevealed(0); }, 3600);
    return () => clearTimeout(t);
  }, [revealed, reduce]);

  const shown = s.drawn.slice(0, revealed);
  const hits = s.scores.filter((n, i, arr) => shown.includes(n) && arr.indexOf(n) === i);
  const matches = new Set(hits).size;

  return (
    <div className="ticket" aria-label="Example: five scores checked against five drawn numbers">
      <span className="ticket-give">10% to {s.charity}</span>
      <div className="ticket-label">Your last five rounds</div>
      <div className="chips ticket-scores">
        {s.scores.map((n, i) => (
          <motion.span key={`${idx}-s-${i}`} className={`chip ${hits.includes(n) ? 'hit' : ''}`}
            initial={reduce ? false : { y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1, scale: hits.includes(n) ? 1.08 : 1 }}
            transition={{ delay: reduce ? 0 : i * 0.07, type: 'spring', stiffness: 380, damping: 22 }}>
            {n}
          </motion.span>
        ))}
      </div>
      <div className="ticket-label">This month&rsquo;s draw</div>
      <div className="chips">
        {s.drawn.map((n, i) => (
          <span key={`${idx}-d-${i}`} className={`chip ${i < revealed ? 'drawn' : ''}`}>
            <AnimatePresence>
              {i < revealed && (
                <motion.span initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
                  {n}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        ))}
      </div>
      <div className="ticket-result" aria-live="polite">
        {revealed === 5 ? outcome(matches) : `${matches} match${matches === 1 ? '' : 'es'} so far…`}
      </div>
    </div>
  );
}
