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
      .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,married,created_at,updated_at')
      .eq('id', participantId)
      .eq('account_role', 'participant');

    if (viewer.account_role === 'regional_leader') {
      if (!viewer.region) {
        return json(403, { ok:false, error:'Your leader account does not have a region.' });
      }
      participantQuery = participantQuery.eq('region', viewer.region);
    }

    const { data:participant, error:participantError } = await participantQuery.maybeSingle();
    if (participantError) throw participantError;
    if (!participant) {
      return json(404, { ok:false, error:'Participant not found in your region.' });
    }

    const [
      assignmentResult,
      reportResult,
      applicationResult,
      courseResult,
      enrollmentResult
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
      supabase
        .from('candidate_applications')
        .select('id,status,completion,submitted_at,updated_at,photo_name,resume_name')
        .eq('user_id', participantId)
        .maybeSingle(),
      supabase
        .from('cmc_courses')
        .select('id,slug,title,subtitle,stage_key,status')
        .order('stage_key')
        .order('title'),
      supabase
        .from('cmc_course_enrollments')
        .select('course_id,progress,started_at,last_opened_at,completed_at')
        .eq('user_id', participantId)
    ]);

    if (assignmentResult.error) throw assignmentResult.error;
    if (reportResult.error) throw reportResult.error;
    if (applicationResult.error) throw applicationResult.error;
    if (courseResult.error) throw courseResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;

    const courses = courseResult.data || [];
    const enrollments = enrollmentResult.data || [];
    const courseByAssignmentKey = new Map(
      courses.map(course => [`course_${course.slug}`, course])
    );
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

    return json(200, {
      ok:true,
      viewer,
      participant,
      assignments,
      reports,
      application:applicationResult.data || null
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));
}
