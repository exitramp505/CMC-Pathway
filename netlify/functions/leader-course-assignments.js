const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body) {
  return { statusCode:status, headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (!['GET','POST'].includes(event.httpMethod)) {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const { supabase, viewer } = await requireLeader(event);
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const participantId = String(body.participant_id || event.queryStringParameters?.participant_id || '');
    if (!isUuid(participantId)) return json(400, { ok:false, error:'A participant is required.' });

    const participant = await loadParticipant(supabase, viewer, participantId);
    if (!participant) return json(404, { ok:false, error:'Participant not found in your region.' });

    const { data:courses, error:courseError } = await supabase
      .from('cmc_courses')
      .select('id,slug,title,subtitle,description,stage_key,access_mode,estimated_minutes,status')
      .eq('status', 'published')
      .eq('access_mode', 'assigned')
      .order('stage_key')
      .order('title');
    if (courseError) throw courseError;

    if (event.httpMethod === 'POST') {
      const selectedIds = [...new Set(Array.isArray(body.course_ids) ? body.course_ids.map(String).filter(isUuid) : [])];
      const courseById = new Map((courses || []).map(course => [course.id, course]));
      if (selectedIds.some(id => !courseById.has(id))) {
        return json(400, { ok:false, error:'One or more selected courses are not available for leader assignment.' });
      }

      const selectedCourses = selectedIds.map(id => courseById.get(id));
      const desiredKeys = new Set(selectedCourses.map(assignmentKey));
      const assignableKeys = new Set((courses || []).map(assignmentKey));
      const { data:existingLeaderAssignments, error:existingError } = await supabase
        .from('candidate_assignments')
        .select('item_key')
        .eq('user_id', participant.id)
        .eq('assignment_source', 'leader')
        .eq('item_type', 'course');
      if (existingError) throw existingError;
      const currentKeys = new Set((existingLeaderAssignments || [])
        .map(item => item.item_key)
        .filter(key => assignableKeys.has(key)));
      const keysToDelete = [...currentKeys].filter(key => !desiredKeys.has(key));
      if (keysToDelete.length) {
        const { error:deleteError } = await supabase
          .from('candidate_assignments')
          .delete()
          .eq('user_id', participant.id)
          .eq('assignment_source', 'leader')
          .in('item_key', keysToDelete);
        if (deleteError) throw deleteError;
      }

      const coursesToInsert = selectedCourses.filter(course => !currentKeys.has(assignmentKey(course)));
      if (coursesToInsert.length) {
        const { data:enrollments, error:enrollmentError } = await supabase
          .from('cmc_course_enrollments')
          .select('course_id,progress,completed_at')
          .eq('user_id', participant.id)
          .in('course_id', coursesToInsert.map(course => course.id));
        if (enrollmentError) throw enrollmentError;
        const enrollmentByCourse = new Map((enrollments || []).map(item => [item.course_id, item]));
        const rows = coursesToInsert.map(course => {
          const enrollment = enrollmentByCourse.get(course.id);
          return {
            ...assignmentRecord(course, participant, 'leader'),
            progress:Number(enrollment?.progress || 0),
            external_status:enrollment?.completed_at ? 'completed' : enrollment?.progress ? 'in_progress' : '',
            completed_at:enrollment?.completed_at || null
          };
        });
        const { error:insertError } = await supabase
          .from('candidate_assignments')
          .insert(rows);
        if (insertError) throw insertError;
      }
    }

    const { data:assignments, error:assignmentError } = await supabase
      .from('candidate_assignments')
      .select('item_key,progress,external_status,completed_at,assignment_source')
      .eq('user_id', participant.id)
      .eq('status', 'assigned')
      .eq('item_type', 'course');
    if (assignmentError) throw assignmentError;

    const assignmentByKey = new Map((assignments || []).map(item => [item.item_key, item]));
    const responseCourses = (courses || []).map(course => {
      const assignment = assignmentByKey.get(assignmentKey(course));
      return {
        ...course,
        assigned:Boolean(assignment),
        progress:Number(assignment?.progress || 0),
        completed:Boolean(assignment?.completed_at || assignment?.external_status === 'completed')
      };
    });

    return json(200, { ok:true, viewer, participant, courses:responseCourses });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not manage course assignments.' });
  }
};

async function requireLeader(event) {
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Missing authorization token.');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data:userData, error:userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw httpError(401, 'Invalid session.');
  const { data:viewer, error } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!viewer || !['regional_leader','cmc_admin'].includes(viewer.account_role)) {
    throw httpError(403, 'Regional leader access is required.');
  }
  return { supabase, viewer };
}

async function loadParticipant(supabase, viewer, id) {
  let query = supabase
    .from('candidate_profiles')
    .select('id,full_name,email,state,region,church_name,account_role')
    .eq('id', id)
    .eq('account_role', 'participant');
  if (viewer.account_role === 'regional_leader') {
    if (!viewer.region) throw httpError(403, 'Your leader account does not have a region.');
    query = query.eq('region', viewer.region);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));
}
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
