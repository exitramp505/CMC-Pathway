-- Applied to CMC Pathway production Supabase, 2026-10-15.
-- Support foreign-key lookups used by course progress and protected deletions.
create index if not exists cmc_course_enrollments_course_idx on public.cmc_course_enrollments(course_id);
create index if not exists cmc_course_progress_course_idx on public.cmc_course_lesson_progress(course_id);
create index if not exists cmc_course_progress_lesson_idx on public.cmc_course_lesson_progress(lesson_id);
create index if not exists cmc_course_responses_course_idx on public.cmc_course_lesson_responses(course_id);
create index if not exists cmc_course_responses_lesson_idx on public.cmc_course_lesson_responses(lesson_id);
create index if not exists cmc_course_lessons_module_idx on public.cmc_course_lessons(module_id);

-- Supabase-recommended auth.uid() initplans, preserving original authorization.
alter policy "Users can read own profile" on public.candidate_profiles using ((select auth.uid()) = id);
alter policy "Users can insert own profile" on public.candidate_profiles with check ((select auth.uid()) = id);
alter policy "Users can update own profile" on public.candidate_profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "Users can read own assessment results" on public.assessment_results using ((select auth.uid()) = user_id);
alter policy "Users can read own application" on public.candidate_applications using ((select auth.uid()) = user_id);
alter policy "Candidates can read assigned items" on public.candidate_assignments using (((select auth.uid()) = user_id) and status = 'assigned'::text);
alter policy "Users can read own application events" on public.candidate_application_events using ((select auth.uid()) = user_id);
alter policy "Participants read their task plans" on public.cmc_participant_task_plans using ((select auth.uid()) = user_id);
alter policy "Participants read their task plan tasks" on public.cmc_participant_plan_tasks
  using (exists (
    select 1 from public.cmc_participant_task_plans p
    where p.id = cmc_participant_plan_tasks.plan_id
      and p.user_id = (select auth.uid())
  ));
