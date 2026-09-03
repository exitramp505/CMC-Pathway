const { json, requireUser } = require('./_auth');
const { coachContext } = require('./_coaching');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, user } = await requireUser(event);
    const context = await coachContext(supabase, user.id);
    return json(200, { ok:true, is_coach:Boolean(context.profile.is_coach), regions:context.regions });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not load coaching access.' });
  }
};
