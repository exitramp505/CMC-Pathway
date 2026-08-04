const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord, isCourseAssignmentKey } = require('./_course-access');

function json(status, body, timing = '') {
  const headers = {
    'Content-Type':'application/json',
    'Cache-Control':'private, no-store'
  };
  if (timing) headers['Server-Timing'] = timing;
  return { statusCode:status, headers, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { ok:false, error:'Method not allowed' });

  const startedAt = Date.now();
  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '')
      .replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { ok:false, error:'Invalid session.' });

    const authenticatedAt = Date.now();
    const user = userData.user;
    const [
      profileResult,
      assignmentResult,
      courseResult,
      enrollmentResult,
      eventResult,
      reportResult
    ] = await Promise.all([
      supabase
        .from('candidate_profiles')
        .select('id,full_name,email,phone,state,region,married,account_role,church_name,ministry_role,pathway_interest,current_stage,archived_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('candidate_assignments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending:true }),
      supabase
        .from('cmc_courses')
        .select('id,slug,title,subtitle,description,stage_key,access_mode,estimated_minutes,status')
        .eq('status', 'published'),
      supabase
        .from('cmc_course_enrollments')
        .select('course_id,progress,completed_at,last_opened_at')
        .eq('user_id', user.id),
      supabase
        .from('cmc_event_invitations')
        .select('id,event_id,rsvp_status,attendance_status,invited_at,responded_at,cmc_events(id,title,summary,description,starts_at,ends_at,location_name,address,rsvp_deadline,stage_key,region,status)')
        .eq('user_id', user.id),
      supabase
        .from('assessment_results')
        .select('id,created_at,scores,overall,overall_label')
        .eq('user_id', user.id)
        .order('created_at', { ascending:false })
    ]);

    const failures = [profileResult, assignmentResult, courseResult, enrollmentResult, eventResult, reportResult]
      .map(result => result.error)
      .filter(Boolean);
    if (failures.length) throw failures[0];

    const profile = profileResult.data;
    if (!profile) {
      return json(200, { ok:true, profile:null, assignments:[], reports:[] }, serverTiming(startedAt, authenticatedAt));
    }

    const publishedCourses = courseResult.data || [];
    const automaticCourses = publishedCourses.filter(course => course.access_mode === 'automatic');
    const legacyDiscover = { id:'legacy-discover', slug:'discover', stage_key:'discover' };
    const automaticByKey = new Map();
    [legacyDiscover, ...automaticCourses].forEach(course => {
      automaticByKey.set(assignmentKey(course), assignmentRecord(course, {
        id:user.id,
        full_name:profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
        email:profile.email || user.email || ''
      }, 'automatic'));
    });

    let assignments = assignmentResult.data || [];
    if (!profile.archived_at) {
      const existingKeys = new Set(assignments.map(item => item.item_key));
      const missingRows = [...automaticByKey.entries()]
        .filter(([key]) => !existingKeys.has(key))
        .map(([, row]) => row);
      const keysToReactivate = assignments
        .filter(item => automaticByKey.has(item.item_key)
          && (item.assignment_source !== 'automatic' || item.status !== 'assigned' || item.hidden_at))
        .map(item => item.item_key);
      const writes = [];
      if (keysToReactivate.length) {
        writes.push(supabase
          .from('candidate_assignments')
          .update({ assignment_source:'automatic', status:'assigned', hidden_at:null })
          .eq('user_id', user.id)
          .in('item_key', keysToReactivate));
      }
      if (missingRows.length) {
        writes.push(supabase.from('candidate_assignments').insert(missingRows).select());
      }
      const writeResults = await Promise.all(writes);
      const writeFailure = writeResults.find(result => result.error);
      if (writeFailure) throw writeFailure.error;
      const insertResultIndex = keysToReactivate.length ? 1 : 0;
      const inserted = missingRows.length ? (writeResults[insertResultIndex]?.data || []) : [];
      assignments = [...assignments, ...inserted].map(item => automaticByKey.has(item.item_key)
        ? { ...item, assignment_source:'automatic', status:'assigned', hidden_at:null }
        : item);
    }

    const activeAssignments = assignments.filter(item => item.status === 'assigned');
    const courseByKey = new Map(publishedCourses.map(course => [assignmentKey(course), course]));
    const enrollmentByCourseId = new Map((enrollmentResult.data || []).map(item => [item.course_id, item]));
    const normalizedAssignments = activeAssignments.map(item => {
      const linkedCourse = isCourseAssignmentKey(item.item_key) ? (courseByKey.get(item.item_key) || null) : null;
      const enrollment = linkedCourse ? enrollmentByCourseId.get(linkedCourse.id) : null;
      const enrollmentProgress = Math.max(0, Math.min(100, Number(enrollment?.progress || 0)));
      const progress = Math.max(Number(item.progress || 0), enrollmentProgress);
      const complete = Boolean(enrollment?.completed_at) || progress >= 100 || item.external_status === 'completed';
      return {
        ...item,
        progress,
        external_status:complete ? 'completed' : item.external_status,
        completed_at:complete ? (enrollment?.completed_at || item.completed_at) : item.completed_at,
        updated_at:enrollment?.last_opened_at || item.updated_at,
        course:linkedCourse
      };
    }).filter(item => {
      if (!isCourseAssignmentKey(item.item_key)) return true;
      if (item.item_key === 'discover_course') return true;
      return Boolean(item.course);
    });

    const now = Date.now();
    const eventAssignments = (eventResult.data || []).map(invitation => {
      const linkedEvent = Array.isArray(invitation.cmc_events)
        ? invitation.cmc_events[0]
        : invitation.cmc_events;
      if (!linkedEvent) return null;
      const endsAt = new Date(linkedEvent.ends_at || linkedEvent.starts_at).getTime();
      if (linkedEvent.status !== 'published' || invitation.rsvp_status === 'declined' || endsAt < now) return null;
      return {
        id:invitation.id,
        user_id:user.id,
        item_key:`event:${linkedEvent.id}`,
        item_type:'event',
        stage_key:linkedEvent.stage_key || 'discern',
        status:'assigned',
        progress:invitation.rsvp_status === 'going' ? 100 : 0,
        external_status:invitation.rsvp_status === 'going' ? 'completed' : '',
        assignment_source:'leader',
        assigned_at:invitation.invited_at,
        completed_at:invitation.responded_at,
        rsvp_status:invitation.rsvp_status,
        attendance_status:invitation.attendance_status,
        event:linkedEvent
      };
    }).filter(Boolean);

    return json(200, {
      ok:true,
      profile,
      assignments:[...normalizedAssignments, ...eventAssignments],
      reports:reportResult.data || []
    }, serverTiming(startedAt, authenticatedAt));
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not load the participant dashboard.' });
  }
};

function serverTiming(startedAt, authenticatedAt) {
  const completedAt = Date.now();
  return `auth;dur=${authenticatedAt - startedAt}, dashboard;dur=${completedAt - authenticatedAt}, total;dur=${completedAt - startedAt}`;
}
