const { json, requireUser } = require('./_auth');
const { regionForState } = require('./_regions');

const SAFE_FIELDS = [
  'full_name', 'phone', 'state', 'married', 'church_name',
  'ministry_role', 'pathway_interest'
];

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, user } = await requireUser(event);
    const source = JSON.parse(event.body || '{}');
    const profile = {};
    for (const field of SAFE_FIELDS) profile[field] = String(source[field] ?? '').trim();
    profile.id = user.id;
    profile.email = user.email || '';
    profile.region = regionForState(profile.state);
    profile.updated_at = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from('candidate_profiles')
      .select('id,account_role,current_stage,archived_at')
      .eq('id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const { data, error } = await supabase
      .from('candidate_profiles')
      .upsert({
        ...profile,
        account_role:existing?.account_role || 'participant',
        current_stage:existing?.current_stage || 'discover',
        archived_at:existing?.archived_at || null
      }, { onConflict:'id' })
      .select('*')
      .single();
    if (error) throw error;
    return json(200, { ok:true, profile:data });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not save your profile.' });
  }
};
