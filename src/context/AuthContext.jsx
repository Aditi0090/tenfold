/**
 * Auth + membership state for the whole app.
 *
 * Exposes: session, user, profile, subscription, isActive, isAdmin,
 *          loading, refresh(), signOut().
 *
 * isActive is recomputed from the subscription row each time `refresh()`
 * runs (route guards call it on every navigation), and the database
 * enforces the same rule via RLS — so a lapsed member loses access
 * immediately even if the UI is stale.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function subscriptionIsActive(sub) {
  if (!sub) return false;
  if (!['active', 'trialing'].includes(sub.status)) return false;
  return !sub.current_period_end || new Date(sub.current_period_end) > new Date();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMember = useCallback(async (s) => {
    if (!s?.user) { setProfile(null); setSubscription(null); return; }
    const [{ data: p }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('*, charity:charities(id, name, slug)').eq('id', s.user.id).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('user_id', s.user.id).maybeSingle(),
    ]);
    setProfile(p ?? null);
    setSubscription(sub ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadMember(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer DB calls out of the auth callback (Supabase recommendation).
      setTimeout(() => loadMember(s), 0);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadMember]);

  const refresh = useCallback(() => loadMember(session), [loadMember, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null); setSubscription(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    subscription,
    isActive: subscriptionIsActive(subscription),
    isAdmin: profile?.role === 'admin',
    loading,
    refresh,
    signOut,
  }), [session, profile, subscription, loading, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
