const assert = require('node:assert/strict');
const Patch = require('../course-save-patch');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../course-builder.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../course-builder.js'), 'utf8');
for (const id of ['retrySaveBtn', 'reloadCourseBtn', 'autosaveStatus']) {
  assert.match(html, new RegExp('id="' + id + '"'), 'Course Builder must render ' + id);
}
assert.match(html, /course-save-patch\.js\?v=1/, 'Course Builder must load safe patch helper.');
assert.ok(script.includes("document.getElementById('retrySaveBtn')"), 'Retry button must be handled.');
assert.doesNotThrow(() => new Function(script), 'Course Builder JavaScript should parse.');


const a = '11111111-1111-4111-8111-111111111111';
const m1 = '22222222-2222-4222-8222-222222222222';
const m2 = '33333333-3333-4333-8333-333333333333';
const l1 = '44444444-4444-4444-8444-444444444444';
const l2 = '55555555-5555-4555-8555-555555555555';
function lesson(id,title, content) {
  return {
    id, title,summary:'',lesson_type:'article',content,video_url:'',
    image_url:'',image_alt:'',resource_url:'',resource_label:'',
    reflection_prompt:'',response_required:false,estimated_minutes:5,is_required:true
  };
}
function course() {
  return {
    id:a,title:'Discover',subtitle:'Start here',slug:'discover',description:'Test',
    stage_key:'discover',access_mode:'assigned',navigation_mode:'open',
    status:'draft',estimated_minutes:15,
    modules:[
      { id:m1,title:'Module 1',description:'',lessons:[
        lesson(l1,'Introduction','## Welcome\nLegacy Markdown'),
        lesson(l2,'Teach','cmc:delta:v1:[{"insert":"Bold\\n","attributes":{"bold":true}}]')
      ]},
      { id:m2,title:'Module 2',description:'',lessons:[] }
    ]
  };
}

const original=course();
const noChange=Patch.diff(original,structuredClone(original),4);
assert.equal(Patch.hasChanges(noChange),false,'No change should not write to the database.');
assert.deepEqual(noChange.lessons_upsert,[]);
assert.deepEqual(noChange.modules_upsert,[]);

const edited=structuredClone(original);
edited.modules[0].lessons[0].content += '\nAdditional teaching.';
let p=Patch.diff(original,edited,4);
assert.equal(p.expected_revision,4);
assert.equal(p.save_version,2);
assert.equal(p.lessons_upsert.length,1,'Only one edited lesson is sent.');
assert.equal(p.lessons_upsert[0].id,l1);
assert.equal(p.modules_upsert.length,0,'Unchanged modules are not written.');
assert.deepEqual(p.course,{});

const metadata=structuredClone(original);
metadata.title='Discover More';
p=Patch.diff(original,metadata,4);
assert.deepEqual(p.course,{title:'Discover More'});
assert.deepEqual(p.lessons_upsert,[]);

const reordered=structuredClone(original);
reordered.modules.reverse();
reordered.modules[0].lessons.push(reordered.modules[1].lessons.pop());
p=Patch.diff(original,reordered,4);
assert.equal(p.modules_upsert.length,2,'Moving a module updates its position.');
assert.equal(p.lessons_upsert.length,1,'Moving a lesson updates its module.');
assert.equal(p.lessons_upsert[0].module_id,m2);

const removed=structuredClone(original);
removed.modules[0].lessons.shift();
p=Patch.diff(original,removed,4);
assert.deepEqual(p.lesson_ids_to_delete,[l1]);

const newCourse=course();
p=Patch.diff(null,newCourse,0);
assert.equal(p.modules_upsert.length,2,'New course sends all modules.');
assert.equal(p.lessons_upsert.length,2,'New course sends all lessons.');
assert.equal(p.course.slug,'discover');
assert.ok(Patch.hasChanges(p));

assert.throws(()=>Patch.diff(original,edited,-1),/revision/i);
const duplicate=course();
duplicate.modules.push(structuredClone(duplicate.modules[0]));
assert.throws(()=>Patch.diff(original,duplicate,4),/Duplicate/i);

console.log('Atomic course patch and changed-only autosave regression tests passed.');
