import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar() {
  const { user, isAdmin, isActive, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className={`nav ${open ? 'open' : ''}`}>
      <div className="wrap">
        <Link to="/" className="brand"><span className="brand-mark">10</span>Tenfold</Link>
        {/* One wrapper so the mobile dropdown is a single solid panel */}
        <div className="nav-menu">
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/charities">Charities</NavLink>
          <NavLink to="/results">Draw results</NavLink>
          {user && <NavLink to="/dashboard">My dashboard</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</button>
              {!isActive && <Link className="btn btn-primary btn-sm" to="/subscribe">Subscribe</Link>}
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>
              <Link className="btn btn-primary btn-sm" to="/subscribe">Subscribe</Link>
            </>
          )}
        </div>
        </div>
        <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <span>Tenfold. Every member funds a charity they choose.</span>
        <span className="row">
          <Link to="/charities">Charities</Link>
          <Link to="/how-it-works">Draw rules</Link>
          <Link to="/donate">Donate</Link>
        </span>
      </div>
    </footer>
  );
}
