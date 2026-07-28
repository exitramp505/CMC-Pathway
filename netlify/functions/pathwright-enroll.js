const { createClient } = require('@supabase/supabase-js');

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });

    const webhookUrl = process.env.PATHWRIGHT_ENROLL_WEBHOOK_URL;
    if (!webhookUrl) {
      return json(503, { ok:false, pending:true, error:'Pathwright enrollment is not configured yet.' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json(401, { ok:false, error:'Invalid session.' });
    }

    const user = userData.user;
    const [{ data:profile, error:profileError }, { data:assignment, error:assignmentError }] = await Promise.all([
      supabase
        .from('candidate_profiles')
        .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('candidate_assignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_key', 'discover_course')
        .maybeSingle()
    ]);

    if (profileError) throw profileError;
    if (assignmentError) throw assignmentError;
    if (!profile) return json(400, { ok:false, error:'Complete your profile before enrolling.' });
    if (!assignment) return json(409, { ok:false, error:'Discover has not been assigned yet.' });

    if (['sent','accepted','enrolled'].includes(assignment.invitation_status)) {
      return json(200, { ok:true, alreadyInvited:true, status:assignment.invitation_status });
    }

    const [firstName, ...lastParts] = String(profile.full_name || '').trim().split(/\s+/);
    const payload = {
      source: 'cmc_pathway',
      userId: user.id,
      firstName: firstName || '',
      lastName: lastParts.join(' '),
      fullName: profile.full_name || '',
      email: profile.email || user.email || '',
      phone: profile.phone || '',
      state: profile.state || '',
      region: profile.region || '',
      churchName: profile.church_name || '',
      ministryRole: profile.ministry_role || '',
      pathwayInterest: profile.pathway_interest || '',
      courseKey: 'discover_course'
    };

    const enrollmentUrl = new URL(webhookUrl);
    enrollmentUrl.search = new URLSearchParams({
      source: payload.source,
      user_id: payload.userId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      full_name: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      state: payload.state,
      region: payload.region,
      church_name: payload.churchName,
      ministry_role: payload.ministryRole,
      pathway_interest: payload.pathwayInterest,
      course_key: payload.courseKey
    }).toString();

    const response = await fetch(enrollmentUrl, { method: 'POST' });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = `Enrollment automation returned ${response.status}${detail ? `: ${detail.slice(0,200)}` : ''}`;
      await supabase
        .from('candidate_assignments')
        .update({ invitation_status:'failed', integration_error:error, updated_at:new Date().toISOString() })
        .eq('id', assignment.id);
      return json(502, { ok:false, error });
    }

    const now = new Date().toISOString();
    await supabase
      .from('candidate_assignments')
      .update({
        invitation_status:'sent',
        invitation_sent_at:now,
        integration_error:null,
        updated_at:now
      })
      .eq('id', assignment.id);

    return json(200, { ok:true, status:'sent' });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not enroll in Discover.' });
  }
};
