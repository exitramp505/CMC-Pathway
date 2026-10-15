-- End-to-end PostgreSQL 17 checks for the atomic save RPC in an ephemeral DB.
do $$
declare
  v_course uuid := '11111111-1111-4111-8111-111111111111';
  v_module uuid := '22222222-2222-4222-8222-222222222222';
  v_newmodule uuid := '33333333-3333-4333-8333-333333333333';
  v_badmodule uuid := '66666666-6666-4666-8666-666666666666';
  v_lesson uuid := '44444444-4444-4444-8444-444444444444';
  v_lesson2 uuid := '55555555-5555-4555-8555-555555555555';
  v_user uuid := '77777777-7777-4777-8777-777777777777';
  v_actor uuid := '88888888-8888-4888-8888-888888888888';
  v_empty uuid := '99999999-9999-4999-8999-999999999999';
  v_course_fields jsonb;
  v_lesson_row jsonb;
  v_lesson2_row jsonb;
  v_patch jsonb;
  v_response jsonb;
  v_revision bigint;
  v_title text;
  v_content text;
  v_caught boolean;
begin
  insert into public.candidate_profiles(id, email, full_name, account_role)
  values(v_user, 'sample@example.test', 'Sample Member','participant');

  v_course_fields:=jsonb_build_object(
    'slug','learn', 'title','Sample Course','status','draft',
    'stage_key','discover','access_mode','assigned',
    'navigation_mode','open','estimated_minutes',15,
    'description','Teaching','subtitle','Introduction'
  );
  v_lesson_row:=jsonb_build_object(
    'id',v_lesson,'module_id',v_module,'title','Lesson One',
    'summary','Short','content','## Original text','lesson_type','article',
    'video_url','','image_url','','image_alt','','resource_url','',
    'resource_label','','reflection_prompt','','response_required',false,
    'estimated_minutes',10,'is_required',true,'position',0
  );
  v_lesson2_row:=v_lesson_row || jsonb_build_object(
    'id',v_lesson2,'title','Lesson Two','content','No changes expected','position',1
  );

  v_patch:=jsonb_build_object(
    'save_version',2,'id',v_course,'expected_revision',0,
    'course',v_course_fields,
    'modules_upsert',jsonb_build_array(
      jsonb_build_object('id',v_module,'title','Module One','description','','position',0)
    ),
    'lessons_upsert',jsonb_build_array(v_lesson_row,v_lesson2_row),
    'module_ids_to_delete','[]'::jsonb,
    'lesson_ids_to_delete','[]'::jsonb
  );
  v_response:=public.cmc_apply_course_patch(v_patch,v_actor);
  if v_response->>'save_revision'<>'1' then
    raise exception 'new course was not saved with revision one';
  end if;
  if (select count(*) from public.cmc_course_lessons where course_id=v_course)<>2 then
    raise exception 'new lessons did not save';
  end if;

  -- Changed-only writes preserve the untouched lesson and its content.
  v_patch:=jsonb_build_object(
    'save_version',2,'id',v_course,'expected_revision',1,
    'course','{}'::jsonb, 'modules_upsert','[]'::jsonb,
    'lessons_upsert',jsonb_build_array(
      v_lesson_row || jsonb_build_object('content','Updated body')
    ),
    'module_ids_to_delete','[]'::jsonb,'lesson_ids_to_delete','[]'::jsonb
  );
  v_response:=public.cmc_apply_course_patch(v_patch,v_actor);
  if v_response->>'save_revision'<>'2' then raise exception 'revision did not advance'; end if;
  select content into v_content from public.cmc_course_lessons where id=v_lesson2;
  if v_content <> 'No changes expected' then raise exception 'untouched lesson was changed'; end if;

  -- Stale concurrent edit is blocked without replacing the newer changes.
  v_caught:=false;
  begin
    perform public.cmc_apply_course_patch(
      jsonb_build_object('save_version',2,'id',v_course,'expected_revision',1,
        'course',jsonb_build_object('title','Stale title'),
        'modules_upsert','[]'::jsonb,'lessons_upsert','[]'::jsonb,
        'module_ids_to_delete','[]'::jsonb,'lesson_ids_to_delete','[]'::jsonb),
      v_actor);
  exception when others then
    if sqlerrm not like '%CMC_COURSE_CONFLICT%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'stale version did not fail'; end if;
  select title,save_revision into v_title,v_revision from public.cmc_courses where id=v_course;
  if v_title<>'Sample Course' or v_revision<>2 then
    raise exception 'failed stale edit modified the course';
  end if;

  -- A bad lesson reference following a valid module insert must roll back
  -- the entire transaction, including the new module and save revision.
  v_caught:=false;
  begin
    perform public.cmc_apply_course_patch(
      jsonb_build_object('save_version',2,'id',v_course,'expected_revision',2,
      'course',jsonb_build_object('title','Should roll back'),
      'modules_upsert',jsonb_build_array(
        jsonb_build_object('id',v_newmodule,'title','No partial insert','description','','position',1)
      ),
      'lessons_upsert',jsonb_build_array(
        v_lesson_row || jsonb_build_object('module_id',v_badmodule)
      ),
      'module_ids_to_delete','[]'::jsonb,'lesson_ids_to_delete','[]'::jsonb),v_actor);
  exception when others then
    if sqlerrm not like '%CMC_INVALID_PATCH%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'invalid patch did not fail'; end if;
  if exists(select 1 from public.cmc_course_modules where id=v_newmodule)
    or (select title from public.cmc_courses where id=v_course)<>'Sample Course'
    or (select save_revision from public.cmc_courses where id=v_course)<>2 then
    raise exception 'failed patch left partial changes';
  end if;

  -- Existing participant progress must never be destroyed by removing a lesson.
  insert into public.cmc_course_lesson_progress(id,user_id,course_id,lesson_id,completed)
  values(gen_random_uuid(),v_user,v_course,v_lesson,true);
  v_caught:=false;
  begin
    perform public.cmc_apply_course_patch(
      jsonb_build_object('save_version',2,'id',v_course,'expected_revision',2,
      'course','{}'::jsonb,'modules_upsert','[]'::jsonb,'lessons_upsert','[]'::jsonb,
      'module_ids_to_delete','[]'::jsonb,
      'lesson_ids_to_delete',jsonb_build_array(v_lesson)),v_actor);
  exception when others then
    if sqlerrm not like '%CMC_LESSON_HAS_PROGRESS%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught or not exists(select 1 from public.cmc_course_lessons where id=v_lesson)
    or (select save_revision from public.cmc_courses where id=v_course)<>2 then
    raise exception 'course progress delete protection failed';
  end if;

  -- Publication and automatic participant assignment must commit together.
  v_patch:=jsonb_build_object(
    'save_version',2,'id',v_course,'expected_revision',2,
    'course',jsonb_build_object('status','published','access_mode','automatic'),
    'modules_upsert','[]'::jsonb,'lessons_upsert','[]'::jsonb,
    'module_ids_to_delete','[]'::jsonb,'lesson_ids_to_delete','[]'::jsonb
  );
  v_response:=public.cmc_apply_course_patch(v_patch,v_actor);
  if v_response->>'status'<>'published' or v_response->>'save_revision'<>'3'
    or (select count(*) from public.candidate_assignments where item_key='course:'||v_course::text and user_id=v_user)<>1 then
    raise exception 'publish or auto-assignment failed';
  end if;


  -- A course that has enrollment or completion data cannot be deleted.
  v_caught:=false;
  begin
    perform public.cmc_delete_course_safely(v_course, 3);
  exception when others then
    if sqlerrm not like '%CMC_COURSE_HAS_PROGRESS%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught
      or not exists(select 1 from public.cmc_course_lesson_progress where course_id=v_course)
      or not exists(select 1 from public.candidate_assignments where item_key='course:'||v_course::text)
      or (select save_revision from public.cmc_courses where id=v_course) <> 3 then
    raise exception 'course delete guard damaged participant data or assignments';
  end if;

  -- A never-enrolled, unused draft can be deleted, removing its assignments
  -- in the same committed transaction.
  v_response:=public.cmc_apply_course_patch(
    jsonb_build_object('save_version',2,'id',v_empty,'expected_revision',0,
      'course',jsonb_build_object('slug','disposable-draft','title','Disposable Draft','status','draft'),
      'modules_upsert','[]'::jsonb,'lessons_upsert','[]'::jsonb,
      'module_ids_to_delete','[]'::jsonb,'lesson_ids_to_delete','[]'::jsonb),v_actor);
  insert into public.candidate_assignments(
    user_id,item_key,candidate_email,candidate_name,item_type,stage_key,status,assignment_source
  ) values(
    v_user,'course:'||v_empty::text,'sample@example.test','Sample Member',
    'course','discover','assigned','leader'
  );
  -- Revision checks apply to deletion, just as they do to saves.
  v_caught:=false;
  begin
    perform public.cmc_delete_course_safely(v_empty, 0);
  exception when others then
    if sqlerrm not like '%CMC_COURSE_CONFLICT%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'stale delete did not detect conflict'; end if;
  perform public.cmc_delete_course_safely(v_empty,1);
  if exists(select 1 from public.cmc_courses where id=v_empty)
     or exists(select 1 from public.candidate_assignments where item_key='course:'||v_empty::text) then
    raise exception 'unused course deletion failed to remove assignments atomically';
  end if;

  if has_function_privilege('anon','public.cmc_delete_course_safely(uuid,bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.cmc_delete_course_safely(uuid,bigint)','EXECUTE')
     or not has_function_privilege('service_role','public.cmc_delete_course_safely(uuid,bigint)','EXECUTE') then
    raise exception 'safe delete RPC is not restricted to service_role';
  end if;

  if has_function_privilege('anon','public.cmc_apply_course_patch(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.cmc_apply_course_patch(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.cmc_apply_course_patch(jsonb,uuid)','EXECUTE') then
    raise exception 'RPC access not restricted to service_role';
  end if;

  raise notice 'PASS: atomic saves/deletes, revision conflict, progress protection, and access sync';
end;
$$;
