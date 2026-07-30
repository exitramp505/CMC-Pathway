const { createClient } = require('@supabase/supabase-js');

const LEADER_ROLES = new Set(['regional_leader', 'cmc_admin']);
const STAGES = new Set(['discover', 'discern', 'develop', 'deploy']);

function adminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth:{ autoRefreshToken:false, persistSession:false } }
  );
}

async function userFromEvent(event, supabase) {
  const token = String(event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Missing authorization token.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw httpError(401, 'Invalid session.');
  return data.user;
}

async function requireViewer(event, options = {}) {
  const supabase = adminClient();
  const user = await userFromEvent(event, supabase);
  const { data:viewer, error } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!viewer) throw httpError(403, 'A CMC Pathway profile is required.');
  if (options.leader && !LEADER_ROLES.has(viewer.account_role)) {
    throw httpError(403, 'Regional leader access is required.');
  }
  return { supabase, user, viewer };
}

async function loadParticipant(supabase, viewer, participantId) {
  let query = supabase
    .from('candidate_profiles')
    .select('id,full_name,email,state,region,church_name,ministry_role,current_stage,account_role')
    .eq('id', participantId);
  if (viewer.account_role === 'regional_leader') {
    if (!viewer.region) throw httpError(403, 'Your leader account does not have a region.');
    query = query.eq('region', viewer.region);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (viewer.account_role === 'regional_leader') {
    return ['participant','regional_leader'].includes(data.account_role) ? data : null;
  }
  return data.account_role !== 'cmc_admin' || data.id === viewer.id ? data : null;
}

function eventVisibleToRegion(event, region) {
  return !event.region || event.region === region;
}

function canManageEvent(viewer, event) {
  return viewer.account_role === 'cmc_admin'
    || (viewer.account_role === 'regional_leader' && event.region === viewer.region);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(body)
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  LEADER_ROLES,
  STAGES,
  adminClient,
  userFromEvent,
  requireViewer,
  loadParticipant,
  eventVisibleToRegion,
  canManageEvent,
  json,
  isUuid,
  httpError
};
