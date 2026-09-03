const { json, requireUser, httpError } = require('./_auth');
const { activeCoachAssignment } = require('./_coaching');

exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const {supabase,user}=await requireUser(event);
    const body=JSON.parse(event.body||'{}');
    const {data:task,error}=await supabase.from('cmc_participant_plan_tasks').select('*,cmc_participant_task_plans!inner(user_id)').eq('id',body.task_id).single();
    if(error)throw error;
    const ownerId=task.cmc_participant_task_plans.user_id;
    const coachAssignment=ownerId===user.id?null:await activeCoachAssignment(supabase,user.id,ownerId);
    if(ownerId!==user.id&&!coachAssignment)throw httpError(403,'This task is not assigned to you or one of your participants.');
    if(task.task_type==='group')throw httpError(400,'Complete the tasks inside this group.');
    if(!task.participant_editable&&!coachAssignment)throw httpError(403,'This task is managed by your CMC leader.');
    const status=['not_started','in_progress','completed'].includes(body.status)?body.status:null;
    if(!status)throw httpError(400,'Choose a valid task status.');
    if(status==='completed'){
      const {data:dependencies,error:dependencyError}=await supabase
        .from('cmc_participant_plan_dependencies')
        .select('depends_on_task_id')
        .eq('task_id',task.id);
      if(dependencyError)throw dependencyError;
      const dependencyIds=(dependencies||[]).map(row=>row.depends_on_task_id);
      if(dependencyIds.length){
        const {data:dependencyTasks,error:dependencyTaskError}=await supabase
          .from('cmc_participant_plan_tasks')
          .select('id,status')
          .in('id',dependencyIds);
        if(dependencyTaskError)throw dependencyTaskError;
        if((dependencyTasks||[]).some(row=>!['completed','not_applicable'].includes(row.status))){
          throw httpError(409,'Complete the required earlier task before marking this one complete.');
        }
      }
    }
    const savedStatus=status==='completed'&&task.requires_approval?'pending_review':status;
    const now=new Date().toISOString();
    const {data,error:updateError}=await supabase.from('cmc_participant_plan_tasks').update({status:savedStatus,completed_at:savedStatus==='completed'?now:null,completed_by:savedStatus==='completed'?user.id:null,updated_at:now}).eq('id',task.id).select('*').single();
    if(updateError)throw updateError;
    await supabase.from('cmc_task_plan_events').insert({plan_id:task.plan_id,task_id:task.id,actor_user_id:user.id,action:savedStatus==='pending_review'?'task_completion_requested':savedStatus==='completed'?'task_completed':'task_status_changed',details:{status:savedStatus,actor_role:coachAssignment?'coach':'participant'}});
    return json(200,{ok:true,task:data});
  }catch(error){return json(error.statusCode||500,{ok:false,error:error.message||'Could not update this task.'})}
};
