const { httpError } = require('./_auth');

const STAGES = new Set(['discover', 'discern', 'develop', 'deploy']);
const STATUSES = new Set(['draft', 'published', 'archived']);
const TASK_TYPES = new Set(['group', 'task', 'milestone']);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'task-plan';
}

function cleanTemplate(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) throw httpError(400, 'Add a task plan title.');
  const stageKey = STAGES.has(input.stage_key) ? input.stage_key : 'deploy';
  const status = STATUSES.has(input.status) ? input.status : 'draft';
  return {
    title,
    slug:slugify(input.slug || title),
    description:String(input.description || '').trim(),
    stage_key:stageKey,
    status
  };
}

function cleanSections(input) {
  const sections = Array.isArray(input) ? input : [];
  return sections.map((section, sectionIndex) => {
    const title = String(section.title || '').trim();
    if (!title) throw httpError(400, `Add a title to phase ${sectionIndex + 1}.`);
    const tasks = flattenTasks(section.tasks, null, sectionIndex);
    return {
      client_id:String(section.client_id || section.id || `section-${sectionIndex}`),
      title,
      description:String(section.description || '').trim(),
      position:sectionIndex,
      tasks
    };
  });
}

function flattenTasks(tasks, parentClientId, sectionIndex, output = []) {
  (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
    const title = String(task.title || '').trim();
    if (!title) throw httpError(400, `Add a title to every task in phase ${sectionIndex + 1}.`);
    const clientId = String(task.client_id || task.id || `task-${sectionIndex}-${output.length}`);
    const type = TASK_TYPES.has(task.task_type) ? task.task_type : 'task';
    output.push({
      client_id:clientId,
      parent_client_id:parentClientId,
      title,
      description:String(task.description || '').trim(),
      task_type:type,
      position:index,
      relative_start_days:nullableInteger(task.relative_start_days),
      relative_due_days:nullableInteger(task.relative_due_days),
      is_required:task.is_required !== false,
      requires_approval:Boolean(task.requires_approval),
      participant_editable:task.participant_editable !== false,
      default_priority:boundedInteger(task.default_priority, 1, 5, 3),
      resource_url:safeUrl(task.resource_url),
      tags:Array.isArray(task.tags) ? task.tags.map(String).slice(0, 20) : [],
      dependency_client_ids:Array.isArray(task.dependency_client_ids)
        ? [...new Set(task.dependency_client_ids.map(String).filter(Boolean))]
        : []
    });
    flattenTasks(task.tasks, clientId, sectionIndex, output);
  });
  return output;
}

function nullableInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function boundedInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function safeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch (_) {
    return '';
  }
}

function nestTasks(rows) {
  const byId = new Map((rows || []).map(row => [row.id, { ...row, tasks:[] }]));
  const roots = [];
  byId.forEach(task => {
    if (task.parent_task_id && byId.has(task.parent_task_id)) byId.get(task.parent_task_id).tasks.push(task);
    else roots.push(task);
  });
  const sort = list => list.sort((a, b) => a.position - b.position).map(item => ({ ...item, tasks:sort(item.tasks) }));
  return sort(roots);
}

function snapshot(template, sections, dependencies = []) {
  return {
    template:{
      title:template.title,
      slug:template.slug,
      description:template.description,
      stage_key:template.stage_key
    },
    sections,
    dependencies
  };
}

function addDays(dateValue, offset) {
  if (!dateValue || offset === null || offset === undefined) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(offset));
  return date.toISOString().slice(0, 10);
}

module.exports = { addDays, cleanSections, cleanTemplate, nestTasks, slugify, snapshot };
