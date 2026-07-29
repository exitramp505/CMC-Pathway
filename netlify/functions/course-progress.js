const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body) {
  return { statusCode:status, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { ok:false, error:'Invalid session.' });
    const user = userData.user;
    const body = JSON.parse(event.body || '{}');
    const lessonId = String(body.lesson_id || '');
    const completed = body.completed !== false;
    const responseText = String(body.response_text || '').trim().slice(0, 5000);
    if (!lessonId) return json(400, { ok:false, error:'Lesson id is required.' });

    const { data:lesson, error:lessonError } = await supabase
      .from('cmc_course_lessons').select('id,course_id,response_required').eq('id', lessonId).maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return json(404, { ok:false, error:'Lesson not found.' });
    if (lesson.response_required && !responseText) {
      return json(400, { ok:false, error:'Please add your reflection before completing this lesson.' });
    }

    const [{ data:course, error:courseError }, { data:viewer, error:viewerError }] = await Promise.all([
      supabase.from('cmc_courses').select('id,slug,status,stage_key,access_mode').eq('id', lesson.course_id).single(),
      supabase.from('candidate_profiles').select('id,full_name,email,account_role').eq('id', user.id).maybeSingle()
    ]);
    if (courseError) throw courseError;
    if (viewerError) throw viewerError;
    const elevated = ['regional_leader','cmc_admin'].includes(viewer?.account_role);
    if (course.status !== 'published' && viewer?.account_role !== 'cmc_admin') {
      return json(403, { ok:false, error:'This course is not published.' });
    }
    if (!elevated && course.access_mode === 'assigned') {
      const { data:assignment, error:assignmentError } = await supabase
        .from('candidate_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_key', assignmentKey(course))
        .eq('status', 'assigned')
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return json(403, { ok:false, error:'This course has not been assigned to you.' });
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

    const now = new Date().toISOString();
    if (responseText) {
      const { error:responseError } = await supabase.from('cmc_course_lesson_responses').upsert({
        user_id:user.id,
        course_id:lesson.course_id,
        lesson_id:lesson.id,
        response_text:responseText,
        updated_at:now
      }, { onConflict:'user_id,lesson_id' });
      if (responseError) throw responseError;
    }
    const { error:upsertError } = await supabase.from('cmc_course_lesson_progress').upsert({
      user_id:user.id,
      course_id:lesson.course_id,
      lesson_id:lesson.id,
      completed,
      completed_at:completed ? now : null,
      updated_at:now
    }, { onConflict:'user_id,lesson_id' });
    if (upsertError) throw upsertError;

    const [
      { data:required, error:requiredError },
      { data:done, error:doneError },
      { data:visibleModules, error:moduleError }
    ] = await Promise.all([
      supabase.from('cmc_course_lessons').select('id,module_id').eq('course_id', lesson.course_id).eq('is_required', true).neq('title', ''),
      supabase.from('cmc_course_lesson_progress').select('lesson_id').eq('course_id', lesson.course_id).eq('user_id', user.id).eq('completed', true),
      supabase.from('cmc_course_modules').select('id').eq('course_id', lesson.course_id).neq('title', '')
    ]);
    if (requiredError) throw requiredError;
    if (doneError) throw doneError;
    if (moduleError) throw moduleError;

    const visibleModuleIds = new Set((visibleModules || []).map(item => item.id));
    const requiredIds = new Set((required || []).filter(item => visibleModuleIds.has(item.module_id)).map(item => item.id));
    const completedRequired = new Set((done || []).map(item => item.lesson_id).filter(id => requiredIds.has(id)));
    const progress = requiredIds.size ? Math.round((completedRequired.size / requiredIds.size) * 100) : 0;
    const courseComplete = requiredIds.size > 0 && completedRequired.size === requiredIds.size;

    const { error:enrollmentError } = await supabase.from('cmc_course_enrollments').upsert({
      user_id:user.id,
      course_id:lesson.course_id,
      progress,
      last_opened_at:now,
      completed_at:courseComplete ? now : null
    }, { onConflict:'user_id,course_id' });
    if (enrollmentError) throw enrollmentError;

    if (!elevated) {
      const { error:assignmentError } = await supabase.from('candidate_assignments').update({
        progress,
        external_status:courseComplete ? 'completed' : progress ? 'in_progress' : '',
        invitation_status:progress ? 'enrolled' : '',
        completed_at:courseComplete ? now : null,
        updated_at:now
      }).eq('user_id', user.id).eq('item_key', assignmentKey(course));
      if (assignmentError) throw assignmentError;
    }

    return json(200, { ok:true, progress, courseComplete });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not save course progress.' });
  }
};
