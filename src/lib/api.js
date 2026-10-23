/**
 * Calls our own /api server functions, attaching the user's Supabase JWT
 * so the server can verify who is asking.
 */
import { supabase } from './supabase.js';

export async function api(path, { method = 'POST', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = {};
  try { payload = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}
