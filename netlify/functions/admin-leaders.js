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
      .select('id,full_name,email,region,account_role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (viewerError) throw viewerError;
    if (!viewer || !['regional_leader', 'cmc_admin'].includes(viewer.account_role)) {
      return json(403, { ok:false, error:'Regional leader access is required.' });
    }
    if (viewer.account_role === 'regional_leader' && !REGIONS.includes(viewer.region)) {
      return json(403, { ok:false, error:'Your leader account does not have a valid Open Bible region.' });
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
      const requestedRegion = viewer.account_role === 'regional_leader' ? viewer.region : region;
      if (accountRole === 'regional_leader' && !REGIONS.includes(requestedRegion)) {
        return json(400, { ok:false, error:'Choose a valid Open Bible region.' });
      }

      const { data:target, error:targetError } = await supabase
        .from('candidate_profiles')
        .select('id,region,account_role,archived_at')
        .eq('id', profileId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.account_role === 'cmc_admin') {
        return json(404, { ok:false, error:'That account could not be updated.' });
      }
      if (target.archived_at) {
        return json(400, { ok:false, error:'Restore this person before changing leader access.' });
      }
      if (viewer.account_role === 'regional_leader' && target.region !== viewer.region) {
        return json(403, { ok:false, error:'You can only manage leaders in your own region.' });
      }

      const update = {
        account_role: accountRole,
        updated_at: new Date().toISOString()
      };
      if (accountRole === 'regional_leader') update.region = requestedRegion;

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

    let profileQuery = supabase
      .from('candidate_profiles')
      .select('id,full_name,email,region,account_role,created_at,archived_at')
      .in('account_role', ['participant', 'regional_leader'])
      .is('archived_at', null)
      .order('full_name', { ascending:true });
    if (viewer.account_role === 'regional_leader') {
      profileQuery = profileQuery.eq('region', viewer.region);
    }

    const { data:profiles, error:profilesError } = await profileQuery;
    if (profilesError) throw profilesError;
    return json(200, {
      ok:true,
      viewer,
      profiles:profiles || [],
      regions:viewer.account_role === 'regional_leader' ? [viewer.region] : REGIONS
    });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not manage regional leaders.' });
  }
};
