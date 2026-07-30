const { createClient } = require('@supabase/supabase-js');

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
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

    let profileQuery = supabase
      .from('candidate_profiles')
      .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,current_stage,account_role,created_at,updated_at,archived_at')
      .order('created_at', { ascending:false });

    if (viewer.account_role === 'regional_leader') {
      if (!viewer.region) return json(403, { ok:false, error:'Your leader account does not have a region.' });
      profileQuery = profileQuery
        .in('account_role', ['participant', 'regional_leader'])
        .eq('region', viewer.region);
    } else {
      profileQuery = profileQuery.in('account_role', ['participant', 'regional_leader', 'cmc_admin']);
    }

    const { data:profiles, error:profilesError } = await profileQuery;
    if (profilesError) throw profilesError;

    const visibleProfiles = (profiles || []).filter(profile =>
      profile.account_role !== 'cmc_admin' || profile.id === viewer.id
    );
    const userIds = visibleProfiles.map(profile => profile.id);
    if (!userIds.length) {
      return json(200, { ok:true, viewer, participants:[] });
    }

    const [assignmentResult, reportResult, eventInvitationResult] = await Promise.all([
      supabase
        .from('candidate_assignments')
        .select('user_id,item_key,item_type,stage_key,status,progress,external_status,assigned_at,completed_at,updated_at')
        .in('user_id', userIds),
      supabase
        .from('assessment_results')
        .select('user_id,created_at,scores')
        .in('user_id', userIds),
      supabase
        .from('cmc_event_invitations')
        .select('user_id,rsvp_status,attendance_status,invited_at,responded_at,cmc_events(id,title,starts_at,ends_at,status)')
        .in('user_id', userIds)
    ]);

    if (assignmentResult.error) throw assignmentResult.error;
    if (reportResult.error) throw reportResult.error;
    if (eventInvitationResult.error) throw eventInvitationResult.error;

    const assignmentsByUser = groupBy(assignmentResult.data || [], 'user_id');
    const reportsByUser = groupBy(reportResult.data || [], 'user_id');
    const eventsByUser = groupBy(
      (eventInvitationResult.data || []).map(invitation => ({
        ...invitation,
        event:Array.isArray(invitation.cmc_events)
          ? invitation.cmc_events[0]
          : invitation.cmc_events,
        cmc_events:undefined
      })).filter(invitation => invitation.event),
      'user_id'
    );

    const participants = visibleProfiles.map(profile => ({
      ...profile,
      assignments: assignmentsByUser.get(profile.id) || [],
      reports: reportsByUser.get(profile.id) || [],
      events: eventsByUser.get(profile.id) || []
    }));

    return json(200, { ok:true, viewer, participants });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not load regional participants.' });
  }
};

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  }
  return map;
}
