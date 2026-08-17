#!/usr/bin/env node
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const roadmap = require('./church-planting-launch-roadmap');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth:{ persistSession:false, autoRefreshToken:false }
});
const templateId = uuid('cmc-task-plan:church-planting-launch-plan');

publish().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function publish() {
  const sections = roadmap.sections.map((section, position) => ({
    id:uuid(`section:${templateId}:${position}:${section.title}`),
    template_id:templateId,
    title:section.title,
    description:section.description,
    position
  }));
  const taskRows = [];
  roadmap.sections.forEach((section, sectionPosition) => {
    flatten(section.tasks, sections[sectionPosition], sectionPosition, taskRows);
  });

  const template = {
    id:templateId,
    title:roadmap.template.title,
    slug:roadmap.template.slug,
    description:roadmap.template.description,
    stage_key:roadmap.template.stage_key,
    status:'published',
    version:roadmap.template.version,
    published_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };

  await check(await supabase.from('cmc_task_plan_templates').upsert(template, { onConflict:'id' }));
  await check(await supabase.from('cmc_task_plan_sections').delete().eq('template_id', templateId));
  await check(await supabase.from('cmc_task_plan_sections').insert(sections));

  const groups = taskRows.filter(row => row.task_type === 'group');
  const actions = taskRows.filter(row => row.task_type !== 'group');
  await check(await supabase.from('cmc_task_plan_tasks').insert(groups));
  for (let index = 0; index < actions.length; index += 75) {
    await check(await supabase.from('cmc_task_plan_tasks').insert(actions.slice(index, index + 75)));
  }

  const snapshot = {
    template:{
      title:template.title,
      slug:template.slug,
      description:template.description,
      stage_key:template.stage_key
    },
    sections:sections.map(section => ({
      ...section,
      tasks:nest(taskRows.filter(row => row.section_id === section.id))
    })),
    dependencies:[]
  };
  await check(await supabase.from('cmc_task_plan_template_versions').upsert({
    template_id:templateId,
    version:template.version,
    snapshot,
    created_at:new Date().toISOString()
  }, { onConflict:'template_id,version' }));

  const [templateResult, sectionResult, taskResult] = await Promise.all([
    supabase.from('cmc_task_plan_templates').select('title,slug,status,version').eq('id', templateId).single(),
    supabase.from('cmc_task_plan_sections').select('*', { count:'exact', head:true }).eq('template_id', templateId),
    supabase.from('cmc_task_plan_tasks').select('*', { count:'exact', head:true }).eq('template_id', templateId)
  ]);
  check(templateResult); check(sectionResult); check(taskResult);
  console.log(JSON.stringify({
    ...templateResult.data,
    phases:sectionResult.count,
    items:taskResult.count,
    actionable_tasks:actions.length
  }, null, 2));
}

function flatten(items, section, sectionPosition, output, parentId = null) {
  items.forEach((item, position) => {
    const id = uuid(`task:${templateId}:${sectionPosition}:${parentId || 'root'}:${position}:${item.title}`);
    const due = item.relative_due_days ?? null;
    output.push({
      id,
      template_id:templateId,
      section_id:section.id,
      parent_task_id:parentId,
      title:item.title,
      description:item.description,
      task_type:item.task_type,
      position,
      relative_start_days:item.relative_start_days ?? (due === null ? null : Math.max(0, due - 21)),
      relative_due_days:due,
      is_required:item.is_required !== false,
      requires_approval:Boolean(item.requires_approval),
      participant_editable:item.participant_editable !== false,
      default_priority:Number(item.default_priority || 3),
      resource_url:item.resource_url || '',
      tags:item.tags || []
    });
    flatten(item.tasks || [], section, sectionPosition, output, id);
  });
}

function nest(rows) {
  const byId = new Map(rows.map(row => [row.id, { ...row, tasks:[] }]));
  const roots = [];
  byId.forEach(row => {
    if (row.parent_task_id && byId.has(row.parent_task_id)) byId.get(row.parent_task_id).tasks.push(row);
    else roots.push(row);
  });
  const clean = list => list.sort((a,b) => a.position - b.position).map(row => {
    const result = { ...row, tasks:clean(row.tasks) };
    delete result.template_id;
    delete result.section_id;
    delete result.parent_task_id;
    return result;
  });
  return clean(roots);
}

function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

function uuid(value) {
  const hex = crypto.createHash('sha1').update(value).digest('hex').slice(0,32).split('');
  hex[12] = '5';
  hex[16] = ['8','9','a','b'][parseInt(hex[16],16) % 4];
  const text = hex.join('');
  return `${text.slice(0,8)}-${text.slice(8,12)}-${text.slice(12,16)}-${text.slice(16,20)}-${text.slice(20)}`;
}
