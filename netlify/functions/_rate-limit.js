function rateLimitError(message) {
  const error = new Error(message || 'Too many requests. Please wait and try again.');
  error.statusCode = 429;
  return error;
}

async function enforceRateLimit(supabase, { actorId, action, limit, windowMinutes }) {
  if (!supabase || !actorId || !action) throw new Error('Rate limit is not configured correctly.');
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('cmc_rate_limit_events')
    .select('id', { count:'exact', head:true })
    .eq('actor_user_id', actorId)
    .eq('action', action)
    .gte('created_at', since);
  if (error) throw error;
  if (Number(count || 0) >= limit) {
    throw rateLimitError('That action has been used several times recently. Please wait a little while and try again.');
  }
  const { error:insertError } = await supabase.from('cmc_rate_limit_events').insert({
    actor_user_id:actorId,
    action
  });
  if (insertError) throw insertError;
}

module.exports = { enforceRateLimit };
