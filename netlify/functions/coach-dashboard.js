const { json, requireUser, httpError } = require('./_auth');
const { coachContext, requireCoachForParticipant } = require('./_coaching');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405,{ok:false,error:'Method not allowed.'});
  try {
    const { supabase, user } = await requireUser(event);
    const participantId = String(event.queryStringParameters?.participant_id || '');
    const context = participantId
      ? await requireCoachForParticipant(supabase,user.id,participantId)
      : await coachContext(supabase,user.id);
    if (!context.profile.is_coach) throw httpError(403,'Coach access is required.');
    if (participantId) return json(200,{ok:true,viewer:context.profile,...await participantDetail(supabase,participantId)});
    const { data:assignments,error } = await supabase.from('cmc_coach_assignments').select('id,participant_id,region,assigned_at').eq('coach_id',user.id).is('ended_at',null).order('assigned_at');
    if(error)throw error;
    const ids=(assignments||[]).map(item=>item.participant_id);
    if(!ids.length)return json(200,{ok:true,viewer:context.profile,regions:context.regions,participants:[]});
    const {data:people,error:peopleError}=await supabase.from('candidate_profiles').select('id,full_name,email,phone,region,church_name,ministry_role,current_stage').in('id',ids);
    if(peopleError)throw peopleError;
    const {data:plans,error:plansError}=await supabase.from('cmc_participant_task_plans').select('id,user_id,status').in('user_id',ids).neq('status','archived');
    if(plansError)throw plansError;
    const planIds=(plans||[]).map(plan=>plan.id);
    let tasks=[];
    if(planIds.length){const result=await supabase.from('cmc_participant_plan_tasks').select('plan_id,status,task_type').in('plan_id',planIds);if(result.error)throw result.error;tasks=result.data||[]}
    const assignmentByParticipant=new Map((assignments||[]).map(item=>[item.participant_id,item]));
    const peopleWithProgress=(people||[]).map(person=>{
      const personPlans=(plans||[]).filter(plan=>plan.user_id===person.id);
      const personPlanIds=new Set(personPlans.map(plan=>plan.id));
      const actionable=tasks.filter(task=>personPlanIds.has(task.plan_id)&&task.task_type!=='group'&&task.status!=='not_applicable');
      const completed=actionable.filter(task=>task.status==='completed').length;
      return {...person,coach_assignment:assignmentByParticipant.get(person.id),task_progress:actionable.length?Math.round(completed/actionable.length*100):0,task_plan_count:personPlans.length};
    });
    return json(200,{ok:true,viewer:context.profile,regions:context.regions,participants:peopleWithProgress});
  }catch(error){return json(error.statusCode||500,{ok:false,error:error.message||'Could not load your participants.'})}
};

async function participantDetail(supabase,id){
  const [personResult,reportResult,assignmentResult,enrollmentResult,courseResult,planResult,eventResult]=await Promise.all([
    supabase.from('candidate_profiles').select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,current_stage,created_at').eq('id',id).single(),
    supabase.from('assessment_results').select('id,created_at,scores,overall,overall_label').eq('user_id',id).order('created_at',{ascending:false}),
    supabase.from('candidate_assignments').select('id,item_key,item_type,stage_key,status,progress,completed_at').eq('user_id',id),
    supabase.from('cmc_course_enrollments').select('course_id,progress,completed_at,last_opened_at').eq('user_id',id),
    supabase.from('cmc_courses').select('id,title,slug,stage_key'),
    supabase.from('cmc_participant_task_plans').select('id,title,description,stage_key,status,assigned_at').eq('user_id',id).neq('status','archived'),
    supabase.from('cmc_event_invitations').select('id,rsvp_status,attendance_status,cmc_events(id,title,starts_at,ends_at,location_name,status)').eq('user_id',id)
  ]);
  for(const result of [personResult,reportResult,assignmentResult,enrollmentResult,courseResult,planResult,eventResult])if(result.error)throw result.error;
  const reports=(reportResult.data||[]).map(row=>({id:row.id,created_at:row.created_at,assessment_type:row.scores?.assessmentType||'character_qualities',title:row.scores?.assessmentTitle||assessmentTitle(row.scores?.assessmentType),overall:row.overall??row.scores?.overall,overall_label:row.overall_label||row.scores?.overallLabel||''}));
  return {participant:personResult.data,reports,assignments:assignmentResult.data||[],enrollments:enrollmentResult.data||[],courses:courseResult.data||[],plans:planResult.data||[],events:(eventResult.data||[]).map(item=>({...item,event:Array.isArray(item.cmc_events)?item.cmc_events[0]:item.cmc_events,cmc_events:undefined})).filter(item=>item.event)};
}
function assessmentTitle(type){if(type==='isa_readiness')return'Ministry Readiness Inventory';if(type==='ministry_style')return'Ministry Style Inventory';return'Character Qualities Assessment'}
