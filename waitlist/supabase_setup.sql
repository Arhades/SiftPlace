-- ============================================================
-- SiftPlace waitlist — full Supabase setup
-- Run this once in Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 0. Start clean ------------------------------------------------------
-- The table the dashboard auto-created ("SiftPlace Waitlist Signups") has a
-- bigint id that doesn't match the app (which uses uuid). There is no real
-- signup data yet, so we drop it and recreate it correctly below.
-- ⚠ This deletes any existing rows — only run before you've collected real signups.
drop table if exists public."SiftPlace Waitlist Signups" cascade;
drop table if exists public.waitlist cascade;

-- 1. Table + columns -----------------------------------------
create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  university      text,
  university_flag text,
  city            text,
  pain_point      text,
  desk_needed     text,
  created_at      timestamptz not null default now()
);

-- 2. Prevent duplicate emails (race-proof, at the DB level) ---
create unique index waitlist_email_key on public.waitlist (email);

-- 3. Row Level Security --------------------------------------
alter table public.waitlist enable row level security;

-- Anyone can JOIN (insert) ...
drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist for insert
  to anon with check (true);

-- ... but only the two founder accounts can READ the raw rows (emails stay
-- private even from any other authenticated user that might exist).
drop policy if exists "authenticated can read waitlist" on public.waitlist;
drop policy if exists "founders can read waitlist" on public.waitlist;
create policy "founders can read waitlist"
  on public.waitlist for select
  to authenticated
  using (
    (auth.jwt() ->> 'email') in ('shendayang75@gmail.com', 'looilefire@gmail.com')
  );

-- 4. Public helpers (security definer = can read the table to
--    return AGGREGATES only; they never expose individual emails) --

-- Total signups (for the live counter + queue position)
create or replace function public.get_waitlist_count()
returns bigint
language sql security definer set search_path = public
as $$ select count(*)::bigint from public.waitlist; $$;

-- University leaderboard (counts only)
create or replace function public.get_leaderboard()
returns table (university text, university_flag text, count bigint)
language sql security definer set search_path = public
as $$
  select university,
         max(university_flag) as university_flag,
         count(*)::bigint     as count
  from public.waitlist
  where university is not null and university <> ''
  group by university
  order by count(*) desc, university asc;
$$;

-- Attach survey answers to a row by its (client-generated) id.
-- Lets visitors finish the survey without granting broad UPDATE access.
-- Drop any stale overloads first so PostgREST has exactly one candidate.
drop function if exists public.submit_survey(bigint, text, text, text, text, text);
drop function if exists public.submit_survey(uuid, text, text, text, text, text);
create or replace function public.submit_survey(
  p_id uuid,
  p_university text,
  p_university_flag text,
  p_city text,
  p_pain_point text,
  p_desk_needed text
) returns void
language sql security definer set search_path = public
as $$
  update public.waitlist set
    university      = coalesce(nullif(p_university, ''), university),
    university_flag = coalesce(nullif(p_university_flag, ''), university_flag),
    city            = nullif(p_city, ''),
    pain_point      = nullif(p_pain_point, ''),
    desk_needed     = nullif(p_desk_needed, '')
  where id = p_id;
$$;

grant execute on function public.get_waitlist_count()                       to anon, authenticated;
grant execute on function public.get_leaderboard()                          to anon, authenticated;
grant execute on function public.submit_survey(uuid,text,text,text,text,text) to anon, authenticated;
