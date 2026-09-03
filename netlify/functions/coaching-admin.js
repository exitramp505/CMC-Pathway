const { json, requireLeader, httpError } = require('./_auth');
const { REGIONS } = require('./_coaching');

exports.handler = async event => {
  if (!['GET','POST'].includes(event.httpMethod)) return json(405,{ok:false,error:'Method not allowed.'});
  try {
    const { supabase, viewer } = await requireLeader(event);
    const allowedRegions = viewer.account_role === 'cmc_admin' ? REGIONS : [viewer.region];
    if (!allowedRegions.every(region => REGIONS.includes(region))) throw httpError(403,'Your account needs a valid Open Bible region.');
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      await mutate(supabase, viewer, allowedRegions, body);
    }
    return json(200, { ok:true, viewer, ...(await dashboard(supabase, allowedRegions)) });
  } catch (error) {
    return json(error.statusCode || 500,{ok:false,error:error.message || 'Could not manage coaching.'});
  }
};

async function mutate(supabase, viewer, allowedRegions, body) {
  const now = new Date().toISOString();
  const region = String(body.region || '');
  if (region && !allowedRegions.includes(region)) throw httpError(403,'You can only manage coaching in your region.');
  if (body.action === 'add_coach') {
    if (!body.coach_id || !region) throw httpError(400,'Choose a person and region.');
    const coach = await profile(supabase, body.coach_id);
    if (!coach || coach.archived_at) throw httpError(404,'That account is not available.');
    const { error:updateError } = await supabase.from('candidate_profiles').update({is_coach:true,updated_at:now}).eq('id',coach.id);
    if (updateError) throw updateError;
    const { error } = await supabase.from('cmc_coach_regions').upsert({coach_id:coach.id,region,added_by:viewer.id,added_at:now},{onConflict:'coach_id,region'});
    if (error) throw error;
    return;
  }
  if (body.action === 'remove_coach_region') {
    if (!body.coach_id || !region) throw httpError(400,'Choose a coach and region.');
    const { count, error:activeError } = await supabase.from('cmc_coach_assignments').select('id',{count:'exact',head:true}).eq('coach_id',body.coach_id).eq('region',region).is('ended_at',null);
    if (activeError) throw activeError;
    if (count) throw httpError(409,'End this coach’s active participant assignments before removing the region.');
    const { error } = await supabase.from('cmc_coach_regions').delete().eq('coach_id',body.coach_id).eq('region',region);
    if (error) throw error;
    const { count:remaining, error:remainingError } = await supabase.from('cmc_coach_regions').select('coach_id',{count:'exact',head:true}).eq('coach_id',body.coach_id);
    if (remainingError) throw remainingError;
    if (!remaining) {
      const { error:updateError } = await supabase.from('candidate_profiles').update({is_coach:false,updated_at:now}).eq('id',body.coach_id);
      if (updateError) throw updateError;
    }
    return;
  }
  if (body.action === 'assign') {
    if (!body.coach_id || !body.participant_id || !region) throw httpError(400,'Choose a coach and participant.');
    const [coach, participant] = await Promise.all([profile(supabase,body.coach_id),profile(supabase,body.participant_id)]);
    if (!coach?.is_coach || participant?.account_role !== 'participant' || participant.archived_at) throw httpError(400,'Choose an active coach and participant.');
    if (participant.region !== region) throw httpError(400,'The participant does not belong to that region.');
    const { data:membership, error:membershipError } = await supabase.from('cmc_coach_regions').select('coach_id').eq('coach_id',coach.id).eq('region',region).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw httpError(400,'That coach is not approved for this region.');
    const { error:endError } = await supabase.from('cmc_coach_assignments').update({ended_at:now,ended_by:viewer.id}).eq('participant_id',participant.id).is('ended_at',null);
    if (endError) throw endError;
    const { error } = await supabase.from('cmc_coach_assignments').insert({coach_id:coach.id,participant_id:participant.id,region,assigned_by:viewer.id,assigned_at:now});
    if (error) throw error;
    return;
  }
  if (body.action === 'end_assignment') {
    const { data:assignment, error:assignmentError } = await supabase.from('cmc_coach_assignments').select('id,region').eq('id',body.assignment_id).is('ended_at',null).maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment || !allowedRegions.includes(assignment.region)) throw httpError(404,'That active assignment was not found.');
    const { error } = await supabase.from('cmc_coach_assignments').update({ended_at:now,ended_by:viewer.id}).eq('id',assignment.id).is('ended_at',null);
    if (error) throw error;
    return;
  }
  throw httpError(400,'Choose a coaching action.');
}

async function dashboard(supabase, regions) {
  const [profilesResult, coachRegionsResult, assignmentsResult] = await Promise.all([
    supabase.from('candidate_profiles').select('id,full_name,email,region,account_role,is_coach,archived_at').is('archived_at',null).order('full_name'),
    supabase.from('cmc_coach_regions').select('coach_id,region,added_at').in('region',regions),
    supabase.from('cmc_coach_assignments').select('id,coach_id,participant_id,region,assigned_at').in('region',regions).is('ended_at',null).order('assigned_at',{ascending:false})
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (coachRegionsResult.error) throw coachRegionsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  const visibleProfiles = (profilesResult.data || []).filter(item => regions.includes(item.region) || item.is_coach);
  const byId = new Map(visibleProfiles.map(item => [item.id,item]));
  const memberships = coachRegionsResult.data || [];
  const assignments = (assignmentsResult.data || []).map(item => ({...item,coach:byId.get(item.coach_id),participant:byId.get(item.participant_id)})).filter(item=>item.coach&&item.participant);
  const coaches = [...new Set(memberships.map(item=>item.coach_id))].map(id => ({...byId.get(id),regions:memberships.filter(item=>item.coach_id===id).map(item=>item.region),assignments:assignments.filter(item=>item.coach_id===id)})).filter(item=>item.id);
  return { regions, profiles:visibleProfiles, coaches, assignments, participants:visibleProfiles.filter(item=>item.account_role==='participant'&&regions.includes(item.region)) };
}

async function profile(supabase,id){const {data,error}=await supabase.from('candidate_profiles').select('id,region,account_role,is_coach,archived_at').eq('id',id).maybeSingle();if(error)throw error;return data}

exports._test = { mutate };
