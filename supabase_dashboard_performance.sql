-- Participant dashboard query indexes.
-- Apply once in Supabase before deploying the consolidated dashboard loader.

create index if not exists candidate_assignments_user_status_created_idx
  on public.candidate_assignments(user_id, status, created_at);

create index if not exists assessment_results_user_created_idx
  on public.assessment_results(user_id, created_at desc);
