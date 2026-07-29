const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body) {
  return { statusCode:status, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (!['GET','POST','DELETE'].includes(event.httpMethod)) {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const { supabase, viewer } = await requireAdmin(event);

    if (event.httpMethod === 'GET') {
      const id = String(event.queryStringParameters?.id || '');
      if (id) {
        const course = await loadCourse(supabase, id);
        return course ? json(200, { ok:true, course }) : json(404, { ok:false, error:'Course not found.' });
      }
      const { data, error } = await supabase
        .from('cmc_courses')
        .select('id,slug,title,subtitle,description,status,stage_key,access_mode,estimated_minutes,created_at,updated_at,published_at')
        .order('updated_at', { ascending:false });
      if (error) throw error;
      return json(200, { ok:true, courses:data || [] });
    }

    const body = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'DELETE') {
      const id = String(body.id || '');
      if (!id) return json(400, { ok:false, error:'Course id is required.' });
      const course = await loadCourse(supabase, id);
      if (course) {
        const { error:assignmentError } = await supabase
          .from('candidate_assignments')
          .delete()
          .eq('item_key', assignmentKey(course));
        if (assignmentError) throw assignmentError;
      }
      const { error } = await supabase.from('cmc_courses').delete().eq('id', id);
      if (error) throw error;
      return json(200, { ok:true });
    }

    const payload = validateCourse(body);
    const now = new Date().toISOString();
    const courseRecord = {
      slug:payload.slug,
      title:payload.title,
      subtitle:payload.subtitle,
      description:payload.description,
      status:payload.status,
      stage_key:payload.stage_key,
      access_mode:payload.access_mode,
      estimated_minutes:payload.estimated_minutes,
      updated_at:now,
      published_at:payload.status === 'published' ? (payload.published_at || now) : null
    };

    let courseId = payload.id;
    const previousCourse = courseId ? await loadCourse(supabase, courseId) : null;
    if (courseId) {
      const { error } = await supabase.from('cmc_courses').update(courseRecord).eq('id', courseId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('cmc_courses')
        .insert({ ...courseRecord, created_by:viewer.id })
        .select('id')
        .single();
      if (error) throw error;
      courseId = data.id;
    }

    const existing = previousCourse || await loadCourse(supabase, courseId);
    const incomingModuleIds = new Set(payload.modules.map(item => item.id).filter(Boolean));
    const incomingLessonIds = new Set(payload.modules.flatMap(module => module.lessons.map(item => item.id)).filter(Boolean));
    const existingModules = existing?.modules || [];
    const existingLessons = existingModules.flatMap(module => module.lessons || []);

    const lessonIdsToDelete = existingLessons.map(item => item.id).filter(id => !incomingLessonIds.has(id));
    if (lessonIdsToDelete.length) {
      const { error } = await supabase.from('cmc_course_lessons').delete().in('id', lessonIdsToDelete);
      if (error) throw error;
    }

    for (let moduleIndex = 0; moduleIndex < payload.modules.length; moduleIndex += 1) {
      const module = payload.modules[moduleIndex];
      const moduleRecord = {
        course_id:courseId,
        title:module.title,
        description:module.description,
        position:moduleIndex,
        updated_at:now
      };
      let moduleId = module.id;
      if (moduleId) {
        const { error } = await supabase.from('cmc_course_modules').update(moduleRecord).eq('id', moduleId).eq('course_id', courseId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('cmc_course_modules').insert(moduleRecord).select('id').single();
        if (error) throw error;
        moduleId = data.id;
      }

      for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
        const lesson = module.lessons[lessonIndex];
        const lessonRecord = {
          course_id:courseId,
          module_id:moduleId,
          title:lesson.title,
          summary:lesson.summary,
          content:lesson.content,
          video_url:lesson.video_url,
          reflection_prompt:lesson.reflection_prompt,
          estimated_minutes:lesson.estimated_minutes,
          is_required:lesson.is_required,
          position:lessonIndex,
          updated_at:now
        };
        if (lesson.id) {
          const { error } = await supabase.from('cmc_course_lessons').update(lessonRecord).eq('id', lesson.id).eq('course_id', courseId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('cmc_course_lessons').insert(lessonRecord);
          if (error) throw error;
        }
      }
    }

    const moduleIdsToDelete = existingModules.map(item => item.id).filter(id => !incomingModuleIds.has(id));
    if (moduleIdsToDelete.length) {
      const { error } = await supabase.from('cmc_course_modules').delete().in('id', moduleIdsToDelete);
      if (error) throw error;
    }

    const saved = await loadCourse(supabase, courseId);
    if (courseAccessChanged(saved, previousCourse)) {
      await syncCourseAccess(supabase, saved, previousCourse);
    }
    return json(200, { ok:true, course:saved });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(status, { ok:false, error:error.message || 'Could not manage courses.' });
  }
};

async function requireAdmin(event) {
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Missing authorization token.');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data:userData, error:userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw httpError(401, 'Invalid session.');
  const { data:viewer, error } = await supabase
    .from('candidate_profiles').select('id,account_role').eq('id', userData.user.id).maybeSingle();
  if (error) throw error;
  if (viewer?.account_role !== 'cmc_admin') throw httpError(403, 'National administrator access is required.');
  return { supabase, viewer };
}

async function loadCourse(supabase, id) {
  const { data:course, error } = await supabase.from('cmc_courses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!course) return null;
  const [{ data:modules, error:moduleError }, { data:lessons, error:lessonError }] = await Promise.all([
    supabase.from('cmc_course_modules').select('*').eq('course_id', id).order('position'),
    supabase.from('cmc_course_lessons').select('*').eq('course_id', id).order('position')
  ]);
  if (moduleError) throw moduleError;
  if (lessonError) throw lessonError;
  return {
    ...course,
    modules:(modules || []).map(module => ({
      ...module,
      lessons:(lessons || []).filter(lesson => lesson.module_id === module.id)
    }))
  };
}

function validateCourse(body) {
  const status = body.status === 'published' ? 'published' : 'draft';
  const allowIncomplete = status === 'draft' || body.autosave === true;
  const title = clean(body.title, 160) || (allowIncomplete ? 'Untitled course' : '');
  const requestedSlug = clean(body.slug, 100).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const slug = requestedSlug || (allowIncomplete ? temporaryDraftSlug(body.id) : '');
  if (!title) throw httpError(400, 'Course title is required.');
  if (!slug) throw httpError(400, 'Course URL name is required.');
  const modules = Array.isArray(body.modules) ? body.modules.map(module => ({
    id:uuidOrBlank(module.id),
    title:clean(module.title, 160),
    description:clean(module.description, 1000),
    lessons:Array.isArray(module.lessons) ? module.lessons.map(lesson => ({
      id:uuidOrBlank(lesson.id),
      title:clean(lesson.title, 160),
      summary:clean(lesson.summary, 500),
      content:String(lesson.content || '').trim().slice(0, 50000),
      video_url:validVideoUrl(lesson.video_url),
      reflection_prompt:clean(lesson.reflection_prompt, 2000),
      estimated_minutes:numberInRange(lesson.estimated_minutes, 0, 600),
      is_required:lesson.is_required !== false
    })) : []
  })) : [];
  if (!allowIncomplete && modules.some(module => !module.title)) throw httpError(400, 'Every module needs a title.');
  if (!allowIncomplete && modules.some(module => module.lessons.some(lesson => !lesson.title))) {
    throw httpError(400, 'Every lesson needs a title.');
  }
  if (status === 'published' && !modules.some(module => module.lessons.length)) {
    throw httpError(400, 'Add at least one lesson before publishing.');
  }
  return {
    id:uuidOrBlank(body.id),
    slug,
    title,
    subtitle:clean(body.subtitle, 240),
    description:clean(body.description, 3000),
    status,
    stage_key:validChoice(body.stage_key, ['discover','discern','develop','deploy'], 'discover'),
    access_mode:validChoice(body.access_mode, ['automatic','assigned'], 'assigned'),
    published_at:body.published_at || null,
    estimated_minutes:numberInRange(body.estimated_minutes, 0, 100000),
    modules
  };
}

function validVideoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
    return url.slice(0, 2000);
  } catch (_) {
    throw httpError(400, 'Video links must be valid HTTPS addresses.');
  }
}
function clean(value, length) { return String(value || '').trim().slice(0, length); }
function numberInRange(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function uuidOrBlank(value) { return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || '')) ? String(value) : ''; }
function validChoice(value, choices, fallback) { return choices.includes(String(value || '')) ? String(value) : fallback; }
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function temporaryDraftSlug(id) {
  const existingId = uuidOrBlank(id);
  if (existingId) return `draft-${existingId.slice(0, 12)}`;
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function courseAccessChanged(course, previousCourse) {
  if (!previousCourse) return true;
  return (
    course.status !== previousCourse.status ||
    course.slug !== previousCourse.slug ||
    course.stage_key !== previousCourse.stage_key ||
    course.access_mode !== previousCourse.access_mode
  );
}

async function syncCourseAccess(supabase, course, previousCourse) {
  const key = assignmentKey(course);
  const previousKey = previousCourse ? assignmentKey(previousCourse) : key;

  if (previousKey !== key) {
    const { error } = await supabase
      .from('candidate_assignments')
      .update({ item_key:key, stage_key:course.stage_key, updated_at:new Date().toISOString() })
      .eq('item_key', previousKey);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('candidate_assignments')
      .update({ stage_key:course.stage_key, updated_at:new Date().toISOString() })
      .eq('item_key', key);
    if (error) throw error;
  }

  if (course.status !== 'published' || course.access_mode !== 'automatic') {
    const { error } = await supabase
      .from('candidate_assignments')
      .delete()
      .eq('item_key', key)
      .eq('assignment_source', 'automatic');
    if (error) throw error;
    return;
  }

  const { data:participants, error:participantsError } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email')
    .eq('account_role', 'participant');
  if (participantsError) throw participantsError;
  if (!participants?.length) return;

  const { data:existingAssignments, error:existingError } = await supabase
    .from('candidate_assignments')
    .select('user_id')
    .eq('item_key', key);
  if (existingError) throw existingError;
  if (existingAssignments?.length) {
    const { error:sourceError } = await supabase
      .from('candidate_assignments')
      .update({ assignment_source:'automatic', status:'assigned', hidden_at:null })
      .eq('item_key', key);
    if (sourceError) throw sourceError;
  }
  const existingUserIds = new Set((existingAssignments || []).map(item => item.user_id));
  const rows = participants
    .filter(profile => !existingUserIds.has(profile.id))
    .map(profile => assignmentRecord(course, profile, 'automatic'));
  if (!rows.length) return;
  const { error:assignmentError } = await supabase
    .from('candidate_assignments')
    .insert(rows);
  if (assignmentError) throw assignmentError;
}
