create table if not exists public.cmc_annual_assessment_audit (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.cmc_regional_assessments(id) on delete cascade,
 actor_id uuid not null,
 action text not null check(action in ('reopened')),
 reason text not null,
 occurred_at timestamptz not null default now()
);
create index if not exists annual_assessment_audit_by_record
 on public.cmc_annual_assessment_audit(assessment_id,occurred_at desc);
alter table public.cmc_annual_assessment_audit enable row level security;
revoke all on public.cmc_annual_assessment_audit from anon,authenticated;
grant select,insert on public.cmc_annual_assessment_audit to service_role;
