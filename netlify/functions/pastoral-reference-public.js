const { adminClient, json, httpError } = require('./_auth');
const { hashReferenceToken, validateResponse, REFERENCE_ITEM_KEY } = require('./_pastoral-reference');

exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const supabase = adminClient();
    if (!supabase) throw httpError(500, 'Reference service is not configured.');
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const token = String(body.token || event.queryStringParameters?.token || '');
    if (token.length < 30) throw httpError(400, 'This reference link is invalid.');
    const tokenHash = hashReferenceToken(token);
    const { data:reference, error } = await supabase
      .from('cmc_pastoral_references')
      .select('id,participant_id,pastor_name,pastor_email,token_hash,token_expires_at,submitted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!reference) throw httpError(404, 'This reference link is invalid or has already been used.');
    if (reference.submitted_at) throw httpError(409, 'This reference has already been submitted.');
    if (new Date(reference.token_expires_at).getTime() < Date.now()) throw httpError(410, 'This reference link has expired. Ask the participant to send a new one.');
    const { data:participant, error:participantError } = await supabase
      .from('candidate_profiles').select('full_name').eq('id', reference.participant_id).maybeSingle();
    if (participantError) throw participantError;
    if (event.httpMethod === 'GET') {
      return json(200, { ok:true, reference:{ participant_name:participant?.full_name || 'the participant', pastor_name:reference.pastor_name, expires_at:reference.token_expires_at } });
    }
    const response = validateResponse(body);
    const submittedAt = new Date().toISOString();
    const { data:updated, error:updateError } = await supabase
      .from('cmc_pastoral_references')
      .update({ response, submitted_at:submittedAt, token_hash:null, updated_at:submittedAt })
      .eq('id', reference.id)
      .eq('token_hash', tokenHash)
      .is('submitted_at', null)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw httpError(409, 'This reference has already been submitted.');
    const { error:assignmentError } = await supabase.from('candidate_assignments').update({
      progress:100,
      external_status:'completed',
      completed_at:submittedAt,
      updated_at:submittedAt
    }).eq('user_id', reference.participant_id).eq('item_key', REFERENCE_ITEM_KEY);
    if (assignmentError) throw assignmentError;
    return json(200, { ok:true, submitted_at:submittedAt });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not process this pastoral reference.' });
  }
};

