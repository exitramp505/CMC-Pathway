-- CMC Pathway: safe, change-only Course Builder saves (v2).
-- ADDITIVE ONLY. No existing courses, modules, lessons, or progress are reseeded.
-- Make a Supabase database backup before running in the CMC Pathway project's SQL Editor.
-- Deploy AFTER this script runs; do not enable the new frontend until RPC is available.
--
-- The function executes as the calling SERVICE ROLE (SECURITY INVOKER).
-- A Netlify Function must independently verify cmc_admin before calling it.
-- PostgreSQL executes each RPC in one transaction; any exception rolls ALL changes back.

alter table public.cmc_courses
  add column if not exists save_revision bigint not null default 0;

create or replace function public.cmc_apply_course_patch(
  p_patch jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_id uuid;
  v_expected bigint;
  v_course jsonb;
  v_course_row public.cmc_courses%rowtype;
  v_old_slug text;
  v_old_stage text;
  v_old_status text;
  v_old_access text;
  v_old_key text;
  v_new_key text;
  v_now timestamptz := now();
  v_row jsonb;
  v_module_id uuid;
  v_lesson_id uuid;
  v_parent_id uuid;
  v_exists boolean;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or p_actor is null or (p_patch->>'save_version') is distinct from '2'
     or p_patch->>'id' is null
     or p_patch->>'expected_revision' is null then
    raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
  end if;
  v_id := (p_patch->>'id')::uuid;
  v_expected := (p_patch->>'expected_revision')::bigint;
  v_course := coalesce(p_patch->'course', '{}'::jsonb);
  if v_expected < 0 or jsonb_typeof(v_course) <> 'object'
     or jsonb_typeof(coalesce(p_patch->'modules_upsert', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_patch->'lessons_upsert', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_patch->'module_ids_to_delete', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_patch->'lesson_ids_to_delete', '[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
  end if;

  -- Lock the course row for the entire short database transaction. The revision
  -- also rejects submissions from other administrators' stale open tabs.
  select * into v_course_row
  from public.cmc_courses where id = v_id for update;
  v_exists := found;
  if v_exists then
    if v_course_row.save_revision <> v_expected then
      raise exception using errcode='P0001', message='CMC_COURSE_CONFLICT';
    end if;
    v_old_slug := v_course_row.slug;
    v_old_stage := v_course_row.stage_key;
    v_old_status := v_course_row.status;
    v_old_access := v_course_row.access_mode;

    update public.cmc_courses
    set slug = coalesce(v_course->>'slug', slug),
        title = coalesce(v_course->>'title', title),
        subtitle = coalesce(v_course->>'subtitle', subtitle),
        description = coalesce(v_course->>'description', description),
        stage_key = coalesce(v_course->>'stage_key', stage_key),
        access_mode = coalesce(v_course->>'access_mode', access_mode),
        navigation_mode = coalesce(v_course->>'navigation_mode', navigation_mode),
        estimated_minutes = coalesce((v_course->>'estimated_minutes')::integer, estimated_minutes),
        status = coalesce(v_course->>'status', status),
        updated_at = v_now,
        save_revision = save_revision + 1,
        published_at = case
          when coalesce(v_course->>'status', status) = 'published' then coalesce(published_at, v_now)
          else null
        end
    where id = v_id;
  else
    if v_expected <> 0
       or nullif(v_course->>'slug', '') is null
       or nullif(v_course->>'title', '') is null
       or nullif(v_course->>'status', '') is null then
      raise exception using errcode='P0001', message='CMC_COURSE_CONFLICT';
    end if;
    insert into public.cmc_courses (
      id, slug, title, subtitle, description, stage_key, access_mode,
      navigation_mode, estimated_minutes, status, created_by, updated_at,
      published_at, save_revision
    ) values (
      v_id, v_course->>'slug', v_course->>'title', coalesce(v_course->>'subtitle',''),
      coalesce(v_course->>'description',''), coalesce(v_course->>'stage_key','discover'),
      coalesce(v_course->>'access_mode','assigned'), coalesce(v_course->>'navigation_mode','open'),
      coalesce((v_course->>'estimated_minutes')::integer,0),
      v_course->>'status', p_actor, v_now,
      case when v_course->>'status' = 'published' then v_now else null end, 1
    );
  end if;

  -- Insert/update only modules whose content or position changed.
  for v_row in
    select value from jsonb_array_elements(
      coalesce(p_patch->'modules_upsert','[]'::jsonb)
    )
  loop
    v_module_id := (v_row->>'id')::uuid;
    if exists(select 1 from public.cmc_course_modules where id = v_module_id) then
      update public.cmc_course_modules
      set title = v_row->>'title',
          description = v_row->>'description',
          position = (v_row->>'position')::integer,
          updated_at = v_now
      where id = v_module_id and course_id = v_id;
      if not found then
        raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
      end if;
    else
      insert into public.cmc_course_modules
        (id,course_id,title,description,position,updated_at)
      values
        (v_module_id,v_id,v_row->>'title',v_row->>'description',
         (v_row->>'position')::integer,v_now);
    end if;
  end loop;

  -- Updates keep lesson UUIDs intact, preserving every participant's progress.
  for v_row in
    select value from jsonb_array_elements(
      coalesce(p_patch->'lessons_upsert','[]'::jsonb)
    )
  loop
    v_lesson_id := (v_row->>'id')::uuid;
    v_parent_id := (v_row->>'module_id')::uuid;
    if not exists(
      select 1 from public.cmc_course_modules
      where id=v_parent_id and course_id=v_id
    ) then
      raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
    end if;

    if exists(select 1 from public.cmc_course_lessons where id=v_lesson_id) then
      update public.cmc_course_lessons
      set module_id=v_parent_id, title=v_row->>'title',
          summary=v_row->>'summary', content=v_row->>'content',
          lesson_type=v_row->>'lesson_type',
          video_url=v_row->>'video_url', image_url=v_row->>'image_url',
          image_alt=v_row->>'image_alt', resource_url=v_row->>'resource_url',
          resource_label=v_row->>'resource_label',
          reflection_prompt=v_row->>'reflection_prompt',
          response_required=(v_row->>'response_required')::boolean,
          estimated_minutes=(v_row->>'estimated_minutes')::integer,
          is_required=(v_row->>'is_required')::boolean,
          position=(v_row->>'position')::integer,
          updated_at=v_now
      where id=v_lesson_id and course_id=v_id;
      if not found then
        raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
      end if;
    else
      insert into public.cmc_course_lessons
        (id,course_id,module_id,title,summary,content,lesson_type,
         video_url,image_url,image_alt,resource_url,resource_label,
         reflection_prompt,response_required,estimated_minutes,
         is_required,position,updated_at)
      values
        (v_lesson_id,v_id,v_parent_id,v_row->>'title',v_row->>'summary',
         v_row->>'content',v_row->>'lesson_type',v_row->>'video_url',
         v_row->>'image_url',v_row->>'image_alt',v_row->>'resource_url',
         v_row->>'resource_label',v_row->>'reflection_prompt',
         (v_row->>'response_required')::boolean,
         (v_row->>'estimated_minutes')::integer,
         (v_row->>'is_required')::boolean,
         (v_row->>'position')::integer,v_now);
    end if;
  end loop;

  -- Intentional removals only. Refuse deletes that would cascade participant
  -- completion or written responses. Older lessons are NEVER wholesale replaced.
  for v_row in
    select value from jsonb_array_elements(
      coalesce(p_patch->'lesson_ids_to_delete','[]'::jsonb)
    )
  loop
    v_lesson_id := (trim(both '"' from v_row::text))::uuid;
    if exists(
      select 1 from public.cmc_course_lesson_progress
      where lesson_id=v_lesson_id
    ) or exists(
      select 1 from public.cmc_course_lesson_responses
      where lesson_id=v_lesson_id
    ) then
      raise exception using errcode='P0001', message='CMC_LESSON_HAS_PROGRESS';
    end if;
    delete from public.cmc_course_lessons
    where id=v_lesson_id and course_id=v_id;
    if not found then
      raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
    end if;
  end loop;

  for v_row in
    select value from jsonb_array_elements(
      coalesce(p_patch->'module_ids_to_delete','[]'::jsonb)
    )
  loop
    v_module_id := (trim(both '"' from v_row::text))::uuid;
    if exists(
      select 1 from public.cmc_course_lessons l
      join public.cmc_course_lesson_progress p on p.lesson_id=l.id
      where l.module_id=v_module_id and l.course_id=v_id
    ) or exists(
      select 1 from public.cmc_course_lessons l
      join public.cmc_course_lesson_responses r on r.lesson_id=l.id
      where l.module_id=v_module_id and l.course_id=v_id
    ) then
      raise exception using errcode='P0001', message='CMC_LESSON_HAS_PROGRESS';
    end if;
    delete from public.cmc_course_modules
    where id=v_module_id and course_id=v_id;
    if not found then
      raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
    end if;
  end loop;

  select * into strict v_course_row
  from public.cmc_courses where id=v_id;

  -- Publishing validation is performed after applying the patch, within the
  -- transaction; a failure rolls back the whole save without changing progress.
  if v_course_row.status = 'published' then
    if nullif(btrim(v_course_row.title),'') is null
       or nullif(btrim(v_course_row.slug),'') is null
       or not exists(
         select 1 from public.cmc_course_lessons where course_id=v_id
       )
       or exists(
         select 1 from public.cmc_course_modules
         where course_id=v_id and nullif(btrim(title),'') is null
       )
       or exists(
         select 1 from public.cmc_course_lessons
         where course_id=v_id and nullif(btrim(title),'') is null
       ) then
      raise exception using errcode='P0001', message='CMC_COURSE_NOT_PUBLISHABLE';
    end if;
  end if;

  -- Keep access assignments in the SAME transaction as publishing and edits.
  if not v_exists or v_old_slug is distinct from v_course_row.slug
     or v_old_stage is distinct from v_course_row.stage_key
     or v_old_status is distinct from v_course_row.status
     or v_old_access is distinct from v_course_row.access_mode then

    v_old_key := case when v_old_slug='discover' then 'discover_course'
                      else 'course:'||v_id::text end;
    v_new_key := case when v_course_row.slug='discover' then 'discover_course'
                      else 'course:'||v_id::text end;

    if v_old_key is distinct from v_new_key and v_exists then
      update public.candidate_assignments
      set item_key=v_new_key, stage_key=v_course_row.stage_key, updated_at=v_now
      where item_key=v_old_key;
    else
      update public.candidate_assignments
      set stage_key=v_course_row.stage_key, updated_at=v_now
      where item_key=v_new_key;
    end if;

    if v_course_row.status <> 'published' or v_course_row.access_mode <> 'automatic' then
      delete from public.candidate_assignments
      where item_key=v_new_key and assignment_source='automatic';
    else
      -- Keep leader-assigned access marked as leader-assigned. Otherwise
      -- changing a course back to "assigned" would delete manual assignments.
      update public.candidate_assignments
      set status='assigned', hidden_at=null, updated_at=v_now
      where item_key=v_new_key and assignment_source='automatic';

      insert into public.candidate_assignments
        (user_id,candidate_email,candidate_name,item_key,item_type,
         stage_key,status,assignment_source,assigned_at,hidden_at,updated_at)
      select p.id,coalesce(p.email,''),
             coalesce(nullif(p.full_name,''),nullif(p.email,''),'Participant'),
             v_new_key,'course',v_course_row.stage_key,'assigned',
             'automatic',v_now,null,v_now
      from public.candidate_profiles p
      where p.account_role='participant' and p.archived_at is null
      on conflict (user_id,item_key) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'id',v_course_row.id,
    'slug',v_course_row.slug,
    'status',v_course_row.status,
    'save_revision',v_course_row.save_revision,
    'published_at',v_course_row.published_at,
    'updated_at',v_course_row.updated_at
  );
end;
$$;

-- Never allow browser clients to call this privileged course-write RPC.
revoke all on function public.cmc_apply_course_patch(jsonb,uuid) from public;
revoke all on function public.cmc_apply_course_patch(jsonb,uuid) from anon;
revoke all on function public.cmc_apply_course_patch(jsonb,uuid) from authenticated;
grant execute on function public.cmc_apply_course_patch(jsonb,uuid) to service_role;

-- After applying, verify the function exists and only service_role can execute:
-- select routine_name from information_schema.routines
-- where routine_schema='public' and routine_name='cmc_apply_course_patch';


-- Course deletion uses one transaction, too. Never remove enrollment or progress
-- records as a side effect of the delete action, and do not orphan assignments.
create or replace function public.cmc_delete_course_safely(
  p_course_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_course public.cmc_courses%rowtype;
  v_item_key text;
begin
  if p_course_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode='P0001', message='CMC_INVALID_PATCH';
  end if;

  select * into v_course
  from public.cmc_courses
  where id=p_course_id
  for update;

  if not found then
    raise exception using errcode='P0001', message='CMC_COURSE_NOT_FOUND';
  end if;
  if v_course.save_revision <> p_expected_revision then
    raise exception using errcode='P0001', message='CMC_COURSE_CONFLICT';
  end if;
  if exists(select 1 from public.cmc_course_enrollments where course_id=p_course_id)
     or exists(select 1 from public.cmc_course_lesson_progress where course_id=p_course_id)
     or exists(select 1 from public.cmc_course_lesson_responses where course_id=p_course_id) then
    raise exception using errcode='P0001', message='CMC_COURSE_HAS_PROGRESS';
  end if;

  v_item_key := case when v_course.slug='discover' then 'discover_course'
                     else 'course:'||p_course_id::text end;
  delete from public.candidate_assignments where item_key=v_item_key;
  delete from public.cmc_courses where id=p_course_id;

  return jsonb_build_object('id', p_course_id, 'deleted', true);
end;
$$;

revoke all on function public.cmc_delete_course_safely(uuid,bigint) from public;
revoke all on function public.cmc_delete_course_safely(uuid,bigint) from anon;
revoke all on function public.cmc_delete_course_safely(uuid,bigint) from authenticated;
grant execute on function public.cmc_delete_course_safely(uuid,bigint) to service_role;
