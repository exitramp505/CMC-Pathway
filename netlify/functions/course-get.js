const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body) {
  return { statusCode:status, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { ok:false, error:'Invalid session.' });
    const user = userData.user;
    const slug = String(event.queryStringParameters?.slug || 'discover');

    const { data:viewer, error:viewerError } = await supabase
      .from('candidate_profiles').select('id,full_name,email,account_role').eq('id', user.id).maybeSingle();
    if (viewerError) throw viewerError;

    let query = supabase.from('cmc_courses').select('*').eq('slug', slug);
    if (viewer?.account_role !== 'cmc_admin') query = query.eq('status', 'published');
    const { data:course, error:courseError } = await query.maybeSingle();
    if (courseError) throw courseError;
    if (!course) return json(404, { ok:false, error:'This course is not available yet.' });

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

    if (!elevated && course.access_mode === 'automatic' && viewer) {
      const { data:existingAssignment, error:existingError } = await supabase
        .from('candidate_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_key', assignmentKey(course))
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existingAssignment) {
        const { error:assignmentError } = await supabase
          .from('candidate_assignments')
          .insert(assignmentRecord(course, viewer, 'automatic'));
        if (assignmentError) throw assignmentError;
      } else {
        const { error:sourceError } = await supabase
          .from('candidate_assignments')
          .update({ assignment_source:'automatic', status:'assigned', hidden_at:null })
          .eq('id', existingAssignment.id);
        if (sourceError) throw sourceError;
      }
    }

    const [{ data:modules, error:moduleError }, { data:lessons, error:lessonError }, { data:progress, error:progressError }] = await Promise.all([
      supabase.from('cmc_course_modules').select('*').eq('course_id', course.id).order('position'),
      supabase.from('cmc_course_lessons').select('*').eq('course_id', course.id).order('position'),
      supabase.from('cmc_course_lesson_progress').select('lesson_id,completed,completed_at').eq('course_id', course.id).eq('user_id', user.id)
    ]);
    if (moduleError) throw moduleError;
    if (lessonError) throw lessonError;
    if (progressError) throw progressError;

    const now = new Date().toISOString();
    const { error:enrollmentError } = await supabase.from('cmc_course_enrollments').upsert({
      user_id:user.id, course_id:course.id, last_opened_at:now
    }, { onConflict:'user_id,course_id', ignoreDuplicates:false });
    if (enrollmentError) throw enrollmentError;

    const progressMap = new Map((progress || []).map(item => [item.lesson_id, item]));
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
          completed_at:progressMap.get(lesson.id)?.completed_at || null
        }))
      }))
    };
    return json(200, { ok:true, course:responseCourse, canEdit });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not load the course.' });
  }
};
