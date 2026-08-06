-- Confidential pastoral references. Run once in the Supabase SQL editor.
create table if not exists public.cmc_pastoral_references (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  pastor_name text not null,
  pastor_email text not null,
  token_hash text unique,
  token_expires_at timestamptz,
  requested_at timestamptz not null default now(),
  email_sent_at timestamptz,
  email_error text,
  submitted_at timestamptz,
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cmc_pastoral_references enable row level security;
revoke all on public.cmc_pastoral_references from anon, authenticated;

create index if not exists cmc_pastoral_references_participant_idx
  on public.cmc_pastoral_references(participant_id);
create index if not exists cmc_pastoral_references_token_idx
  on public.cmc_pastoral_references(token_hash)
  where token_hash is not null;

