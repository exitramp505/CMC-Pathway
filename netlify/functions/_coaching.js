const { httpError } = require('./_auth');

const REGIONS = ['Central', 'East', 'Mountain Plains', 'Pacific', 'Southeast'];

async function coachContext(supabase, userId) {
  const { data: profile, error: profileError } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role,is_coach')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw httpError(403, 'Your CMC Pathway profile could not be found.');
  const { data: regions, error: regionError } = await supabase
    .from('cmc_coach_regions')
    .select('region')
    .eq('coach_id', userId)
    .order('region');
  if (regionError) throw regionError;
  return { profile, regions:(regions || []).map(item => item.region) };
}

async function activeCoachAssignment(supabase, coachId, participantId) {
  const { data, error } = await supabase
    .from('cmc_coach_assignments')
    .select('id,coach_id,participant_id,region,assigned_at')
    .eq('coach_id', coachId)
    .eq('participant_id', participantId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function requireCoachForParticipant(supabase, userId, participantId) {
  const context = await coachContext(supabase, userId);
  if (!context.profile.is_coach) throw httpError(403, 'Coach access is required.');
  const assignment = await activeCoachAssignment(supabase, userId, participantId);
  if (!assignment) throw httpError(403, 'This participant is not assigned to you.');
  return { ...context, assignment };
}

module.exports = { REGIONS, activeCoachAssignment, coachContext, requireCoachForParticipant };
