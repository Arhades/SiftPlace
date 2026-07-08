-- Community listing reviews — run once in the Supabase SQL editor of the
-- (repurposed) waitlist project. The app talks to this table through PostgREST
-- with the public anon key (app/.env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY),
-- so Row Level Security below is the actual gate.
--
-- Keep the old waitlist table until sign-ups are exported; dropping it is a
-- separate, deliberate step (see PROGRESS.md, Phase 2).

create table if not exists public.listing_comments (
  id           uuid primary key default gen_random_uuid(),
  listing_key  text not null,             -- name|lat4dp|lon4dp (see app/src/lib/community.ts)
  listing_name text not null,
  author       text,                      -- optional display name, no accounts
  body         text not null check (char_length(body) between 3 and 600),
  created_at   timestamptz not null default now()
);

create index if not exists listing_comments_key_idx
  on public.listing_comments (listing_key, created_at desc);

alter table public.listing_comments enable row level security;

-- Anyone may read the shared comments…
create policy "public read" on public.listing_comments
  for select using (true);

-- …and post one (length-checked; no updates or deletes from the client).
create policy "public insert" on public.listing_comments
  for insert with check (
    char_length(body) between 3 and 600
    and (author is null or char_length(author) <= 40)
    and char_length(listing_name) <= 200
  );

-- ── Listing view counter ────────────────────────────────────────────────────
-- "How many students viewed this property" on the listing detail panel.
-- The app calls the RPC below once per browser session per listing
-- (p_increment=false on repeat opens just reads the count).

create table if not exists public.listing_stats (
  listing_key text primary key,
  views       bigint not null default 0
);

alter table public.listing_stats enable row level security;

create policy "public read stats" on public.listing_stats
  for select using (true);
-- no insert/update policies: writes go ONLY through the function below

create or replace function public.bump_listing_view(
  p_listing_key text,
  p_increment boolean default true
) returns bigint
language plpgsql
security definer            -- runs as owner, so anon can't touch the table directly
set search_path = public
as $$
declare v bigint;
begin
  if p_increment then
    insert into public.listing_stats as s (listing_key, views)
    values (p_listing_key, 1)
    on conflict (listing_key) do update set views = s.views + 1
    returning views into v;
  else
    select views into v from public.listing_stats where listing_key = p_listing_key;
  end if;
  return coalesce(v, 0);
end;
$$;

grant execute on function public.bump_listing_view(text, boolean) to anon;

-- ── Problem / crash reports ─────────────────────────────────────────────────
-- "Report this problem" button + automatic uncaught-crash capture
-- (app/src/lib/telemetry.ts). Anon may INSERT only — reading reports is for
-- the founder via the Supabase dashboard (or the service key later).

create table if not exists public.problem_reports (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('user', 'crash')),
  message    text not null check (char_length(message) between 1 and 1000),
  context    text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.problem_reports enable row level security;

create policy "public insert reports" on public.problem_reports
  for insert with check (
    kind in ('user', 'crash')
    and char_length(message) between 1 and 1000
  );
-- (no select policy: reports are not readable with the anon key)

-- Later hardening ideas (not needed for launch): a per-IP rate limit via a
-- Postgres function + trigger, Turnstile verification through an Edge
-- Function, and a moderation flag column surfaced in a founder dashboard.
