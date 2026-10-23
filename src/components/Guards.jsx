/**
 * Route guards. Each navigation re-checks membership status (PRD §04:
 * "real-time subscription status check on every authenticated request").
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from './Loader.jsx';

export function RequireAuth({ children }) {
  const { user, loading, refresh } = useAuth();
  const location = useLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) refresh(); }, [location.pathname]);
  if (loading) return <Loader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user, profile, isAdmin, loading } = useAuth();
  if (loading || (user && !profile)) return <Loader />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
