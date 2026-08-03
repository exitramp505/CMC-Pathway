const { Resend } = require('resend');
const { requireViewer, json, httpError } = require('./_event-access');

const REGION_BY_STATE = {
  WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',
  TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',
  CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',
  NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',
  FL:'Southeast',GA:'Southeast',AL:'Southeast',MS:'Southeast',LA:'Southeast',SC:'Southeast',NC:'Southeast',PR:'Southeast'
};

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });

  try {
    const { supabase, viewer } = await requireViewer(event, { leader:true });
    const body = JSON.parse(event.body || '{}');
    const fullName = String(body.full_name || '').trim().slice(0, 140);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const state = String(body.state || '').trim().toUpperCase();
    const personalMessage = String(body.message || '').trim().slice(0, 600);
    const region = REGION_BY_STATE[state];

    if (!fullName) throw httpError(400, 'Enter the person’s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.');
    if (!region) throw httpError(400, 'Choose a valid state.');
    if (viewer.account_role === 'regional_leader' && viewer.region !== region) {
      throw httpError(403, `Regional leaders can only invite people in the ${viewer.region} Region.`);
    }

    const { data:existing, error:existingError } = await supabase
      .from('candidate_profiles')
      .select('id,full_name,email,region,archived_at')
      .ilike('email', email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      throw httpError(409, existing.archived_at
        ? 'This person already has an archived CMC Pathway account. Restore it from the People page instead.'
        : 'This person already has a CMC Pathway account and appears on the People page.');
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL;
    if (!apiKey || !from) throw httpError(500, 'Invitation email is not configured.');

    const baseUrl = String(process.env.URL || process.env.SITE_URL || 'https://discernmentcenter.netlify.app').replace(/\/$/, '');
    const signupUrl = `${baseUrl}/signup.html?invited=1&email=${encodeURIComponent(email)}`;
    const firstName = fullName.split(/\s+/)[0];
    const sender = viewer.full_name || 'Your CMC leader';
    const noteHtml = personalMessage
      ? `<div style="margin:22px 0;padding:16px 18px;border-left:4px solid #4da79c;background:#f7ead5;color:#293d48;line-height:1.55"><strong style="display:block;margin-bottom:5px">A note from ${escapeHtml(sender)}</strong>${escapeHtml(personalMessage).replace(/\n/g, '<br>')}</div>`
      : '';
    const text = [
      `Hi ${firstName},`,
      '',
      `${sender} invited you to join CMC Pathway, the Church Multiplication Collective workspace for Discover and your next steps.`,
      personalMessage ? `\n${personalMessage}\n` : '',
      `Create your account: ${signupUrl}`,
      '',
      `Your account will be connected with the Open Bible ${region} Region.`
    ].filter(Boolean).join('\n');
    const html = `<!doctype html><html><body style="margin:0;background:#fbf0de;font-family:Arial,sans-serif;color:#293d48">
      <div style="max-width:640px;margin:0 auto;padding:36px 22px">
        <div style="background:#293d48;border-radius:22px;padding:30px;color:#fbf0de">
          <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#ea9f43">CMC Pathway</div>
          <h1 style="margin:12px 0 10px;font-size:30px;line-height:1.1">You’re invited to begin Discover.</h1>
          <p style="margin:0;color:#eadfce;line-height:1.6">Hi ${escapeHtml(firstName)}, ${escapeHtml(sender)} invited you to join the Church Multiplication Collective pathway.</p>
        </div>
        ${noteHtml}
        <p style="margin:22px 0;color:#52666f;line-height:1.65">Create your CMC Pathway account to access Discover and any future work shared by your regional leader.</p>
        <a href="${escapeHtml(signupUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#ea9f43;color:#111;text-decoration:none;font-weight:800">Create My Account →</a>
        <p style="margin-top:26px;color:#65757c;font-size:12px;line-height:1.5">Your pathway will be connected with the Open Bible ${escapeHtml(region)} Region.</p>
      </div>
    </body></html>`;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to:[email],
      subject:`${sender} invited you to CMC Pathway`,
      html,
      text,
      reply_to:viewer.email || process.env.ADMIN_EMAIL || undefined
    });
    if (result.error) throw new Error(result.error.message || 'Resend could not send the invitation.');

    return json(200, { ok:true, email, region, message_id:result.data?.id || null });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not send the invitation.'
    });
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[character]));
}
