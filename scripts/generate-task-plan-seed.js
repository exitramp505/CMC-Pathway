#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const input = process.argv[2];
const output = process.argv[3] || path.join(process.cwd(), 'supabase_task_plans_seed.sql');
if (!input) throw new Error('Usage: node scripts/generate-task-plan-seed.js input.csv [output.sql]');

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const sectionForParent = new Map(rows.filter(row => !row['Parent task'] && row['Section/Column']).map(row => [row.Name, row['Section/Column']]));
rows.forEach(row => {
  if (!row['Section/Column'] && row['Parent task']) row['Section/Column'] = sectionForParent.get(row['Parent task']) || '';
});
const templateId = uuid('cmc-task-plan:church-planting-launch-plan');
const sectionNames = [...new Set(rows.map(row => row['Section/Column']).filter(Boolean))];
const sectionIds = new Map(sectionNames.map(name => [name, uuid(`section:${name}`)]));
const taskIds = new Map(rows.map(row => [row['Task ID'], uuid(`asana-task:${row['Task ID']}`)]));
const childParents = new Set(rows.map(row => row['Parent task']).filter(Boolean));
const parentBySectionAndName = new Map();
rows.forEach(row => {
  if (!row['Parent task']) parentBySectionAndName.set(`${row['Section/Column']}::${row.Name}`, taskIds.get(row['Task ID']));
});

const lines = [
  '-- Imported CMC church planting task plan',
  '-- Generated from the historical Asana CSV. It intentionally remains a draft.',
  '-- Review legacy links, organization names, contact details, and copy before publishing.',
  'begin;',
  '',
  `insert into public.cmc_task_plan_templates (id,title,slug,description,stage_key,status,version,updated_at) values (`,
  `  '${templateId}',`,
  `  'Church Planting Launch Plan (Imported Draft)',`,
  `  'church-planting-launch-plan-imported',`,
  `  'Imported from the historical R.A.M./Asana plan. Editorial review is required before this template is published or assigned.',`,
  `  'deploy','draft',1,now()`,
  `) on conflict (id) do update set title=excluded.title, slug=excluded.slug, description=excluded.description, stage_key=excluded.stage_key, status='draft', updated_at=now();`,
  '',
  `delete from public.cmc_task_plan_sections where template_id='${templateId}';`,
  ''
];

sectionNames.forEach((name, index) => {
  lines.push(`insert into public.cmc_task_plan_sections (id,template_id,title,description,position) values ('${sectionIds.get(name)}','${templateId}',${sql(name)},'',${index});`);
});
lines.push('');

const ordered = [...rows.filter(row => !row['Parent task']), ...rows.filter(row => row['Parent task'])];
const positions = new Map();
ordered.forEach(row => {
  const section = row['Section/Column'] || sectionNames[0];
  const position = positions.get(section) || 0;
  positions.set(section, position + 1);
  const parentId = row['Parent task']
    ? parentBySectionAndName.get(`${section}::${row['Parent task']}`) || findParent(rows, taskIds, row['Parent task'])
    : null;
  const type = childParents.has(row.Name) ? 'group' : /launch in-person worship gatherings/i.test(row.Name) ? 'milestone' : 'task';
  const tags = row.Tags ? row.Tags.split(',').map(value => value.trim()).filter(Boolean) : [];
  lines.push(
    `insert into public.cmc_task_plan_tasks (id,template_id,section_id,parent_task_id,title,description,task_type,position,relative_start_days,relative_due_days,is_required,requires_approval,participant_editable,default_priority,resource_url,tags) values (` +
    `'${taskIds.get(row['Task ID'])}','${templateId}','${sectionIds.get(section)}',${parentId ? `'${parentId}'` : 'null'},${sql(row.Name)},${sql(row.Notes || '')},'${type}',${position},null,null,true,false,true,3,'',${sql(JSON.stringify(tags))}::jsonb` +
    `);`
  );
});

lines.push('', 'commit;', '');
fs.writeFileSync(output, lines.join('\n'));
console.log(`Wrote ${output}: ${rows.length} tasks across ${sectionNames.length} phases.`);

function findParent(allRows, ids, name) {
  const match = allRows.find(row => !row['Parent task'] && row.Name === name);
  return match ? ids.get(match['Task ID']) : null;
}
function sql(value) {
  const normalized = String(value ?? '').split('\n').map(line => line.trimEnd()).join('\n');
  return `'${normalized.replace(/'/g, "''")}'`;
}
function uuid(value) {
  const hex = crypto.createHash('sha1').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8','9','a','b'][parseInt(hex[16], 16) % 4];
  const text = hex.join('');
  return `${text.slice(0,8)}-${text.slice(8,12)}-${text.slice(12,16)}-${text.slice(16,20)}-${text.slice(20)}`;
}
function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); records.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  const headers = records.shift().map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header);
  return records.filter(record => record.some(Boolean)).map(record => Object.fromEntries(headers.map((header, index) => [header, record[index] || ''])));
}
