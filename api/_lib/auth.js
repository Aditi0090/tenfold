/**
 * Resolve the signed-in user from the "Authorization: Bearer <jwt>" header
 * the React app sends, and load their profile.
 */
import { supabaseAdmin } from './supabaseAdmin.js';

export async function getAuth(request, { required = true } = {}) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    if (required) throw Object.assign(new Error('Please sign in'), { status: 401 });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    if (required) throw Object.assign(new Error('Session expired — please sign in again'), { status: 401 });
    return null;
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('*').eq('id', data.user.id).single();
  return { user: data.user, profile };
}

export async function requireAdmin(request) {
  const auth = await getAuth(request);
  if (auth.profile?.role !== 'admin') {
    throw Object.assign(new Error('Administrator access required'), { status: 403 });
  }
  return auth;
}
