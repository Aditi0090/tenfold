import { useState } from 'react';
import { coverGradient } from '../lib/format.js';

/** Charity image, or a generated gradient with initials if none / broken. */
export default function CharityCover({ charity, style }) {
  const [broken, setBroken] = useState(false);
  const initials = (charity?.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className="charity-cover" style={{ background: coverGradient(charity?.slug || charity?.name), ...style }}>
      {charity?.image_url && !broken
        ? <img src={charity.image_url} alt="" loading="lazy" onError={() => setBroken(true)} />
        : <span className="initials" aria-hidden="true">{initials}</span>}
    </div>
  );
}
