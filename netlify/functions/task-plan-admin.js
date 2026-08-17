const { json, requireLeader, httpError } = require('./_auth');
const { cleanSections, cleanTemplate, nestTasks, slugify, snapshot } = require('./_task-plans');

exports.handler = async event => {
  if (!['GET','POST','DELETE'].includes(event.httpMethod)) return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, viewer } = await requireLeader(event);
    if (viewer.account_role !== 'cmc_admin') throw httpError(403, 'National administrator access is required.');
    const query = event.queryStringParameters || {};
    if (event.httpMethod === 'GET') {
      if (query.id) return json(200, { ok:true, ...(await loadTemplate(supabase, query.id)) });
      const { data, error } = await supabase
        .from('cmc_task_plan_templates')
        .select('id,title,slug,description,stage_key,status,version,published_at,created_at,updated_at,cmc_task_plan_sections(count),cmc_task_plan_tasks(count)')
        .order('updated_at', { ascending:false });
      if (error) throw error;
      return json(200, { ok:true, templates:data || [] });
    }

    const body = JSON.parse(event.body || '{}');
    if (event.httpMethod === 'DELETE') {
      const id = String(query.id || body.id || '');
      const { error } = await supabase.from('cmc_task_plan_templates').update({ status:'archived', updated_at:new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return json(200, { ok:true });
    }

    if (body.action === 'duplicate') {
      const source = await loadTemplate(supabase, body.id);
      const title = String(body.title || `Copy of ${source.template.title}`).trim();
      return json(200, { ok:true, ...(await saveTemplate(supabase, viewer, {
        template:{ ...source.template, id:null, title, slug:`${slugify(title)}-${Date.now().toString().slice(-5)}`, status:'draft' },
        sections:source.sections
      })) });
    }

    const saved = await saveTemplate(supabase, viewer, body);
    if (body.action === 'publish') {
      const loaded = await loadTemplate(supabase, saved.template.id);
      const { data:latestVersion, error:latestVersionError } = await supabase
        .from('cmc_task_plan_template_versions')
        .select('version')
        .eq('template_id', loaded.template.id)
        .order('version', { ascending:false })
        .limit(1)
        .maybeSingle();
      if (latestVersionError) throw latestVersionError;
      const nextVersion = Number(latestVersion?.version || 0) + 1;
      const now = new Date().toISOString();
      const { data:published, error } = await supabase
        .from('cmc_task_plan_templates')
        .update({ status:'published', version:nextVersion, published_at:now, updated_at:now })
        .eq('id', loaded.template.id)
        .select('*').single();
      if (error) throw error;
      const { error:versionError } = await supabase.from('cmc_task_plan_template_versions').upsert({
        template_id:published.id,
        version:published.version,
        snapshot:snapshot(published, loaded.sections, loaded.dependencies),
        created_by:viewer.id
      }, { onConflict:'template_id,version' });
      if (versionError) throw versionError;
      saved.template = published;
    }
    return json(200, { ok:true, ...saved });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not save this task plan.' });
  }
};

async function loadTemplate(supabase, id) {
  const [templateResult, sectionResult, taskResult] = await Promise.all([
    supabase.from('cmc_task_plan_templates').select('*').eq('id', id).single(),
    supabase.from('cmc_task_plan_sections').select('*').eq('template_id', id).order('position'),
    supabase.from('cmc_task_plan_tasks').select('*').eq('template_id', id).order('position')
  ]);
  if (templateResult.error) throw templateResult.error;
  if (sectionResult.error) throw sectionResult.error;
  if (taskResult.error) throw taskResult.error;
  const taskIds = (taskResult.data || []).map(row => row.id);
  let dependencies = [];
  if (taskIds.length) {
    const dependencyResult = await supabase.from('cmc_task_plan_dependencies').select('*').in('task_id', taskIds);
    if (dependencyResult.error) throw dependencyResult.error;
    dependencies = dependencyResult.data || [];
  }
  const dependencyMap = new Map();
  dependencies.forEach(row => {
    if (!dependencyMap.has(row.task_id)) dependencyMap.set(row.task_id, []);
    dependencyMap.get(row.task_id).push(row.depends_on_task_id);
  });
  const tasksWithDependencies = (taskResult.data || []).map(task => ({
    ...task,
    dependency_client_ids:dependencyMap.get(task.id) || []
  }));
  const sections = (sectionResult.data || []).map(section => ({
    ...section,
    tasks:nestTasks(tasksWithDependencies.filter(task => task.section_id === section.id))
  }));
  return { template:templateResult.data, sections, dependencies };
}

async function saveTemplate(supabase, viewer, body) {
  const clean = cleanTemplate(body.template || body);
  const sections = cleanSections(body.sections);
  const now = new Date().toISOString();
  let template;
  if (body.template?.id || body.id) {
    const id = body.template?.id || body.id;
    const { data, error } = await supabase.from('cmc_task_plan_templates')
      .update({ ...clean, status:body.action === 'publish' ? clean.status : 'draft', updated_at:now })
      .eq('id', id).select('*').single();
    if (error) throw error;
    template = data;
    const { error:deleteError } = await supabase.from('cmc_task_plan_sections').delete().eq('template_id', id);
    if (deleteError) throw deleteError;
  } else {
    const { data, error } = await supabase.from('cmc_task_plan_templates')
      .insert({ ...clean, status:'draft', created_by:viewer.id, updated_at:now })
      .select('*').single();
    if (error) throw error;
    template = data;
  }

  const taskIds = new Map();
  const pendingDependencies = [];
  for (const section of sections) {
    const { data:sectionRow, error:sectionError } = await supabase.from('cmc_task_plan_sections').insert({
      ...(isUuid(section.client_id) ? { id:section.client_id } : {}),
      template_id:template.id, title:section.title, description:section.description, position:section.position, updated_at:now
    }).select('*').single();
    if (sectionError) throw sectionError;
    for (const task of section.tasks) {
      const { data:taskRow, error:taskError } = await supabase.from('cmc_task_plan_tasks').insert({
        ...(isUuid(task.client_id) ? { id:task.client_id } : {}),
        template_id:template.id,
        section_id:sectionRow.id,
        parent_task_id:task.parent_client_id ? taskIds.get(task.parent_client_id) || null : null,
        title:task.title,
        description:task.description,
        task_type:task.task_type,
        position:task.position,
        relative_start_days:task.relative_start_days,
        relative_due_days:task.relative_due_days,
        is_required:task.is_required,
        requires_approval:task.requires_approval,
        participant_editable:task.participant_editable,
        default_priority:task.default_priority,
        resource_url:task.resource_url,
        tags:task.tags,
        updated_at:now
      }).select('id').single();
      if (taskError) throw taskError;
      taskIds.set(task.client_id, taskRow.id);
      pendingDependencies.push({ clientId:task.client_id, dependencies:task.dependency_client_ids });
    }
  }
  const dependencyRows = pendingDependencies.flatMap(item => item.dependencies
    .filter(dependencyId => dependencyId !== item.clientId && taskIds.has(dependencyId))
    .map(dependencyId => ({ task_id:taskIds.get(item.clientId), depends_on_task_id:taskIds.get(dependencyId) }))
  );
  if (dependencyRows.length) {
    const { error } = await supabase.from('cmc_task_plan_dependencies').insert(dependencyRows);
    if (error) throw error;
  }
  return loadTemplate(supabase, template.id);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

module.exports._test = { loadTemplate, saveTemplate };
