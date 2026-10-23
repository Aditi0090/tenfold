-- =============================================================================
-- Tenfold — database schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Then run supabase/seed.sql to add the starter charities.
--
-- Conventions
--   * All money is stored as integer minor units (pence) in *_cents columns,
--     so prize splits never suffer floating-point drift.
--   * Row Level Security (RLS) is ON for every table. The browser uses the
--     public "anon" key and can only do what the policies below allow.
--     Server functions in /api use the service-role key and bypass RLS.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. CHARITIES
-- -----------------------------------------------------------------------------
create table if not exists public.charities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  tagline          text,
  description      text,
  category         text,
  location         text,
  website          text,
  image_url        text,
  featured         boolean not null default false,  -- homepage spotlight
  active           boolean not null default true,   -- hidden from users when false
  -- Upcoming events, e.g. [{"title":"Charity golf day","date":"2026-12-05","location":"Leeds"}]
  events           jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. PROFILES (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  full_name        text,
  role             text not null default 'user' check (role in ('user','admin')),
  charity_id       uuid references public.charities(id) on delete set null,
  -- PRD §08: minimum 10%. We cap at 60% so the fixed 30% prize-pool share
  -- and a 10% platform share always fit inside 100% of the fee.
  charity_percent  int  not null default 10 check (charity_percent between 10 and 60),
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS (one row per user, mirrored from Stripe)
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  plan                    text not null check (plan in ('monthly','yearly')),
  status                  text not null default 'inactive'
                          check (status in ('active','trialing','past_due','canceled','lapsed','inactive')),
  amount_cents            int  not null default 0,      -- price per billing period
  currency                text not null default 'gbp',
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  current_period_end      timestamptz,                  -- renewal / expiry date
  cancel_at_period_end    boolean not null default false,
  source                  text not null default 'stripe' check (source in ('stripe','manual')),
  updated_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. SCORES — rolling window of the latest 5 Stableford scores per user
-- -----------------------------------------------------------------------------
create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  score       int  not null check (score between 1 and 45),
  played_on   date not null,         -- future dates are rejected by trigger below
  created_at  timestamptz not null default now(),
  unique (user_id, played_on)            -- PRD: only one score per date
);
create index if not exists scores_user_date_idx on public.scores (user_id, played_on desc);

-- -----------------------------------------------------------------------------
-- 5. DRAWS
-- -----------------------------------------------------------------------------
create table if not exists public.draws (
  id                   uuid primary key default gen_random_uuid(),
  draw_month           date not null unique,      -- always the 1st of the month
  mode                 text not null default 'random' check (mode in ('random','weighted')),
  weight_bias          text check (weight_bias in ('most','least')),
  status               text not null default 'simulated' check (status in ('simulated','published')),
  numbers              int[],                     -- the 5 winning numbers
  active_subscribers   int  not null default 0,
  eligible_entries     int  not null default 0,
  pool_total_cents     int  not null default 0,   -- this month's new contributions
  rollover_in_cents    int  not null default 0,   -- jackpot carried in
  pool_5_cents         int  not null default 0,   -- 40% + rollover
  pool_4_cents         int  not null default 0,   -- 35%
  pool_3_cents         int  not null default 0,   -- 25%
  rollover_out_cents   int  not null default 0,   -- jackpot carried to next month
  unclaimed_cents      int  not null default 0,   -- unwon 4/3 tiers + rounding
  winners_5            int  not null default 0,
  winners_4            int  not null default 0,
  winners_3            int  not null default 0,
  -- Full simulation result, kept so "publish" releases exactly what the
  -- admin reviewed. Cleared on publish (results move to the tables below).
  simulation           jsonb,
  simulated_at         timestamptz,
  published_at         timestamptz,
  created_at           timestamptz not null default now()
);

create table if not exists public.draw_entries (
  id           uuid primary key default gen_random_uuid(),
  draw_id      uuid not null references public.draws(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  numbers      int[] not null,       -- snapshot of the user's 5 scores at draw time
  match_count  int not null default 0,
  unique (draw_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 6. WINNERS + verification
-- -----------------------------------------------------------------------------
create table if not exists public.winners (
  id                    uuid primary key default gen_random_uuid(),
  draw_id               uuid not null references public.draws(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  tier                  int  not null check (tier in (3,4,5)),
  prize_cents           int  not null default 0,
  verification_status   text not null default 'awaiting_proof'
                        check (verification_status in ('awaiting_proof','pending_review','approved','rejected')),
  proof_path            text,          -- path inside the private "winner-proofs" bucket
  payout_status         text not null default 'pending' check (payout_status in ('pending','paid')),
  admin_note            text,
  proof_submitted_at    timestamptz,
  reviewed_at           timestamptz,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  unique (draw_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 7. DONATIONS (subscription share + independent one-off gifts)
-- -----------------------------------------------------------------------------
create table if not exists public.donations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  charity_id    uuid references public.charities(id) on delete set null,
  amount_cents  int  not null check (amount_cents > 0),
  kind          text not null check (kind in ('subscription','independent')),
  donor_name    text,
  stripe_ref    text unique,          -- invoice / checkout id → idempotent webhooks
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Is the current user an admin? SECURITY DEFINER so policies on profiles
-- can call it without recursion.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Real-time subscription check (PRD §04 "validation on every request").
-- A subscription counts only while Stripe says it is live AND the paid
-- period has not ended — so a missed webhook can never grant free access.
create or replace function public.has_active_subscription(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where user_id = uid
      and status in ('active','trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- Create a profile row automatically when someone signs up.
-- Name / charity / percentage come from the signup form metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_charity uuid;
  v_pct     int;
begin
  begin v_charity := (new.raw_user_meta_data->>'charity_id')::uuid;
  exception when others then v_charity := null; end;
  v_pct := coalesce((new.raw_user_meta_data->>'charity_percent')::int, 10);
  v_pct := greatest(10, least(60, v_pct));

  insert into profiles (id, email, full_name, charity_id, charity_percent)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_charity, v_pct)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their profile, but never promote themselves to admin.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin()
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and auth.uid() is not null then
    raise exception 'Only an administrator can change roles';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- Rolling-5 score logic (PRD §05)
--   BEFORE INSERT: if the user already has 5 scores and the new score is
--                  OLDER than all of them, reject it — it would be dropped
--                  instantly, which would silently lose the user's input.
--   AFTER  INSERT: keep only the 5 most recent (by played_on); the oldest
--                  is deleted automatically.
-- -----------------------------------------------------------------------------
create or replace function public.scores_before_insert()
returns trigger language plpgsql as $$
declare
  v_count int;
  v_oldest date;
begin
  if new.played_on > (now() at time zone 'utc')::date + 1 then
    raise exception 'A score cannot be dated in the future' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    return new;          -- edits keep the same row, so the 5-limit is unaffected
  end if;

  select count(*), min(played_on) into v_count, v_oldest
  from scores where user_id = new.user_id;

  if v_count >= 5 and new.played_on < v_oldest then
    raise exception 'This round is older than all 5 of your stored scores, so it would be dropped immediately. Only your latest 5 rounds count.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.scores_after_insert()
returns trigger language plpgsql as $$
begin
  delete from scores
  where user_id = new.user_id
    and id not in (
      select id from scores where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return null;
end $$;

drop trigger if exists scores_bi on public.scores;
create trigger scores_bi before insert or update on public.scores
  for each row execute function public.scores_before_insert();

drop trigger if exists scores_ai on public.scores;
create trigger scores_ai after insert on public.scores
  for each row execute function public.scores_after_insert();

-- Winner submits proof (only their own row, only while awaiting / rejected).
create or replace function public.submit_winner_proof(p_winner_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update winners
     set proof_path = p_path,
         verification_status = 'pending_review',
         proof_submitted_at = now(),
         admin_note = null
   where id = p_winner_id
     and user_id = auth.uid()
     and verification_status in ('awaiting_proof','rejected');
  if not found then
    raise exception 'Proof can only be submitted for your own unverified win';
  end if;
end $$;

-- Public impact numbers for the homepage (no personal data exposed).
create or replace function public.platform_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total_raised_cents', coalesce((select sum(amount_cents) from donations), 0),
    'active_members',     (select count(*) from subscriptions
                            where status in ('active','trialing')
                              and (current_period_end is null or current_period_end > now())),
    'charities',          (select count(*) from charities where active),
    'current_jackpot_rollover_cents',
                          coalesce((select rollover_out_cents from draws
                                    where status = 'published'
                                    order by draw_month desc limit 1), 0),
    'total_paid_out_cents', coalesce((select sum(prize_cents) from winners where payout_status = 'paid'), 0)
  );
$$;

-- Totals raised per charity (public).
create or replace function public.charity_totals()
returns table (charity_id uuid, total_cents bigint, supporters bigint)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce((select sum(d.amount_cents) from donations d where d.charity_id = c.id), 0),
         (select count(*) from profiles p where p.charity_id = c.id)
  from charities c where c.active;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.charities      enable row level security;
alter table public.profiles       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.scores         enable row level security;
alter table public.draws          enable row level security;
alter table public.draw_entries   enable row level security;
alter table public.winners        enable row level security;
alter table public.donations      enable row level security;

-- Charities: everyone reads active ones; admins do everything.
drop policy if exists charities_read on public.charities;
create policy charities_read on public.charities for select using (active or public.is_admin());
drop policy if exists charities_admin on public.charities;
create policy charities_admin on public.charities for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: own row, or admin.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles for delete using (public.is_admin());

-- Subscriptions: read own / admin. Writes happen only on the server
-- (service role) after Stripe confirms payment.
drop policy if exists subs_read on public.subscriptions;
create policy subs_read on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());

-- Scores: read own; write own ONLY with an active subscription; admin all.
drop policy if exists scores_read on public.scores;
create policy scores_read on public.scores for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores for insert
  with check ((user_id = auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());
drop policy if exists scores_update on public.scores;
create policy scores_update on public.scores for update
  using ((user_id = auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin())
  with check ((user_id = auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());
drop policy if exists scores_delete on public.scores;
create policy scores_delete on public.scores for delete
  using ((user_id = auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());

-- Draws: published draws are public; simulations are admin-only.
drop policy if exists draws_read on public.draws;
create policy draws_read on public.draws for select using (status = 'published' or public.is_admin());

-- Entries / winners / donations: own rows or admin.
drop policy if exists entries_read on public.draw_entries;
create policy entries_read on public.draw_entries for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists winners_read on public.winners;
create policy winners_read on public.winners for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists winners_admin_update on public.winners;
create policy winners_admin_update on public.winners for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists donations_read on public.donations;
create policy donations_read on public.donations for select using (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- STORAGE
--   winner-proofs  (private) — files stored as <user_id>/<filename>
--   charity-media  (public)  — images uploaded by admins
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('charity-media', 'charity-media', true)
on conflict (id) do nothing;

drop policy if exists "proofs: owner upload" on storage.objects;
create policy "proofs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "proofs: owner or admin read" on storage.objects;
create policy "proofs: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'winner-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "charity media: public read" on storage.objects;
create policy "charity media: public read" on storage.objects for select
  using (bucket_id = 'charity-media');

drop policy if exists "charity media: admin write" on storage.objects;
create policy "charity media: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'charity-media' and public.is_admin())
  with check (bucket_id = 'charity-media' and public.is_admin());

-- Allow the browser roles to call the public RPCs.
grant execute on function public.platform_stats()            to anon, authenticated;
grant execute on function public.charity_totals()            to anon, authenticated;
grant execute on function public.submit_winner_proof(uuid, text) to authenticated;
grant execute on function public.has_active_subscription(uuid)   to authenticated;
grant execute on function public.is_admin()                  to anon, authenticated;
