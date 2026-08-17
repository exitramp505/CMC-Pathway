const assert = require('assert');
const { addDays, cleanSections, cleanTemplate, nestTasks, slugify } = require('../netlify/functions/_task-plans');
const { nextTask, taskUpdates, validDate } = require('../netlify/functions/task-plan-assignments')._test;

assert.equal(slugify('  Church Planting: Launch Plan! '), 'church-planting-launch-plan');
assert.deepEqual(cleanTemplate({ title:'Launch Plan', stage_key:'deploy', status:'published' }), {
  title:'Launch Plan', slug:'launch-plan', description:'', stage_key:'deploy', status:'published'
});
assert.equal(addDays('2026-08-14', 30), '2026-09-13');
assert.equal(addDays('2026-08-14', null), null);

const sections = cleanSections([{
  client_id:'phase-a', title:'Getting Started', tasks:[{
    client_id:'group-a', title:'Clarify the call', task_type:'group', tasks:[{
      client_id:'task-a', title:'Meet with a leader', relative_due_days:'14', default_priority:1,
      resource_url:'https://example.org/resource', dependency_client_ids:['task-before','task-before']
    }]
  }]
}]);
assert.equal(sections[0].tasks.length, 2);
assert.equal(sections[0].tasks[1].parent_client_id, 'group-a');
assert.equal(sections[0].tasks[1].relative_due_days, 14);
assert.deepEqual(sections[0].tasks[1].dependency_client_ids, ['task-before']);

const nested = nestTasks([
  { id:'child', parent_task_id:'parent', position:0 },
  { id:'parent', parent_task_id:null, position:1 },
  { id:'first', parent_task_id:null, position:0 }
]);
assert.deepEqual(nested.map(item => item.id), ['first','parent']);
assert.equal(nested[1].tasks[0].id, 'child');

assert.equal(nextTask([
  { title:'Later', task_type:'task', status:'not_started', priority:3, due_date:'2026-09-01' },
  { title:'First', task_type:'task', status:'not_started', priority:1, due_date:'2026-10-01' },
  { title:'Awaiting approval', task_type:'task', status:'pending_review', priority:1, due_date:'2026-08-15' },
  { title:'Done', task_type:'task', status:'completed', priority:1, due_date:'2026-08-01' }
]).title, 'First');
assert.equal(nextTask([
  { title:'Blocked first', task_type:'task', status:'blocked', priority:1, due_date:'2026-08-15', blocked_by_dependency:true },
  { title:'Ready second', task_type:'task', status:'not_started', priority:2, due_date:'2026-08-16', blocked_by_dependency:false }
]).title, 'Ready second');
assert.equal(validDate('2026-08-14'), true);
assert.equal(validDate('08/14/2026'), false);
const completionUpdate = taskUpdates({ title:' Revised ', priority:8, status:'completed', due_date:'2026-09-01' }, true);
assert.equal(completionUpdate.title, 'Revised');
assert.equal(completionUpdate.status, 'completed');
assert.match(completionUpdate.completed_at, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(completionUpdate.due_date, '2026-09-01');
assert.equal(completionUpdate.priority, 3);

console.log('Task plan tests passed.');
