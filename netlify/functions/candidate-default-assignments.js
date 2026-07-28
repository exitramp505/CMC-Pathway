const { createClient } = require('@supabase/supabase-js');

function json(status, body){
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST'){
    return json(405, { ok:false, error:'Method not allowed' });
  }

  try{
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');

    if(!token){
      return json(401, { ok:false, error:'Missing authorization token.' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data:userData, error:userError } = await supabase.auth.getUser(token);

    if(userError || !userData?.user){
      return json(401, { ok:false, error:'Invalid session.' });
    }

    const user = userData.user;
    const email = user.email || '';

    const { data:profile } = await supabase
      .from('candidate_profiles')
      .select('full_name,email')
      .eq('id', user.id)
      .maybeSingle();

    const candidateName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || email || 'Candidate';
    const candidateEmail = profile?.email || email;

    const { data:existing, error:existingError } = await supabase
      .from('candidate_assignments')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_key', 'discover_course')
      .maybeSingle();

    if(existingError) throw existingError;

    if(existing){
      return json(200, { ok:true, assignment:existing, created:false });
    }

    const now = new Date().toISOString();

    const { data:assignment, error:insertError } = await supabase
      .from('candidate_assignments')
      .insert({
        user_id: user.id,
        candidate_email: candidateEmail,
        candidate_name: candidateName,
        item_key: 'discover_course',
        item_type: 'course',
        stage_key: 'discover',
        status: 'assigned',
        assigned_at: now,
        updated_at: now
      })
      .select()
      .single();

    if(insertError) throw insertError;

    return json(200, { ok:true, assignment, created:true });
  }catch(err){
    return json(500, { ok:false, error:err.message || 'Could not create default assignment.' });
  }
};
