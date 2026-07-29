const { createClient } = require('@supabase/supabase-js');

function json(statusCode, body) {
  return {
    statusCode,
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const { supabase, viewer } = await requireLeader(event);
    const participantId = String(event.queryStringParameters?.participant_id || '');
    const recordType = String(event.queryStringParameters?.type || '');
    const recordId = String(event.queryStringParameters?.record_id || '');
    if (!isUuid(participantId)) {
      return json(400, { ok:false, error:'A participant is required.' });
    }

    const participant = await loadParticipant(supabase, viewer, participantId);
    if (!participant) {
      return json(404, { ok:false, error:'Participant not found in your region.' });
    }

    if (recordType === 'application') {
      const { data, error } = await supabase
        .from('candidate_applications')
        .select('*')
        .eq('user_id', participant.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { ok:false, error:'No application has been started.' });
      return json(200, { ok:true, viewer, participant, type:'application', record:data });
    }

    if (recordType === 'assessment') {
      if (!isUuid(recordId)) {
        return json(400, { ok:false, error:'An assessment report is required.' });
      }
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('id', recordId)
        .eq('user_id', participant.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { ok:false, error:'Assessment report not found.' });
      return json(200, { ok:true, viewer, participant, type:'assessment', record:data });
    }

    return json(400, { ok:false, error:'Choose an application or assessment report.' });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not load this record.'
    });
  }
};

async function requireLeader(event) {
  const token = String(event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Missing authorization token.');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data:userData, error:userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw httpError(401, 'Invalid session.');
  const { data:viewer, error } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!viewer || !['regional_leader', 'cmc_admin'].includes(viewer.account_role)) {
    throw httpError(403, 'Regional leader access is required.');
  }
  return { supabase, viewer };
}

async function loadParticipant(supabase, viewer, id) {
  let query = supabase
    .from('candidate_profiles')
    .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,current_stage,created_at')
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
