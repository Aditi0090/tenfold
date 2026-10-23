/**
 * Creates the test accounts the PRD asks for, plus demo members so the draw
 * engine has real tickets to work with.
 *
 *   npm run seed:demo        (reads .env — needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *
 * Accounts created (change the passwords below before you run it if you like):
 *   Admin:  admin@tenfold.demo   / Tenfold!Admin2026
 *   Member: player@tenfold.demo  / Tenfold!Player2026   (active monthly plan, 5 scores)
 *   + 24 demo members (demo01@tenfold.demo …) with active plans and 5 scores each.
 *
 * Demo subscriptions are "manual" (no Stripe charge). Real sign-ups go through Stripe.
 * Safe to re-run: existing accounts are reused.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const ADMIN = { email: 'admin@tenfold.demo', password: 'Tenfold!Admin2026', name: 'Tenfold Admin' };
const PLAYER = { email: 'player@tenfold.demo', password: 'Tenfold!Player2026', name: 'Alex Morgan' };
const DEMO_COUNT = 24;
const FIRST = ['Sam', 'Priya', 'Jordan', 'Aisha', 'Tom', 'Mei', 'Leo', 'Nina', 'Raj', 'Ella', 'Omar', 'Zoe'];
const LAST = ['Patel', 'Clarke', 'Okafor', 'Silva', 'Novak', 'Reid', 'Khan', 'Murphy'];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser({ email, password, name }, charityId, pct) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name, charity_id: charityId, charity_percent: pct },
    });
    if (error) throw error;
    user = data.user;
  }
  // Make sure the profile exists even if the trigger was added later.
  await db.from('profiles').upsert({ id: user.id, email, full_name: name, charity_id: charityId, charity_percent: pct }, { onConflict: 'id' });
  return user;
}

async function giveSubscription(userId, plan = 'monthly') {
  const end = new Date();
  end.setMonth(end.getMonth() + (plan === 'yearly' ? 12 : 1));
  const { error } = await db.from('subscriptions').upsert({
    user_id: userId, plan, status: 'active',
    amount_cents: plan === 'yearly' ? 10000 : 1000,
    current_period_end: end.toISOString(), source: 'manual', updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function giveScores(userId) {
  await db.from('scores').delete().eq('user_id', userId);
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i * 6 + rand(1, 5)));
    rows.push({ user_id: userId, score: rand(18, 42), played_on: d.toISOString().slice(0, 10) });
  }
  const { error } = await db.from('scores').insert(rows);
  if (error) throw error;
}

const { data: charities, error } = await db.from('charities').select('id').eq('active', true);
if (error || !charities?.length) {
  console.error('No charities found — run supabase/seed.sql first.', error?.message || '');
  process.exit(1);
}
const pick = () => charities[rand(0, charities.length - 1)].id;

const admin = await ensureUser(ADMIN, pick(), 10);
await db.from('profiles').update({ role: 'admin' }).eq('id', admin.id);
console.log('✓ admin', ADMIN.email);

const player = await ensureUser(PLAYER, pick(), 15);
await giveSubscription(player.id, 'monthly');
await giveScores(player.id);
console.log('✓ player', PLAYER.email);

for (let i = 1; i <= DEMO_COUNT; i++) {
  const n = String(i).padStart(2, '0');
  const u = await ensureUser({
    email: `demo${n}@tenfold.demo`, password: `Demo!${n}-${Math.random().toString(36).slice(2, 10)}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
  }, pick(), [10, 10, 15, 20, 25][i % 5]);
  await giveSubscription(u.id, i % 4 === 0 ? 'yearly' : 'monthly');
  await giveScores(u.id);
}
console.log(`✓ ${DEMO_COUNT} demo members with active plans and 5 scores`);
console.log('\nDone. Log in as admin to run your first draw (Admin → Draws).');
