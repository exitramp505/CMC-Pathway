const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');
const lessonContent = require('../../lesson-content');

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
        .select('id,slug,title,subtitle,description,status,stage_key,access_mode,navigation_mode,estimated_minutes,created_at,updated_at,published_at')
        .order('updated_at', { ascending:false });
      if (error) throw error;
      return json(200, { ok:true, courses:data || [] });
    }

    const body = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'DELETE') {
      const id = requireUuid(body.id, 'Course ID');
      const { data:course, error:lookupError } = await supabase
        .from('cmc_courses').select('id,save_revision').eq('id', id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!course) throw httpError(404, 'Course not found.');
      if (course.save_revision === undefined || course.save_revision === null) {
        throw httpError(503, 'Safe course deletion is not configured. A database update is required.');
      }
      const { error } = await supabase.rpc('cmc_delete_course_safely', {
        p_course_id:id,
        p_expected_revision:course.save_revision
      });
      if (error) {
        const message = String(error.message || '');
        if (message.includes('CMC_COURSE_HAS_PROGRESS')) {
          throw httpError(409, 'This course contains participant enrollments, progress, or responses and cannot be deleted. Unpublish it instead.');
        }
        if (message.includes('CMC_COURSE_CONFLICT')) {
          throw httpError(409, 'This course changed while deletion was being requested. Reload before trying again.');
        }
        if (message.includes('CMC_COURSE_NOT_FOUND')) {
          throw httpError(404, 'Course not found.');
        }
        if (error.code === 'PGRST202' || /could not find.*cmc_delete_course_safely|does not exist/i.test(message)) {
          throw httpError(503, 'Safe course deletion is not enabled in Supabase yet.');
        }
        throw error;
      }
      return json(200, { ok:true });
    }

    return await saveCoursePatch(supabase, viewer, body);
  } catch (error) {
    const status = error.statusCode || 500;
    return json(status, { ok:false, error:error.message || 'Could not manage courses.' });
  }
};


const COURSE_PATCH_KEYS = new Set([
  'title','subtitle','slug','description','stage_key','access_mode',
  'navigation_mode','estimated_minutes','status'
]);

function requireUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))) {
    throw httpError(400, label + ' is invalid.');
  }
  return String(value).toLowerCase();
}
function requireArray(value, label, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw httpError(400, label + ' is invalid or exceeds the size limit.');
  }
  return value;
}
function requirePosition(value) {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw httpError(400, 'Course item order is invalid.');
  }
  return value;
}
function uniqueIds(items, label) {
  if (new Set(items.map(item => typeof item === 'string' ? item : item.id)).size !== items.length) {
    throw httpError(400, 'Duplicate ' + label + ' IDs are not allowed.');
  }
}
function validateCoursePatch(body) {
  if (!body || body.save_version !== 2) {
    throw httpError(428, 'Course Builder has been upgraded. Refresh this page before saving.');
  }
  const id = requireUuid(body.id, 'Course ID');
  if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0) {
    throw httpError(400, 'Invalid course revision.');
  }
  const rawCourse = body.course;
  if (!rawCourse || typeof rawCourse !== 'object' || Array.isArray(rawCourse)) {
    throw httpError(400, 'Course changes are invalid.');
  }
  const course = {};
  for (const key of Object.keys(rawCourse)) {
    if (!COURSE_PATCH_KEYS.has(key)) throw httpError(400, 'Unsupported course field.');
    const value = rawCourse[key];
    switch (key) {
      case 'title': course[key] = clean(value, 160) || 'Untitled course'; break;
      case 'subtitle': course[key] = clean(value, 240); break;
      case 'description': course[key] = clean(value, 3000); break;
      case 'slug':
        course[key] = clean(value, 100).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || temporaryDraftSlug(id);
        break;
      case 'status':
        if (!['draft','published'].includes(value)) throw httpError(400, 'Invalid publishing status.');
        course[key] = value;
        break;
      case 'stage_key':
        if (!['discover','discern','develop','deploy'].includes(value)) throw httpError(400, 'Invalid pathway stage.');
        course[key] = value;
        break;
      case 'access_mode':
        if (!['automatic','assigned'].includes(value)) throw httpError(400, 'Invalid course availability.');
        course[key] = value;
        break;
      case 'navigation_mode':
        if (!['guided','open'].includes(value)) throw httpError(400, 'Invalid lesson navigation.');
        course[key] = value;
        break;
      case 'estimated_minutes': course[key] = numberInRange(value,0,100000); break;
    }
  }

  const modules_upsert = requireArray(body.modules_upsert, 'Modules', 300).map(module => ({
    id:requireUuid(module?.id, 'Module ID'),
    title:clean(module.title,160),
    description:clean(module.description,1000),
    position:requirePosition(module.position)
  }));
  const lessons_upsert = requireArray(body.lessons_upsert, 'Lessons', 2000).map(lesson => ({
    id:requireUuid(lesson?.id, 'Lesson ID'),
    module_id:requireUuid(lesson.module_id, 'Lesson module ID'),
    title:clean(lesson.title,160),
    summary:clean(lesson.summary,500),
    lesson_type:validChoice(lesson.lesson_type,['article','video','reflection','resource'],'article'),
    content:validateLessonContent(lesson.content),
    video_url:validVideoUrl(lesson.video_url),
    image_url:validContentUrl(lesson.image_url,true,'Lesson image'),
    image_alt:clean(lesson.image_alt,300),
    resource_url:validContentUrl(lesson.resource_url,false,'Resource'),
    resource_label:clean(lesson.resource_label,120),
    reflection_prompt:clean(lesson.reflection_prompt,2000),
    response_required:lesson.response_required === true,
    estimated_minutes:numberInRange(lesson.estimated_minutes,0,600),
    is_required:lesson.is_required !== false,
    position:requirePosition(lesson.position)
  }));
  const module_ids_to_delete = requireArray(body.module_ids_to_delete,'Removed modules',300)
    .map(id => requireUuid(id,'Removed module ID'));
  const lesson_ids_to_delete = requireArray(body.lesson_ids_to_delete,'Removed lessons',2000)
    .map(id => requireUuid(id,'Removed lesson ID'));
  uniqueIds(modules_upsert,'module');
  uniqueIds(lessons_upsert,'lesson');
  uniqueIds(module_ids_to_delete,'removed module');
  uniqueIds(lesson_ids_to_delete,'removed lesson');
  if (modules_upsert.some(module => module_ids_to_delete.includes(module.id))
      || lessons_upsert.some(lesson => lesson_ids_to_delete.includes(lesson.id))) {
    throw httpError(400, 'A course item cannot be saved and deleted in the same request.');
  }
  return {
    save_version:2, id, expected_revision:body.expected_revision,
    course, modules_upsert, lessons_upsert, module_ids_to_delete, lesson_ids_to_delete
  };
}

async function saveCoursePatch(supabase, viewer, body) {
  const patch = validateCoursePatch(body);
  const { data, error } = await supabase.rpc('cmc_apply_course_patch', {
    p_patch:patch,
    p_actor:viewer.id
  });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('CMC_COURSE_CONFLICT')) {
      throw httpError(409, 'Another administrator has saved changes to this course. Copy any unsaved edits, then reload the latest version.');
    }
    if (message.includes('CMC_LESSON_HAS_PROGRESS')) {
      throw httpError(409, 'This lesson already has participant progress or responses. It cannot be deleted.');
    }
    if (message.includes('CMC_COURSE_NOT_PUBLISHABLE')) {
      throw httpError(400, 'Add a title to every module and lesson before publishing.');
    }
    if (message.includes('CMC_INVALID_PATCH')) {
      throw httpError(400, 'Invalid course changes; please reload and try again.');
    }
    if (error.code === 'PGRST202' || /could not find.*cmc_apply_course_patch|does not exist/i.test(message)) {
      throw httpError(503, 'Safe course saving is not enabled in Supabase yet. Your edits remain in this browser; please contact the administrator.');
    }
    if (error.code === '23505') {
      throw httpError(409, 'This course URL or item ID is already in use.');
    }
    throw error;
  }
  if (!data || !data.id || !Number.isSafeInteger(Number(data.save_revision))) {
    throw httpError(503, 'Supabase returned an invalid save confirmation. Please contact an administrator.');
  }
  return json(200, { ok:true, course:data });
}

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

function validateLessonContent(value) {
  try {
    return lessonContent.validateContent(value);
  } catch (error) {
    throw httpError(400, error.message || 'Invalid lesson content.');
  }
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
      content:validateLessonContent(lesson.content),
      lesson_type:validChoice(lesson.lesson_type, ['article','video','reflection','resource'], 'article'),
      video_url:validVideoUrl(lesson.video_url),
      image_url:validContentUrl(lesson.image_url, true, 'Lesson image'),
      image_alt:clean(lesson.image_alt, 300),
      resource_url:validContentUrl(lesson.resource_url, false, 'Resource'),
      resource_label:clean(lesson.resource_label, 120),
      reflection_prompt:clean(lesson.reflection_prompt, 2000),
      response_required:lesson.response_required === true,
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
    navigation_mode:validChoice(body.navigation_mode, ['guided','open'], 'open'),
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
function validContentUrl(value, allowRelative, label) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (allowRelative && /^\/[A-Za-z0-9_./-]+$/.test(url)) return url.slice(0, 2000);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
    return url.slice(0, 2000);
  } catch (_) {
    throw httpError(400, `${label} links must be valid HTTPS addresses${allowRelative ? ' or local site paths' : ''}.`);
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
    .eq('account_role', 'participant')
    .is('archived_at', null);
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
