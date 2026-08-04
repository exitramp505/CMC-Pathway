const { createClient } = require('@supabase/supabase-js');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function bearerToken(event) {
  const header = String(
    event?.headers?.authorization || event?.headers?.Authorization || ''
  );
  return header.replace(/^Bearer\s+/i, '').trim();
}

async function requireUser(event, client = adminClient()) {
  if (!client) throw httpError(500, 'Supabase service credentials are not configured.');
  const token = bearerToken(event);
  if (!token) throw httpError(401, 'You must be logged in to continue.');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw httpError(401, 'Your session is no longer valid. Please log in again.');
  return { supabase: client, user: data.user, token };
}

async function requireLeader(event, client = adminClient()) {
  const auth = await requireUser(event, client);
  const { data: viewer, error } = await auth.supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!viewer || !['regional_leader', 'cmc_admin'].includes(viewer.account_role)) {
    throw httpError(403, 'Regional leader access is required.');
  }
  return { ...auth, viewer };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  adminClient,
  bearerToken,
  httpError,
  json,
  requireLeader,
  requireUser
};
