const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const configuredSecret = process.env.PATHWRIGHT_WEBHOOK_SECRET || '';
    const providedSecret = event.headers['x-cmc-webhook-secret'] || '';
    if (!configuredSecret || !safeEqual(configuredSecret, providedSecret)) {
      return json(401, { ok:false, error:'Invalid webhook secret.' });
    }

    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || body.user_email || '').trim().toLowerCase();
    if (!email) return json(400, { ok:false, error:'Learner email is required.' });

    const eventType = String(body.event || body.event_type || '').toLowerCase();
    const completed = eventType.includes('complete') || body.completed === true || Number(body.progress) >= 100;
    const enrolled = completed || eventType.includes('register') || eventType.includes('enroll');
    const progress = completed ? 100 : Math.max(0, Math.min(99, Number(body.progress || 0)));
    const now = new Date().toISOString();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data:profile, error:profileError } = await supabase
      .from('candidate_profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return json(404, { ok:false, error:'No CMC participant matches that email.' });

    const update = {
      progress,
      external_status: completed ? 'completed' : enrolled ? 'enrolled' : 'invited',
      invitation_status: enrolled ? 'enrolled' : 'sent',
      external_user_id: String(body.user_id || body.pathwright_user_id || ''),
      integration_error:null,
      updated_at:now
    };
    if (completed) update.completed_at = now;

    const { data:assignment, error:updateError } = await supabase
      .from('candidate_assignments')
      .update(update)
      .eq('user_id', profile.id)
      .eq('item_key', 'discover_course')
      .select('id,progress,external_status')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!assignment) return json(404, { ok:false, error:'Discover assignment not found.' });

    return json(200, { ok:true, assignment });
  } catch (error) {
    return json(500, { ok:false, error:error.message || 'Could not update Pathwright progress.' });
  }
};

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
