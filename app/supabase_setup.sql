-- ============================================================
-- SiftPlace product app — saved listings Supabase setup
-- Run this in Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 1. Table + columns -----------------------------------------
create table if not exists public.user_saved_listings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing    jsonb not null,          -- holds the full ListingResult structure
  created_at timestamptz not null default now()
);

-- 2. Unique index to prevent duplicate saves per user --------
create unique index if not exists saved_user_listing_idx 
  on public.user_saved_listings (user_id, (listing->>'name'));

-- 3. Row Level Security (RLS) --------------------------------
alter table public.user_saved_listings enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can manage their own saved listings" on public.user_saved_listings;

-- Users can only CRUD (Create, Read, Update, Delete) their own rows
create policy "Users can manage their own saved listings"
  on public.user_saved_listings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
