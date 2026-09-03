const { createClient } = require('@supabase/supabase-js');

const REGIONS = ['Central', 'East', 'Mountain Plains', 'Pacific', 'Southeast'];
const ACCOUNT_ROLES = ['participant', 'regional_leader', 'cmc_admin'];

function accessError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveRoleChange({ viewer, target, accountRole, region }) {
  if (!ACCOUNT_ROLES.includes(accountRole)) throw accessError(400, 'Choose a valid access level.');
  if (!target) throw accessError(404, 'That account could not be updated.');
  if (target.id === viewer.id) throw accessError(400, 'You cannot change your own administrator access here.');
  if (target.archived_at) throw accessError(400, 'Restore this person before changing leadership access.');

  if (viewer.account_role === 'regional_leader') {
    if (target.account_role === 'cmc_admin' || accountRole === 'cmc_admin') {
      throw accessError(403, 'Only a full administrator can manage full administrator access.');
    }
    if (target.region !== viewer.region) {
      throw accessError(403, 'You can only manage leaders in your own region.');
    }
  }

  const requestedRegion = viewer.account_role === 'regional_leader' ? viewer.region : region;
  if (accountRole === 'regional_leader' && !REGIONS.includes(requestedRegion)) {
    throw accessError(400, 'Choose a valid Open Bible region.');
  }

  const update = { account_role: accountRole, updated_at: new Date().toISOString() };
  if (accountRole === 'regional_leader') update.region = requestedRegion;
  return update;
}

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
      const { data:target, error:targetError } = await supabase
        .from('candidate_profiles')
        .select('id,region,account_role,archived_at')
        .eq('id', profileId)
        .maybeSingle();
      if (targetError) throw targetError;
      const update = resolveRoleChange({ viewer, target, accountRole, region });

      const updateQuery = supabase
        .from('candidate_profiles')
        .update(update)
        .eq('id', profileId)
        .eq('account_role', target.account_role);
      const { data:profile, error:updateError } = await updateQuery
        .select('id,full_name,email,region,account_role,created_at,archived_at')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!profile) return json(409, { ok:false, error:'This account changed while you were editing it. Refresh and try again.' });
      return json(200, { ok:true, profile });
    }

    let profileQuery = supabase
      .from('candidate_profiles')
      .select('id,full_name,email,region,account_role,created_at,archived_at')
      .in('account_role', viewer.account_role === 'cmc_admin'
        ? ['participant', 'regional_leader', 'cmc_admin']
        : ['participant', 'regional_leader'])
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
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not manage leadership access.' });
  }
};

exports._test = { REGIONS, resolveRoleChange };
