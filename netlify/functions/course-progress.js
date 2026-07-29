const { createClient } = require('@supabase/supabase-js');

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
    if (!lessonId) return json(400, { ok:false, error:'Lesson id is required.' });

    const { data:lesson, error:lessonError } = await supabase
      .from('cmc_course_lessons').select('id,course_id').eq('id', lessonId).maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return json(404, { ok:false, error:'Lesson not found.' });

    const now = new Date().toISOString();
    const { error:upsertError } = await supabase.from('cmc_course_lesson_progress').upsert({
      user_id:user.id,
      course_id:lesson.course_id,
      lesson_id:lesson.id,
      completed,
      completed_at:completed ? now : null,
      updated_at:now
    }, { onConflict:'user_id,lesson_id' });
    if (upsertError) throw upsertError;

    const [{ data:required, error:requiredError }, { data:done, error:doneError }, { data:course, error:courseError }] = await Promise.all([
      supabase.from('cmc_course_lessons').select('id').eq('course_id', lesson.course_id).eq('is_required', true),
      supabase.from('cmc_course_lesson_progress').select('lesson_id').eq('course_id', lesson.course_id).eq('user_id', user.id).eq('completed', true),
      supabase.from('cmc_courses').select('slug').eq('id', lesson.course_id).single()
    ]);
    if (requiredError) throw requiredError;
    if (doneError) throw doneError;
    if (courseError) throw courseError;

    const requiredIds = new Set((required || []).map(item => item.id));
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

    if (course.slug === 'discover') {
      const { error:assignmentError } = await supabase.from('candidate_assignments').update({
        progress,
        external_status:courseComplete ? 'completed' : progress ? 'in_progress' : '',
        invitation_status:progress ? 'enrolled' : '',
        completed_at:courseComplete ? now : null,
        updated_at:now
      }).eq('user_id', user.id).eq('item_key', 'discover_course');
      if (assignmentError) throw assignmentError;
    }

    return json(200, { ok:true, progress, courseComplete });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not save course progress.' });
  }
};
