const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, assignmentRecord } = require('./_course-access');

function json(status, body) {
  return {
    statusCode:status,
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed' });

  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { ok:false, error:'Missing authorization token.' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(401, { ok:false, error:'Invalid session.' });

    const user = userData.user;
    const { data:profile, error:profileError } = await supabase
      .from('candidate_profiles')
      .select('id,full_name,email,account_role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      return json(200, { ok:true, assignments:[], created:false });
    }

    const participant = {
      id:user.id,
      full_name:profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
      email:profile.email || user.email || ''
    };

    const { data:courses, error:courseError } = await supabase
      .from('cmc_courses')
      .select('id,slug,stage_key')
      .eq('status', 'published')
      .eq('access_mode', 'automatic');
    if (courseError) throw courseError;

    const legacyDiscover = {
      id:'legacy-discover',
      slug:'discover',
      stage_key:'discover'
    };
    const byKey = new Map();
    [legacyDiscover, ...(courses || [])].forEach(course => {
      byKey.set(assignmentKey(course), assignmentRecord(course, participant, 'automatic'));
    });
    const automaticKeys = [...byKey.keys()];
    const { data:existing, error:existingError } = await supabase
      .from('candidate_assignments')
      .select('item_key')
      .eq('user_id', user.id);
    if (existingError) throw existingError;
    const { error:sourceError } = await supabase
      .from('candidate_assignments')
      .update({ assignment_source:'automatic', status:'assigned', hidden_at:null })
      .eq('user_id', user.id)
      .in('item_key', automaticKeys);
    if (sourceError) throw sourceError;
    const existingKeys = new Set((existing || []).map(item => item.item_key));
    const rows = [...byKey.entries()]
      .filter(([key]) => !existingKeys.has(key))
      .map(([, row]) => row);

    let assignments = [];
    if (rows.length) {
      const { data, error:assignmentError } = await supabase
        .from('candidate_assignments')
        .insert(rows)
        .select();
      if (assignmentError) throw assignmentError;
      assignments = data || [];
    }

    return json(200, { ok:true, assignments, created:rows.length > 0 });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not create default assignments.' });
  }
};
