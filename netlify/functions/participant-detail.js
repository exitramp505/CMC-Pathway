const { createClient } = require('@supabase/supabase-js');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const participantId = String(event.queryStringParameters?.participant_id || '');
    if (!isUuid(participantId)) {
      return json(400, { ok:false, error:'A participant is required.' });
    }

    const token = String(event.headers.authorization || event.headers.Authorization || '')
      .replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json(401, { ok:false, error:'Invalid session.' });
    }

    const { data:viewer, error:viewerError } = await supabase
      .from('candidate_profiles')
      .select('id,full_name,email,region,account_role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (viewerError) throw viewerError;
    if (!viewer || !['regional_leader','cmc_admin'].includes(viewer.account_role)) {
      return json(403, { ok:false, error:'Regional leader access is required.' });
    }

    let participantQuery = supabase
      .from('candidate_profiles')
      .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,married,current_stage,stage_updated_at,account_role,created_at,updated_at,archived_at')
      .eq('id', participantId);

    if (viewer.account_role === 'regional_leader') {
      if (!viewer.region) {
        return json(403, { ok:false, error:'Your leader account does not have a region.' });
      }
      participantQuery = participantQuery.eq('region', viewer.region);
    }

    const { data:participantData, error:participantError } = await participantQuery.maybeSingle();
    if (participantError) throw participantError;
    const participant = visiblePathwayAccount(viewer, participantData) ? participantData : null;
    if (!participant) {
      return json(404, { ok:false, error:'Participant not found in your region.' });
    }

    const [
      assignmentResult,
      reportResult,
      applicationResult,
      courseResult,
      enrollmentResult,
      lessonResult,
      reflectionResult,
      eventInvitationResult
    ] = await Promise.all([
      supabase
        .from('candidate_assignments')
        .select('id,item_key,item_type,stage_key,status,progress,external_status,assignment_source,assigned_at,completed_at,updated_at')
        .eq('user_id', participantId)
        .order('assigned_at', { ascending:false }),
      supabase
        .from('assessment_results')
        .select('id,created_at,scores,overall,overall_label')
        .eq('user_id', participantId)
        .order('created_at', { ascending:false }),
      loadApplication(supabase, participantId),
      supabase
        .from('cmc_courses')
        .select('id,slug,title,subtitle,stage_key,status')
        .order('stage_key')
        .order('title'),
      supabase
        .from('cmc_course_enrollments')
        .select('course_id,progress,started_at,last_opened_at,completed_at')
        .eq('user_id', participantId),
      supabase
        .from('cmc_course_lessons')
        .select('id,course_id,title'),
      supabase
        .from('cmc_course_lesson_responses')
        .select('id,course_id,lesson_id,response_text,updated_at')
        .eq('user_id', participantId)
        .order('updated_at', { ascending:false }),
      supabase
        .from('cmc_event_invitations')
        .select('id,event_id,rsvp_status,attendance_status,invited_at,responded_at,notification_sent_at,updated_at,cmc_events(id,title,summary,description,starts_at,ends_at,location_name,address,rsvp_deadline,stage_key,region,status)')
        .eq('user_id', participantId)
        .order('invited_at', { ascending:false })
    ]);

    if (assignmentResult.error) throw assignmentResult.error;
    if (reportResult.error) throw reportResult.error;
    if (applicationResult.error) throw applicationResult.error;
    if (courseResult.error) throw courseResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;
    if (lessonResult.error) throw lessonResult.error;
    if (reflectionResult.error) throw reflectionResult.error;
    if (eventInvitationResult.error) throw eventInvitationResult.error;

    const courses = courseResult.data || [];
    const enrollments = enrollmentResult.data || [];
    const courseByAssignmentKey = new Map();
    for (const course of courses) {
      courseByAssignmentKey.set(`course_${course.slug}`, course);
      courseByAssignmentKey.set(`course:${course.id}`, course);
      if (course.slug === 'discover') {
        courseByAssignmentKey.set('discover_course', course);
      }
    }
    const enrollmentByCourse = new Map(
      enrollments.map(enrollment => [enrollment.course_id, enrollment])
    );

    const assignments = (assignmentResult.data || [])
      .filter(item => item.status === 'assigned' && item.item_type !== 'system')
      .map(item => {
        const course = courseByAssignmentKey.get(item.item_key);
        const enrollment = course ? enrollmentByCourse.get(course.id) : null;
        const progress = Math.max(
          Number(item.progress || 0),
          Number(enrollment?.progress || 0)
        );
        const completedAt = item.completed_at || enrollment?.completed_at || null;
        return {
          ...item,
          progress,
          completed_at:completedAt,
          completed:Boolean(completedAt || item.external_status === 'completed' || progress >= 100),
          course:course ? {
            id:course.id,
            slug:course.slug,
            title:course.title,
            subtitle:course.subtitle,
            stage_key:course.stage_key
          } : null,
          last_opened_at:enrollment?.last_opened_at || null
        };
      });

    const reports = (reportResult.data || []).map(report => ({
      id:report.id,
      created_at:report.created_at,
      assessment_type:report.scores?.assessmentType || 'character_qualities',
      title:report.scores?.assessmentTitle || assessmentTitle(report.scores?.assessmentType),
      overall:report.overall ?? report.scores?.overall ?? null,
      overall_label:report.overall_label || report.scores?.overallLabel || ''
    }));
    const courseById = new Map(courses.map(course => [course.id, course]));
    const lessonById = new Map((lessonResult.data || []).map(lesson => [lesson.id, lesson]));
    const reflections = (reflectionResult.data || []).map(reflection => ({
      ...reflection,
      course_title:courseById.get(reflection.course_id)?.title || 'CMC Course',
      lesson_title:lessonById.get(reflection.lesson_id)?.title || 'Course reflection'
    }));
    const eventInvitations = (eventInvitationResult.data || []).map(invitation => ({
      ...invitation,
      event:Array.isArray(invitation.cmc_events)
        ? invitation.cmc_events[0]
        : invitation.cmc_events,
      cmc_events:undefined
    })).filter(invitation => invitation.event);

    const application = applicationResult.data || null;
    const activity = buildActivity(participant, assignments, reports, application, reflections, eventInvitations);

    return json(200, {
      ok:true,
      viewer,
      participant,
      assignments,
      reports,
      reflections,
      events:eventInvitations,
      application,
      activity
    });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not load the participant dashboard.' });
  }
};

function assessmentTitle(type) {
  if (type === 'isa_readiness') return 'Ministry Readiness Inventory';
  if (type === 'ministry_style') return 'Ministry Style Inventory';
  return 'Character Qualities Assessment';
}

function buildActivity(participant, assignments, reports, application, reflections = [], events = []) {
  const activity = [];
  if (participant.created_at) {
    activity.push({
      type:'profile',
      title:'Joined CMC Pathway',
      detail:'Participant account created.',
      date:participant.created_at
    });
  }
  if (participant.stage_updated_at) {
    activity.push({
      type:'stage',
      title:`Moved to ${titleCase(participant.current_stage)}`,
      detail:'Current pathway stage updated.',
      date:participant.stage_updated_at
    });
  }
  for (const assignment of assignments) {
    if (assignment.completed_at || assignment.completed) {
      activity.push({
        type:'completion',
        title:`Completed ${assignment.course?.title || itemTitle(assignment.item_key)}`,
        detail:`${titleCase(assignment.stage_key)} work completed.`,
        date:assignment.completed_at || assignment.updated_at
      });
    } else if (assignment.last_opened_at) {
      activity.push({
        type:'progress',
        title:`Continued ${assignment.course?.title || itemTitle(assignment.item_key)}`,
        detail:`${Number(assignment.progress || 0)}% complete.`,
        date:assignment.last_opened_at
      });
    } else if (assignment.assigned_at) {
      activity.push({
        type:'assignment',
        title:`Assigned ${assignment.course?.title || itemTitle(assignment.item_key)}`,
        detail:`Added to the ${titleCase(assignment.stage_key)} stage.`,
        date:assignment.assigned_at
      });
    }
  }
  for (const report of reports) {
    activity.push({
      type:'report',
      title:`Completed ${report.title}`,
      detail:report.overall_label || 'Assessment report available.',
      date:report.created_at
    });
  }
  for (const reflection of reflections) {
    activity.push({
      type:'reflection',
      title:`Responded to ${reflection.lesson_title}`,
      detail:reflection.course_title,
      date:reflection.updated_at
    });
  }
  for (const invitation of events) {
    const title = invitation.event?.title || 'CMC event';
    if (invitation.attendance_status === 'attended') {
      activity.push({
        type:'event',
        title:`Attended ${title}`,
        detail:'Attendance recorded.',
        date:invitation.updated_at
      });
    } else if (invitation.responded_at) {
      activity.push({
        type:'event',
        title:`Responded to ${title}`,
        detail:invitation.rsvp_status === 'going' ? 'Planning to attend.' : 'Unable to attend.',
        date:invitation.responded_at
      });
    }
  }
  if (application?.submitted_at) {
    activity.push({
      type:'application',
      title:'Submitted Discernment Application',
      detail:'The submitted application is available for review.',
      date:application.submitted_at
    });
  } else if (application?.updated_at) {
    activity.push({
      type:'application',
      title:'Updated Discernment Application',
      detail:`${Number(application.completion || 0)}% complete.`,
      date:application.updated_at
    });
  }
  return activity
    .filter(item => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);
}

function itemTitle(key) {
  return {
    discover_course:'Discover: Church Multiplication 101',
    discernment_application:'Discernment Application',
    ministry_readiness:'Ministry Readiness Inventory',
    ministry_style:'Ministry Style Inventory',
    character_qualities:'Character Qualities Assessment',
    pastoral_reference:'Pastoral Reference Form'
  }[key] || titleCase(key);
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));
}

async function loadApplication(supabase, participantId) {
  const currentFields = 'id,status,completion,submitted_at,updated_at,photo_name,resume_name,reopened_at,reopened_by,reopen_reason';
  const legacyFields = 'id,status,completion,submitted_at,updated_at,photo_name,resume_name';
  const current = await supabase
    .from('candidate_applications')
    .select(currentFields)
    .eq('user_id', participantId)
    .maybeSingle();

  if (!current.error || !isMissingApplicationSecuritySchema(current.error)) {
    return current;
  }

  return supabase
    .from('candidate_applications')
    .select(legacyFields)
    .eq('user_id', participantId)
    .maybeSingle();
}

function isMissingApplicationSecuritySchema(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code)
    || /candidate_applications\.(reopened_at|reopened_by|reopen_reason).*does not exist/i.test(message)
    || /candidate_application_events.*(does not exist|schema cache)/i.test(message);
}

function visiblePathwayAccount(viewer, profile) {
  if (!profile) return false;
  if (viewer.account_role === 'regional_leader') {
    return ['participant','regional_leader'].includes(profile.account_role);
  }
  return profile.account_role !== 'cmc_admin' || profile.id === viewer.id;
}

exports._test = { isMissingApplicationSecuritySchema };
