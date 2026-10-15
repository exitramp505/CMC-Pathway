const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body, timing = '') {
  const headers = {'Content-Type':'application/json','Cache-Control':'private, no-store'};
  if (timing) headers['Server-Timing'] = timing;
  return { statusCode:status, headers, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { ok:false, error:'Method not allowed.' });
  const startedAt = Date.now();
  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { ok:false, error:'Invalid session.' });
    const authedAt = Date.now();
    const user = userData.user;
    const slug = String(event.queryStringParameters?.slug || 'discover');

    // The profile and course are independent reads. Enforce draft visibility
    // only after both have returned; do not expose content before authorizing.
    const [viewerResult, courseResult] = await Promise.all([
      supabase.from('candidate_profiles')
        .select('id,full_name,email,account_role').eq('id', user.id).maybeSingle(),
      supabase.from('cmc_courses').select('*').eq('slug', slug).maybeSingle()
    ]);
    if (viewerResult.error) throw viewerResult.error;
    if (courseResult.error) throw courseResult.error;
    const viewer = viewerResult.data;
    const course = courseResult.data;
    if (!course || (course.status !== 'published' && viewer?.account_role !== 'cmc_admin')) {
      return json(404, { ok:false, error:'This course is not available yet.' });
    }

    const elevated = ['regional_leader','cmc_admin'].includes(viewer?.account_role);
    if (!elevated && course.access_mode === 'assigned') {
      const { data:assignment, error:assignmentError } = await supabase
        .from('candidate_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_key', assignmentKey(course))
        .eq('status', 'assigned')
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return json(403, { ok:false, error:'A regional leader must assign this course before it is available.' });
    }

    // Auto-assignment is usually already active. Avoid rewriting unchanged
    // assignment rows on every open, and never convert leader assignments.
    let autoAssignmentTask = Promise.resolve({ error:null });
    if (!elevated && course.access_mode === 'automatic' && viewer) {
      autoAssignmentTask = (async () => {
        const { data:existing, error:lookupError } = await supabase
          .from('candidate_assignments')
          .select('id,status,assignment_source,hidden_at')
          .eq('user_id', user.id)
          .eq('item_key', assignmentKey(course))
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) {
          return supabase.from('candidate_assignments')
            .upsert(assignmentRecord(course, viewer, 'automatic'), {
              onConflict:'user_id,item_key',
              ignoreDuplicates:true
            });
        }
        if (existing.status !== 'assigned' || existing.hidden_at) {
          return supabase.from('candidate_assignments')
            .update({ status:'assigned', hidden_at:null })
            .eq('id', existing.id);
        }
        return { error:null };
      })();
    }

    const contentStartedAt = Date.now();
    const [
      { data:modules, error:moduleError },
      { data:lessons, error:lessonError },
      { data:progress, error:progressError },
      { data:responses, error:responseError },
      { error:enrollmentError },
      { error:assignmentError }
    ] = await Promise.all([
      supabase.from('cmc_course_modules').select('*').eq('course_id', course.id).order('position'),
      supabase.from('cmc_course_lessons').select('*').eq('course_id', course.id).order('position'),
      supabase.from('cmc_course_lesson_progress')
        .select('lesson_id,completed,completed_at').eq('course_id', course.id).eq('user_id', user.id),
      supabase.from('cmc_course_lesson_responses')
        .select('lesson_id,response_text,updated_at').eq('course_id', course.id).eq('user_id', user.id),
      // Saving a "last opened" timestamp must not add a serial round trip.
      supabase.from('cmc_course_enrollments').upsert({
        user_id:user.id, course_id:course.id, last_opened_at:new Date().toISOString()
      }, { onConflict:'user_id,course_id', ignoreDuplicates:false }),
      autoAssignmentTask
    ]);
    if (moduleError) throw moduleError;
    if (lessonError) throw lessonError;
    if (progressError) throw progressError;
    if (responseError) throw responseError;
    if (enrollmentError) throw enrollmentError;
    if (assignmentError) throw assignmentError;

    const progressMap = new Map((progress || []).map(item => [item.lesson_id, item]));
    const responseMap = new Map((responses || []).map(item => [item.lesson_id, item]));
    const canEdit = viewer?.account_role === 'cmc_admin';
    const visibleModules = canEdit
      ? (modules || [])
      : (modules || []).filter(module => String(module.title || '').trim());
    const visibleLessons = canEdit
      ? (lessons || [])
      : (lessons || []).filter(lesson => String(lesson.title || '').trim());
    const responseCourse = {
      ...course,
      modules:visibleModules.map(module => ({
        ...module,
        lessons:visibleLessons.filter(lesson => lesson.module_id === module.id).map(lesson => ({
          ...lesson,
          completed:Boolean(progressMap.get(lesson.id)?.completed),
          completed_at:progressMap.get(lesson.id)?.completed_at || null,
          response_text:responseMap.get(lesson.id)?.response_text || '',
          response_updated_at:responseMap.get(lesson.id)?.updated_at || null
        }))
      }))
    };
    const completedAt = Date.now();
    return json(200, { ok:true, course:responseCourse, canEdit },
      `auth;dur=${authedAt-startedAt}, access;dur=${contentStartedAt-authedAt}, data;dur=${completedAt-contentStartedAt}, total;dur=${completedAt-startedAt}`);
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not load the course.' });
  }
};
