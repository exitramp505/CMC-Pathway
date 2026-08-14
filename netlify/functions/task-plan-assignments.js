const { json, requireLeader, requireUser, httpError } = require('./_auth');
const { addDays, nestTasks } = require('./_task-plans');

exports.handler = async event => {
  if (!['GET','POST'].includes(event.httpMethod)) return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const participantId = String(body.participant_id || event.queryStringParameters?.participant_id || '');
    if (event.httpMethod === 'GET' && !participantId) return participantView(event);
    const { supabase, viewer } = await requireLeader(event);
    if (!isUuid(participantId)) throw httpError(400, 'Choose a participant.');
    await ensureParticipantAccess(supabase, viewer, participantId);

    if (event.httpMethod === 'GET') {
      const planId = String(event.queryStringParameters?.plan_id || '');
      if (planId) {
        const plan = await accessiblePlan(supabase, viewer, planId, participantId);
        const tasks = await loadPlanTasks(supabase, plan.id);
        return json(200, { ok:true, plan, tasks, template_diff:await templateDiff(supabase, plan, tasks) });
      }
      const [templateResult, planResult] = await Promise.all([
        supabase.from('cmc_task_plan_templates').select('id,title,description,stage_key,version,updated_at').eq('status','published').order('title'),
        supabase.from('cmc_participant_task_plans').select('*').eq('user_id',participantId).neq('status','archived').order('assigned_at',{ascending:false})
      ]);
      if (templateResult.error) throw templateResult.error;
      if (planResult.error) throw planResult.error;
      return json(200, { ok:true, templates:templateResult.data || [], plans:await planSummaries(supabase, planResult.data || []) });
    }

    if (body.action === 'assign') {
      const templateId = String(body.template_id || '');
      const { data:template, error:templateError } = await supabase.from('cmc_task_plan_templates').select('*').eq('id',templateId).eq('status','published').single();
      if (templateError) throw templateError;
      const [sectionsResult,tasksResult] = await Promise.all([
        supabase.from('cmc_task_plan_sections').select('*').eq('template_id',templateId).order('position'),
        supabase.from('cmc_task_plan_tasks').select('*').eq('template_id',templateId).order('position')
      ]);
      if (sectionsResult.error) throw sectionsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      const anchorDate = validDate(body.anchor_date) ? body.anchor_date : new Date().toISOString().slice(0,10);
      const now = new Date().toISOString();
      const { data:plan, error:planError } = await supabase.from('cmc_participant_task_plans').insert({
        user_id:participantId,
        template_id:template.id,
        template_version:template.version,
        title:String(body.title || template.title).trim(),
        description:template.description,
        stage_key:template.stage_key,
        anchor_date:anchorDate,
        assigned_by:viewer.id,
        updated_at:now
      }).select('*').single();
      if (planError) throw planError;
      const sectionById = new Map((sectionsResult.data || []).map(section => [section.id, section]));
      const instanceIds = new Map();
      for (const task of tasksResult.data || []) {
        const section = sectionById.get(task.section_id);
        const { data:created, error } = await supabase.from('cmc_participant_plan_tasks').insert({
          plan_id:plan.id,
          source_task_id:task.id,
          parent_task_id:task.parent_task_id ? instanceIds.get(task.parent_task_id) || null : null,
          section_title:section?.title || 'Task Plan',
          section_position:section?.position || 0,
          title:task.title,
          description:task.description,
          task_type:task.task_type,
          position:task.position,
          start_date:addDays(anchorDate, task.relative_start_days),
          due_date:addDays(anchorDate, task.relative_due_days),
          priority:task.default_priority,
          is_required:task.is_required,
          requires_approval:task.requires_approval,
          participant_editable:task.participant_editable,
          resource_url:task.resource_url,
          tags:task.tags,
          updated_at:now
        }).select('id').single();
        if (error) throw error;
        instanceIds.set(task.id, created.id);
      }
      const templateTaskIds = (tasksResult.data || []).map(task => task.id);
      let dependencies = [];
      if (templateTaskIds.length) {
        const { data, error } = await supabase.from('cmc_task_plan_dependencies').select('*').in('task_id', templateTaskIds);
        if (error) throw error;
        dependencies = data || [];
      }
      const instanceDependencies = dependencies.map(dep => ({
        task_id:instanceIds.get(dep.task_id), depends_on_task_id:instanceIds.get(dep.depends_on_task_id)
      })).filter(dep => dep.task_id && dep.depends_on_task_id);
      if (instanceDependencies.length) {
        const { error } = await supabase.from('cmc_participant_plan_dependencies').insert(instanceDependencies);
        if (error) throw error;
      }
      await audit(supabase, plan.id, null, viewer.id, 'plan_assigned', { template_id:template.id, template_version:template.version });
      return json(200, { ok:true, plan });
    }

    if (body.action === 'archive') {
      const plan = await accessiblePlan(supabase, viewer, body.plan_id, participantId);
      const { error } = await supabase.from('cmc_participant_task_plans').update({ status:'archived', updated_at:new Date().toISOString() }).eq('id',plan.id);
      if (error) throw error;
      await audit(supabase, plan.id, null, viewer.id, 'plan_archived');
      return json(200, { ok:true });
    }

    if (body.action === 'update_task') {
      const plan = await accessiblePlan(supabase, viewer, body.plan_id, participantId);
      const updates = taskUpdates(body.task || {}, true);
      if (updates.status !== undefined) updates.completed_by = updates.status === 'completed' ? viewer.id : null;
      const { data, error } = await supabase.from('cmc_participant_plan_tasks').update({ ...updates, updated_at:new Date().toISOString() }).eq('id',body.task_id).eq('plan_id',plan.id).select('*').single();
      if (error) throw error;
      await audit(supabase, plan.id, data.id, viewer.id, 'task_updated', updates);
      return json(200, { ok:true, task:data });
    }

    if (body.action === 'add_task') {
      const plan = await accessiblePlan(supabase, viewer, body.plan_id, participantId);
      const source = body.task || {};
      if (!String(source.title || '').trim()) throw httpError(400,'Add a task title.');
      const { data, error } = await supabase.from('cmc_participant_plan_tasks').insert({
        plan_id:plan.id,
        parent_task_id:source.parent_task_id || null,
        section_title:String(source.section_title || 'Custom tasks'),
        section_position:Number(source.section_position || 999),
        title:String(source.title).trim(),
        description:String(source.description || '').trim(),
        task_type:['group','task','milestone'].includes(source.task_type) ? source.task_type : 'task',
        position:Number(source.position || 999),
        start_date:validDate(source.start_date) ? source.start_date : null,
        due_date:validDate(source.due_date) ? source.due_date : null,
        priority:bounded(source.priority,1,5,3),
        is_required:source.is_required !== false,
        participant_editable:source.participant_editable !== false
      }).select('*').single();
      if (error) throw error;
      await audit(supabase,plan.id,data.id,viewer.id,'task_added');
      return json(200,{ok:true,task:data});
    }

    if (body.action === 'apply_template_update') {
      const plan = await accessiblePlan(supabase, viewer, body.plan_id, participantId);
      const existingTasks = await loadPlanTasks(supabase, plan.id);
      const diff = await templateDiff(supabase, plan, existingTasks);
      if (!diff.available) return json(200, { ok:true, changed:false, diff });
      const now = new Date().toISOString();
      const instanceBySource = new Map(existingTasks.filter(task => task.source_task_id).map(task => [task.source_task_id, task]));
      const createdBySource = new Map();
      for (const source of diff.template_tasks) {
        const existing = instanceBySource.get(source.id);
        const section = diff.sections_by_id[source.section_id];
        if (existing) {
          if (existing.status !== 'completed') {
            const parent = source.parent_task_id ? instanceBySource.get(source.parent_task_id) || createdBySource.get(source.parent_task_id) : null;
            const { error } = await supabase.from('cmc_participant_plan_tasks').update({
              parent_task_id:parent?.id || null,
              section_title:section?.title || existing.section_title,
              section_position:section?.position ?? existing.section_position,
              title:source.title,
              description:source.description,
              task_type:source.task_type,
              position:source.position,
              start_date:addDays(plan.anchor_date, source.relative_start_days),
              due_date:addDays(plan.anchor_date, source.relative_due_days),
              priority:source.default_priority,
              is_required:source.is_required,
              requires_approval:source.requires_approval,
              participant_editable:source.participant_editable,
              resource_url:source.resource_url,
              tags:source.tags,
              updated_at:now
            }).eq('id',existing.id).eq('plan_id',plan.id);
            if (error) throw error;
          }
          continue;
        }
        const parent = source.parent_task_id ? instanceBySource.get(source.parent_task_id) || createdBySource.get(source.parent_task_id) : null;
        const { data, error } = await supabase.from('cmc_participant_plan_tasks').insert({
          plan_id:plan.id,
          source_task_id:source.id,
          parent_task_id:parent?.id || null,
          section_title:section?.title || 'Task Plan',
          section_position:section?.position || 0,
          title:source.title,
          description:source.description,
          task_type:source.task_type,
          position:source.position,
          start_date:addDays(plan.anchor_date, source.relative_start_days),
          due_date:addDays(plan.anchor_date, source.relative_due_days),
          priority:source.default_priority,
          is_required:source.is_required,
          requires_approval:source.requires_approval,
          participant_editable:source.participant_editable,
          resource_url:source.resource_url,
          tags:source.tags,
          updated_at:now
        }).select('*').single();
        if (error) throw error;
        createdBySource.set(source.id,data);
      }
      for (const removed of diff.removed) {
        if (removed.status === 'completed') continue;
        const { error } = await supabase.from('cmc_participant_plan_tasks').update({ status:'not_applicable', updated_at:now }).eq('id',removed.id).eq('plan_id',plan.id);
        if (error) throw error;
      }
      const allBySource = new Map([...instanceBySource, ...createdBySource]);
      const currentTaskIds = [...allBySource.values()].map(task => task.id);
      if (currentTaskIds.length) {
        const { error:deleteDependencyError } = await supabase
          .from('cmc_participant_plan_dependencies')
          .delete()
          .in('task_id', currentTaskIds);
        if (deleteDependencyError) throw deleteDependencyError;
      }
      const sourceIds = diff.template_tasks.map(task => task.id);
      let sourceDependencies = [];
      if (sourceIds.length) {
        const { data, error } = await supabase.from('cmc_task_plan_dependencies').select('*').in('task_id', sourceIds);
        if (error) throw error;
        sourceDependencies = data || [];
      }
      const updatedDependencies = sourceDependencies.map(dependency => ({
        task_id:allBySource.get(dependency.task_id)?.id,
        depends_on_task_id:allBySource.get(dependency.depends_on_task_id)?.id
      })).filter(dependency => dependency.task_id && dependency.depends_on_task_id);
      if (updatedDependencies.length) {
        const { error } = await supabase.from('cmc_participant_plan_dependencies').insert(updatedDependencies);
        if (error) throw error;
      }
      const { error:updateError } = await supabase.from('cmc_participant_task_plans').update({ template_version:diff.template_version, updated_at:now }).eq('id',plan.id);
      if (updateError) throw updateError;
      await audit(supabase,plan.id,null,viewer.id,'template_update_applied',{ from_version:plan.template_version, to_version:diff.template_version, added:diff.added.length, removed:diff.removed.length, changed:diff.changed.length });
      return json(200,{ok:true,changed:true,diff});
    }

    return json(400, { ok:false, error:'Choose a task plan action.' });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not update this task plan.' });
  }
};

async function participantView(event) {
  try {
    const { supabase, user } = await requireUser(event);
    const planId = String(event.queryStringParameters?.plan_id || '');
    if (planId) {
      const { data:plan,error } = await supabase.from('cmc_participant_task_plans').select('*').eq('id',planId).eq('user_id',user.id).single();
      if (error) throw error;
      return json(200,{ok:true,plan,tasks:await loadPlanTasks(supabase,plan.id)});
    }
    const { data,error } = await supabase.from('cmc_participant_task_plans').select('*').eq('user_id',user.id).neq('status','archived').order('assigned_at',{ascending:false});
    if(error) throw error;
    return json(200,{ok:true,plans:await planSummaries(supabase,data||[])});
  } catch(error) {
    return json(error.statusCode||500,{ok:false,error:error.message||'Could not load your task plans.'});
  }
}

async function loadPlanTasks(supabase,planId){
  const {data,error}=await supabase.from('cmc_participant_plan_tasks').select('*').eq('plan_id',planId).order('section_position').order('position');
  if(error) throw error;
  const tasks=data||[];
  const ids=tasks.map(task=>task.id);
  if(!ids.length)return tasks;
  const {data:dependencies,error:dependencyError}=await supabase.from('cmc_participant_plan_dependencies').select('*').in('task_id',ids);
  if(dependencyError)throw dependencyError;
  const taskById=new Map(tasks.map(task=>[task.id,task]));
  const dependenciesByTask=new Map();
  (dependencies||[]).forEach(row=>{
    if(!dependenciesByTask.has(row.task_id))dependenciesByTask.set(row.task_id,[]);
    dependenciesByTask.get(row.task_id).push(row.depends_on_task_id);
  });
  return tasks.map(task=>{
    const dependencyIds=dependenciesByTask.get(task.id)||[];
    return {...task,dependency_ids:dependencyIds,blocked_by_dependency:dependencyIds.some(id=>!['completed','not_applicable'].includes(taskById.get(id)?.status))};
  });
}
async function planSummaries(supabase,plans){
  return Promise.all(plans.map(async plan=>{
    const tasks=await loadPlanTasks(supabase,plan.id);
    const actionable=tasks.filter(task=>task.task_type!=='group'&&task.status!=='not_applicable');
    const complete=actionable.filter(task=>task.status==='completed').length;
    return {...plan,total_tasks:actionable.length,completed_tasks:complete,progress:actionable.length?Math.round(complete/actionable.length*100):0,next_task:nextTask(tasks)};
  }));
}
async function templateDiff(supabase,plan,instanceTasks){
  if(!plan.template_id) return {available:false,reason:'This plan is not connected to a template.',added:[],removed:[],changed:[]};
  const [templateResult,taskResult,sectionResult]=await Promise.all([
    supabase.from('cmc_task_plan_templates').select('id,version,status').eq('id',plan.template_id).single(),
    supabase.from('cmc_task_plan_tasks').select('*').eq('template_id',plan.template_id).order('position'),
    supabase.from('cmc_task_plan_sections').select('*').eq('template_id',plan.template_id).order('position')
  ]);
  if(templateResult.error) return {available:false,reason:'The original template is no longer available.',added:[],removed:[],changed:[]};
  if(taskResult.error) throw taskResult.error;
  if(sectionResult.error) throw sectionResult.error;
  const templateTasks=taskResult.data||[],instanceBySource=new Map(instanceTasks.filter(task=>task.source_task_id).map(task=>[task.source_task_id,task])),templateIds=new Set(templateTasks.map(task=>task.id));
  const added=templateTasks.filter(task=>!instanceBySource.has(task.id));
  const removed=instanceTasks.filter(task=>task.source_task_id&&!templateIds.has(task.source_task_id));
  const changed=templateTasks.filter(source=>{const instance=instanceBySource.get(source.id);return instance&&[
    source.title!==instance.title,
    source.description!==instance.description,
    source.default_priority!==instance.priority,
    source.is_required!==instance.is_required,
    source.resource_url!==instance.resource_url
  ].some(Boolean)}).map(source=>({source,instance:instanceBySource.get(source.id)}));
  const sectionsById=Object.fromEntries((sectionResult.data||[]).map(section=>[section.id,section]));
  return {available:templateResult.data.status==='published'&&templateResult.data.version>plan.template_version,template_version:templateResult.data.version,added,removed,changed,template_tasks:templateTasks,sections_by_id:sectionsById};
}
function nextTask(tasks){
  const unfinished=tasks
    .filter(task=>task.task_type!=='group'&&!['completed','not_applicable','pending_review'].includes(task.status))
    .sort((a,b)=>(a.priority-b.priority)||String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')));
  return unfinished.find(task=>!task.blocked_by_dependency)||unfinished[0]||null;
}
function taskUpdates(input,leader){
  const updates={};
  if(input.title!==undefined&&leader)updates.title=String(input.title).trim();
  if(input.description!==undefined&&leader)updates.description=String(input.description).trim();
  if(input.status!==undefined&&['not_started','in_progress','blocked','pending_review','completed','not_applicable'].includes(input.status)){
    updates.status=input.status;updates.completed_at=input.status==='completed'?new Date().toISOString():null;
  }
  if(input.start_date!==undefined&&leader)updates.start_date=validDate(input.start_date)?input.start_date:null;
  if(input.due_date!==undefined&&leader)updates.due_date=validDate(input.due_date)?input.due_date:null;
  if(input.priority!==undefined&&leader)updates.priority=bounded(input.priority,1,5,3);
  return updates;
}
async function ensureParticipantAccess(supabase,viewer,id){
  const {data,error}=await supabase.from('candidate_profiles').select('id,region').eq('id',id).single();if(error)throw error;
  if(viewer.account_role!=='cmc_admin'&&data.region!==viewer.region)throw httpError(403,'This participant is outside your region.');return data;
}
async function accessiblePlan(supabase,viewer,id,userId){const {data,error}=await supabase.from('cmc_participant_task_plans').select('*').eq('id',id).eq('user_id',userId).single();if(error)throw error;return data}
async function audit(supabase,planId,taskId,actorId,action,details={}){const {error}=await supabase.from('cmc_task_plan_events').insert({plan_id:planId,task_id:taskId,actor_user_id:actorId,action,details});if(error)throw error}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))}
function bounded(value,min,max,fallback){const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback}
function isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}

module.exports._test={nextTask,taskUpdates,validDate,templateDiff};
