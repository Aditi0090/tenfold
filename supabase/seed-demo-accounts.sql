-- Creates the test accounts + 24 demo members (same result as `npm run seed:demo`).
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
--   Admin:  admin@tenfold.demo  / Tenfold!Admin2026
--   Member: player@tenfold.demo / Tenfold!Player2026  (active monthly plan, 5 scores)

create or replace function pg_temp.seed_user(p_email text, p_password text, p_name text, p_charity uuid, p_pct int)
returns uuid language plpgsql as $f$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'charity_id', p_charity, 'charity_percent', p_pct),
      now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now());
  end if;
  return uid;
end $f$;

create or replace function pg_temp.seed_play(p_uid uuid, p_plan text)
returns void language plpgsql as $f$
declare k int;
begin
  insert into public.subscriptions (user_id, plan, status, amount_cents, current_period_end, source, updated_at)
  values (p_uid, p_plan, 'active', case when p_plan = 'yearly' then 10000 else 1000 end,
          now() + case when p_plan = 'yearly' then interval '12 months' else interval '1 month' end, 'manual', now())
  on conflict (user_id) do update set plan = excluded.plan, status = 'active', amount_cents = excluded.amount_cents,
    current_period_end = excluded.current_period_end, source = 'manual', updated_at = now();
  delete from public.scores where user_id = p_uid;
  for k in 0..4 loop
    insert into public.scores (user_id, score, played_on)
    values (p_uid, 18 + floor(random() * 25)::int, current_date - (k * 6 + 1 + floor(random() * 5)::int));
  end loop;
end $f$;

do $$
declare
  ch uuid[];
  uid uuid;
  i int;
  fn text[] := array['Sam','Priya','Jordan','Aisha','Tom','Mei','Leo','Nina','Raj','Ella','Omar','Zoe'];
  ln text[] := array['Patel','Clarke','Okafor','Silva','Novak','Reid','Khan','Murphy'];
begin
  select array_agg(id order by name) into ch from public.charities where active;
  if ch is null then raise exception 'Run supabase/seed.sql first (no charities)'; end if;

  uid := pg_temp.seed_user('admin@tenfold.demo', 'Tenfold!Admin2026', 'Tenfold Admin', ch[1], 10);
  update public.profiles set role = 'admin' where id = uid;

  uid := pg_temp.seed_user('player@tenfold.demo', 'Tenfold!Player2026', 'Alex Morgan', ch[2], 15);
  perform pg_temp.seed_play(uid, 'monthly');

  for i in 1..24 loop
    uid := pg_temp.seed_user(format('demo%s@tenfold.demo', lpad(i::text, 2, '0')),
                             md5(random()::text), fn[1 + i % 12] || ' ' || ln[1 + i % 8],
                             ch[1 + i % array_length(ch, 1)], (array[10,10,15,20,25])[1 + i % 5]);
    perform pg_temp.seed_play(uid, case when i % 4 = 0 then 'yearly' else 'monthly' end);
  end loop;
end $$;

select p.email, p.role, s.plan, s.status, (select count(*) from public.scores sc where sc.user_id = p.id) as scores
from public.profiles p left join public.subscriptions s on s.user_id = p.id
order by p.role, p.email;
