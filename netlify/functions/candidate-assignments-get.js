const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, isCourseAssignmentKey } = require('./_course-access');

function json(status, body){ return { statusCode: status, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }; }

exports.handler = async (event) => {
  if(event.httpMethod !== 'GET') return json(405,{ok:false,error:'Method not allowed'});
  try{
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i,'');
    if(!token) return json(401,{ok:false,error:'Missing authorization token.'});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if(userError || !userData?.user) return json(401,{ok:false,error:'Invalid session.'});

    const { data, error } = await supabase
      .from('candidate_assignments')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status','assigned')
      .order('created_at',{ascending:true});

    if(error) throw error;

    const { data:courses, error:courseError } = await supabase
      .from('cmc_courses')
      .select('id,slug,title,subtitle,description,stage_key,access_mode,estimated_minutes,status')
      .eq('status', 'published');
    if (courseError) throw courseError;

    const { data:enrollments, error:enrollmentError } = await supabase
      .from('cmc_course_enrollments')
      .select('course_id,progress,completed_at,last_opened_at')
      .eq('user_id', userData.user.id);
    if (enrollmentError) throw enrollmentError;

    const courseByKey = new Map((courses || []).map(course => [assignmentKey(course), course]));
    const enrollmentByCourseId = new Map((enrollments || []).map(item => [item.course_id, item]));
    const assignments = (data || []).map(item => {
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

    const { data:eventInvitations, error:eventError } = await supabase
      .from('cmc_event_invitations')
      .select('id,event_id,rsvp_status,attendance_status,invited_at,responded_at,cmc_events(id,title,summary,description,starts_at,ends_at,location_name,address,rsvp_deadline,stage_key,region,status)')
      .eq('user_id', userData.user.id);
    if (eventError) throw eventError;
    const now = Date.now();
    const activeEventAssignments = (eventInvitations || []).map(invitation => {
      const linkedEvent = Array.isArray(invitation.cmc_events)
        ? invitation.cmc_events[0]
        : invitation.cmc_events;
      if (!linkedEvent) return null;
      const endsAt = new Date(linkedEvent.ends_at || linkedEvent.starts_at).getTime();
      if (linkedEvent.status !== 'published' || invitation.rsvp_status === 'declined' || endsAt < now) {
        return null;
      }
      return {
        id:invitation.id,
        user_id:userData.user.id,
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

    return json(200,{ok:true,assignments:[...assignments, ...activeEventAssignments]});
  }catch(err){
    return json(500,{ok:false,error:err.message||'Could not load assignments.'});
  }
};
