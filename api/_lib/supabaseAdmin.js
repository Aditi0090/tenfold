/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * It bypasses Row Level Security, so it must only ever run inside /api.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[api] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
}

export const supabaseAdmin = createClient(url || 'http://missing', key || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Throw on Supabase errors so callers can stay linear. */
export function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
