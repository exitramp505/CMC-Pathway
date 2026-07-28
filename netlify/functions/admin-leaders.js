const { createClient } = require('@supabase/supabase-js');

const REGIONS = ['Central', 'East', 'Mountain Plains', 'Pacific', 'Southeast'];

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
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
      .select('id,account_role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (viewerError) throw viewerError;
    if (viewer?.account_role !== 'cmc_admin') {
      return json(403, { ok:false, error:'National administrator access is required.' });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const profileId = String(body.profile_id || '');
      const accountRole = String(body.account_role || '');
      const region = String(body.region || '');

      if (!profileId) return json(400, { ok:false, error:'Choose an account.' });
      if (profileId === viewer.id) {
        return json(400, { ok:false, error:'You cannot change your own national administrator access here.' });
      }
      if (!['participant', 'regional_leader'].includes(accountRole)) {
        return json(400, { ok:false, error:'Choose a valid account role.' });
      }
      if (accountRole === 'regional_leader' && !REGIONS.includes(region)) {
        return json(400, { ok:false, error:'Choose a valid Open Bible region.' });
      }

      const update = {
        account_role: accountRole,
        updated_at: new Date().toISOString()
      };
      if (accountRole === 'regional_leader') update.region = region;

      const { data:profile, error:updateError } = await supabase
        .from('candidate_profiles')
        .update(update)
        .eq('id', profileId)
        .neq('account_role', 'cmc_admin')
        .select('id,full_name,email,region,account_role')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!profile) return json(404, { ok:false, error:'That account could not be updated.' });
      return json(200, { ok:true, profile });
    }

    const { data:profiles, error:profilesError } = await supabase
      .from('candidate_profiles')
      .select('id,full_name,email,region,account_role,created_at')
      .in('account_role', ['participant', 'regional_leader'])
      .order('full_name', { ascending:true });

    if (profilesError) throw profilesError;
    return json(200, { ok:true, profiles:profiles || [], regions:REGIONS });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not manage regional leaders.' });
  }
};
