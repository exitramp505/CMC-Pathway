const { Resend } = require('resend');
const { json, requireUser, httpError } = require('./_auth');
const { enforceRateLimit } = require('./_rate-limit');
const {
  REFERENCE_ITEM_KEY,
  createReferenceToken,
  hashReferenceToken,
  participantStatus,
  validateRequest
} = require('./_pastoral-reference');

exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, user } = await requireUser(event);
    const [{ data:assignment, error:assignmentError }, { data:profile, error:profileError }] = await Promise.all([
      supabase.from('candidate_assignments').select('id,status,completed_at').eq('user_id', user.id).eq('item_key', REFERENCE_ITEM_KEY).maybeSingle(),
      supabase.from('candidate_profiles').select('id,full_name,email').eq('id', user.id).maybeSingle()
    ]);
    if (assignmentError) throw assignmentError;
    if (profileError) throw profileError;
    if (!assignment || assignment.status !== 'assigned') throw httpError(403, 'The Pastoral Reference Form has not been assigned to your pathway.');

    const { data:existing, error:referenceError } = await supabase
      .from('cmc_pastoral_references')
      .select('pastor_name,pastor_email,requested_at,email_sent_at,email_error,submitted_at')
      .eq('participant_id', user.id)
      .maybeSingle();
    if (referenceError) throw referenceError;
    if (event.httpMethod === 'GET') {
      return json(200, { ok:true, reference:participantStatus(existing) });
    }
    if (existing?.submitted_at) throw httpError(409, 'Your pastoral reference has already been received.');

    const body = JSON.parse(event.body || '{}');
    const { pastorName, pastorEmail } = validateRequest(body);
    await enforceRateLimit(supabase, { actorId:user.id, action:'send_pastoral_reference', limit:5, windowMinutes:60 });
    const rawToken = createReferenceToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const record = {
      participant_id:user.id,
      requested_by:user.id,
      pastor_name:pastorName,
      pastor_email:pastorEmail,
      token_hash:hashReferenceToken(rawToken),
      token_expires_at:expires.toISOString(),
      requested_at:now.toISOString(),
      email_sent_at:null,
      email_error:null,
      submitted_at:null,
      response:null,
      updated_at:now.toISOString()
    };
    const { error:saveError } = await supabase.from('cmc_pastoral_references').upsert(record, { onConflict:'participant_id' });
    if (saveError) throw saveError;

    const siteUrl = String(process.env.URL || process.env.SITE_URL || 'https://cmc-pathway.netlify.app').replace(/\/$/, '');
    const referenceUrl = `${siteUrl}/pastoral-reference.html?token=${encodeURIComponent(rawToken)}`;
    const emailResult = await sendReferenceEmail({ pastorName, pastorEmail, participantName:profile?.full_name || profile?.email || 'a CMC Pathway participant', referenceUrl, expires });
    const sentAt = emailResult.sent ? new Date().toISOString() : null;
    await supabase.from('cmc_pastoral_references').update({
      email_sent_at:sentAt,
      email_error:emailResult.sent ? null : emailResult.error,
      updated_at:new Date().toISOString()
    }).eq('participant_id', user.id);
    if (!emailResult.sent) throw httpError(502, `The request was saved, but the email could not be sent: ${emailResult.error}`);

    await supabase.from('candidate_assignments').update({
      progress:25,
      external_status:'waiting_for_reference',
      updated_at:new Date().toISOString()
    }).eq('id', assignment.id);
    return json(200, { ok:true, reference:participantStatus({ ...record, email_sent_at:sentAt }) });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not send the pastoral reference request.' });
  }
};

async function sendReferenceEmail({ pastorName, pastorEmail, participantName, referenceUrl, expires }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey || !from) return { sent:false, error:'Email delivery is not configured.' };
  const subject = `${participantName} requested a pastoral reference through CMC Pathway`;
  const expiration = expires.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
  const html = `<!doctype html><html><body style="margin:0;background:#fbf0de;font-family:Arial,sans-serif;color:#293d48"><div style="max-width:640px;margin:0 auto;padding:36px 22px"><div style="background:#293d48;border-radius:22px;padding:28px;color:#fbf0de"><div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#ea9f43">CMC Pathway</div><h1 style="margin:12px 0 8px;font-size:30px;line-height:1.15">Pastoral reference requested</h1><p style="margin:0;color:#eadfce;line-height:1.6">Hello ${escapeHtml(pastorName)}, ${escapeHtml(participantName)} named you as a pastoral reference in the Church Multiplication Collective pathway.</p></div><p style="line-height:1.65">Please complete the confidential reference below. It usually takes 10–15 minutes. The participant will only see whether it has been received; your answers are available only to authorized CMC leaders.</p><a href="${escapeHtml(referenceUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#ea9f43;color:#111;text-decoration:none;font-weight:800">Complete the reference →</a><p style="margin-top:24px;color:#65757c;font-size:13px;line-height:1.55">This secure link expires ${escapeHtml(expiration)} and can be used once.</p></div></body></html>`;
  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to:[pastorEmail],
      subject,
      html,
      text:`Hello ${pastorName},\n\n${participantName} requested a confidential pastoral reference through CMC Pathway. Complete it here: ${referenceUrl}\n\nThis secure one-use link expires ${expiration}.`,
      reply_to:process.env.ADMIN_EMAIL || undefined
    });
    if (result.error) throw new Error(result.error.message || 'Resend could not send the email.');
    return { sent:true };
  } catch (error) {
    return { sent:false, error:error.message || 'Email delivery failed.' };
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
}

