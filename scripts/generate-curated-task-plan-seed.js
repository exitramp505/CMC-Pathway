#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const roadmap = require('./church-planting-launch-roadmap');

const output = process.argv[2] || path.join(process.cwd(), 'supabase_task_plans_seed.sql');
const templateId = uuid('cmc-task-plan:church-planting-launch-plan');
const taskRows = [];
const sectionRows = [];
const dependencies = [];

roadmap.sections.forEach((section, sectionPosition) => {
  const sectionId = uuid(`section:${templateId}:${sectionPosition}:${section.title}`);
  sectionRows.push({ ...section, id:sectionId, position:sectionPosition });
  flatten(section.tasks, { sectionId, sectionPosition });
});

const snapshotSections = sectionRows.map(section => ({
  id:section.id,
  title:section.title,
  description:section.description,
  position:section.position,
  tasks:nestForSnapshot(taskRows.filter(row => row.section_id === section.id))
}));
const snapshot = {
  template:{
    title:roadmap.template.title,
    slug:roadmap.template.slug,
    description:roadmap.template.description,
    stage_key:roadmap.template.stage_key
  },
  sections:snapshotSections,
  dependencies
};

const lines = [
  '-- Curated CMC church planting launch roadmap',
  '-- Replaces the historical R.A.M./Asana import with a current, customizable CMC template.',
  '-- Re-running this file updates only the master template. Existing participant copies are preserved.',
  'begin;',
  '',
  `insert into public.cmc_task_plan_templates (id,title,slug,description,stage_key,status,version,published_at,updated_at) values (`,
  `  '${templateId}',`,
  `  ${sql(roadmap.template.title)},`,
  `  ${sql(roadmap.template.slug)},`,
  `  ${sql(roadmap.template.description)},`,
  `  ${sql(roadmap.template.stage_key)},${sql(roadmap.template.status)},${roadmap.template.version},now(),now()`,
  `) on conflict (id) do update set title=excluded.title, slug=excluded.slug, description=excluded.description, stage_key=excluded.stage_key, status=excluded.status, version=excluded.version, published_at=coalesce(public.cmc_task_plan_templates.published_at,now()), updated_at=now();`,
  '',
  `delete from public.cmc_task_plan_sections where template_id='${templateId}';`,
  ''
];

sectionRows.forEach(section => {
  lines.push(`insert into public.cmc_task_plan_sections (id,template_id,title,description,position) values ('${section.id}','${templateId}',${sql(section.title)},${sql(section.description)},${section.position});`);
});
lines.push('');

taskRows.forEach(row => {
  lines.push(`insert into public.cmc_task_plan_tasks (id,template_id,section_id,parent_task_id,title,description,task_type,position,relative_start_days,relative_due_days,is_required,requires_approval,participant_editable,default_priority,resource_url,tags) values (` +
    `'${row.id}','${templateId}','${row.section_id}',${row.parent_task_id ? `'${row.parent_task_id}'` : 'null'},${sql(row.title)},${sql(row.description)},${sql(row.task_type)},${row.position},${nullable(row.relative_start_days)},${nullable(row.relative_due_days)},${boolean(row.is_required)},${boolean(row.requires_approval)},${boolean(row.participant_editable)},${row.default_priority},${sql(row.resource_url || '')},${sql(JSON.stringify(row.tags || []))}::jsonb` +
    `);`);
});

lines.push('');
dependencies.forEach(row => lines.push(`insert into public.cmc_task_plan_dependencies (task_id,depends_on_task_id) values ('${row.task_id}','${row.depends_on_task_id}');`));
lines.push(
  '',
  `insert into public.cmc_task_plan_template_versions (template_id,version,snapshot,created_at) values ('${templateId}',${roadmap.template.version},${sql(JSON.stringify(snapshot))}::jsonb,now())`,
  `on conflict (template_id,version) do update set snapshot=excluded.snapshot, created_at=now();`,
  '',
  'commit;',
  ''
);

fs.writeFileSync(output, lines.join('\n'));
console.log(`Wrote ${output}: ${taskRows.length} items across ${sectionRows.length} phases (${taskRows.filter(row => row.task_type !== 'group').length} actionable tasks).`);

function flatten(tasks, context, parentId = null) {
  tasks.forEach((item, position) => {
    const identity = `${context.sectionPosition}:${parentId || 'root'}:${position}:${item.title}`;
    const id = uuid(`task:${templateId}:${identity}`);
    const due = item.relative_due_days ?? null;
    const row = {
      ...item,
      id,
      section_id:context.sectionId,
      parent_task_id:parentId,
      position,
      relative_start_days:item.relative_start_days ?? (due === null ? null : Math.max(0, due - 21)),
      relative_due_days:due,
      is_required:item.is_required !== false,
      requires_approval:Boolean(item.requires_approval),
      participant_editable:item.participant_editable !== false,
      default_priority:Number(item.default_priority || 3),
      resource_url:item.resource_url || '',
      tags:item.tags || []
    };
    delete row.tasks;
    taskRows.push(row);
    flatten(item.tasks || [], context, id);
  });
}

function nestForSnapshot(rows) {
  const byId = new Map(rows.map(row => [row.id, { ...row, tasks:[] }]));
  const roots = [];
  byId.forEach(row => {
    if (row.parent_task_id && byId.has(row.parent_task_id)) byId.get(row.parent_task_id).tasks.push(row);
    else roots.push(row);
  });
  const clean = list => list.sort((a,b) => a.position - b.position).map(row => {
    const copy = { ...row, tasks:clean(row.tasks) };
    delete copy.section_id;
    delete copy.parent_task_id;
    return copy;
  });
  return clean(roots);
}

function sql(value) { return `'${String(value ?? '').replace(/'/g, "''")}'`; }
function nullable(value) { return Number.isInteger(value) ? String(value) : 'null'; }
function boolean(value) { return value ? 'true' : 'false'; }
function uuid(value) {
  const hex = crypto.createHash('sha1').update(value).digest('hex').slice(0,32).split('');
  hex[12] = '5';
  hex[16] = ['8','9','a','b'][parseInt(hex[16],16) % 4];
  const text = hex.join('');
  return `${text.slice(0,8)}-${text.slice(8,12)}-${text.slice(12,16)}-${text.slice(16,20)}-${text.slice(20)}`;
}
