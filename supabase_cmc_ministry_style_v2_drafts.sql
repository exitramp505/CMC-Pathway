-- CMC Ministry Style Inventory version 2: resumable drafts by authenticated user.
-- Applied to the CMC Pathway Supabase project on 2026-11-09.
create table if not exists public.cmc_ministry_style_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instrument_version smallint not null default 2 check (instrument_version = 2),
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cmc_ministry_style_drafts enable row level security;
grant select, insert, update, delete on public.cmc_ministry_style_drafts to authenticated;
drop policy if exists "Read own ministry style draft" on public.cmc_ministry_style_drafts;
create policy "Read own ministry style draft" on public.cmc_ministry_style_drafts for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Insert own ministry style draft" on public.cmc_ministry_style_drafts;
create policy "Insert own ministry style draft" on public.cmc_ministry_style_drafts for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Update own ministry style draft" on public.cmc_ministry_style_drafts;
create policy "Update own ministry style draft" on public.cmc_ministry_style_drafts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Delete own ministry style draft" on public.cmc_ministry_style_drafts;
create policy "Delete own ministry style draft" on public.cmc_ministry_style_drafts for delete to authenticated using ((select auth.uid())=user_id);
