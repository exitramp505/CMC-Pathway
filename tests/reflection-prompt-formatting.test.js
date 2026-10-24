'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Codec=require('../lesson-content');
const Patch=require('../course-save-patch');

const source=[
  '**Before you begin:**',
  '',
  'Consider *one opportunity* in your community.',
  'What might you do this week?',
  '',
  'Write **a practical next step** below.'
].join('\n');
const expected=[
  '<strong>Before you begin:</strong>',
  '',
  'Consider <em>one opportunity</em> in your community.',
  'What might you do this week?',
  '',
  'Write <strong>a practical next step</strong> below.'
].join('\n');
assert.equal(Codec.renderReflectionPrompt(source),expected,
  'Single and blank lines must survive while only selected emphasis becomes markup');
assert.equal(Codec.renderReflectionPrompt(source.replace(/\n/g,'\r\n')),expected,
  'Windows-style pasted line endings should render identically');
assert.equal(Codec.renderReflectionPrompt('A\n\n\n\nB'),'A\n\n\n\nB',
  'Do not discard additional intentional paragraph spacing');
assert.equal(Codec.renderReflectionPrompt('***bold italic*** and __bold__ and _italic_'),
  '<strong><em>bold italic</em></strong> and <strong>bold</strong> and <em>italic</em>');
assert.equal(Codec.renderReflectionPrompt('file_name and \\*literal\\*'),
  'file_name and *literal*','Do not format underscores inside words or escaped delimiters');
assert.equal(Codec.renderReflectionPrompt('**Bold *and italic* phrase**'),
  '<strong>Bold <em>and italic</em> phrase</strong>');
assert.equal(Codec.renderReflectionPrompt(''),'');

const hostile='<img src=x onerror=alert(1)>\n\n**<script>alert("x")</script>** [click](javascript:alert(1)) & "text"';
const html=Codec.renderReflectionPrompt(hostile);
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(html.includes('<strong>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</strong>'));
assert.ok(html.includes('[click](javascript:alert(1))'),'Unsupported links must be literal text');
assert.ok(html.includes('&amp; &quot;text&quot;'));
assert.deepEqual(html.match(/<\/?[^>]+>/g),['<strong>','</strong>'],
  'Only hardcoded strong and em tags may be generated from author text');
assert.doesNotMatch(html,/<(?:img|script|a|iframe)\b/i);

const builder=read('course-builder.js');
const participant=read('course.js');
const editor=read('course-builder.html');
const coursePage=read('course.html');
const css=read('style.css');
assert.match(builder,/setNodeValue\(node, '\[data-lesson-reflection\]', data\.reflection_prompt\)/,
  'Reopening the Course Builder must hydrate the textarea from saved prompt text');
assert.match(builder,/reflection_prompt:lesson\.querySelector\('\[data-lesson-reflection\]'\)\.value/,
  'The Course Builder must save the unchanged, unrendered textarea string');
assert.match(editor,/data-lesson-reflection[\s\S]*?Line breaks and blank lines appear/);
assert.match(editor,/lesson-content\.js\?v=3/);
assert.match(coursePage,/lesson-content\.js\?v=3/);
assert.match(coursePage,/course\.js\?v=123/);
assert.match(coursePage,/style\.css\?v=145/);
assert.match(participant,/class="cmcReflectionPrompt">\$\{CMCLessonContent\.renderReflectionPrompt\(lesson\.reflection_prompt\)\}/);
assert.doesNotMatch(participant,/<h3>\$\{escapeHtml\(lesson\.reflection_prompt\)\}<\/h3>/);
assert.match(participant,/<p class="cmcEyebrow">REFLECT<\/p>/);
assert.match(participant,/id="lessonResponse"/);
assert.match(participant,/lesson\.response_required && !responseText/);
assert.match(participant,/body:JSON\.stringify\(\{lesson_id:lesson\.id,completed:true,response_text:responseText\}\)/);

assert.match(css,/\.cmcCourseBody \.cmcReflection \.cmcReflectionPrompt\{[\s\S]*?font:500 16px\/1\.75[\s\S]*?white-space:pre-wrap/);
assert.match(css,/\.cmcCourseBody \.cmcReflection \.cmcReflectionPrompt strong\{font-weight:750\}/);
assert.match(css,/@media\(max-width:720px\)\{\s*\.cmcCourseBody \.cmcReflection \.cmcReflectionPrompt\{font-size:16px/);
assert.match(css,/\.cmcCourseBody \.cmcReflectionResponse textarea\{font-size:16px\}/);
assert.match(css,/\.cmcReflection\{[^}]*border-left:5px solid var\(--cmcEmber\)/,
  'Retain the existing REFLECT accent treatment');

const id='11111111-1111-4111-8111-111111111111';
const courseId='22222222-2222-4222-8222-222222222222';
const moduleId='33333333-3333-4333-8333-333333333333';
const currentLesson={
  id,title:'Reflect',content:'',lesson_type:'reflection',
  reflection_prompt:'Original reflection',response_required:true,is_required:true
};
const snapshot={
  id:courseId,slug:'discover',status:'published',
  modules:[{id:moduleId,title:'Module One',lessons:[currentLesson]}]
};
const edited=structuredClone(snapshot);
edited.modules[0].lessons[0].reflection_prompt=source;
const patch=Patch.diff(snapshot,edited,7);
assert.equal(patch.expected_revision,7);
assert.deepEqual(patch.lesson_ids_to_delete,[]);
assert.deepEqual(patch.module_ids_to_delete,[]);
assert.equal(patch.lessons_upsert.length,1,'Only the edited lesson should be saved');
assert.equal(patch.lessons_upsert[0].id,id);
assert.equal(patch.lessons_upsert[0].reflection_prompt,source,
  'Saved patch must keep Markdown and internal newlines intact');
assert.equal(patch.lessons_upsert[0].response_required,true,'Response collection must remain enabled');
const reopened=structuredClone(snapshot);
reopened.modules[0].lessons[0].reflection_prompt=patch.lessons_upsert[0].reflection_prompt;
assert.equal(reopened.modules[0].lessons[0].reflection_prompt,source,
  'Reloading the saved value must reproduce the exact author input');
assert.equal(Codec.renderReflectionPrompt(reopened.modules[0].lessons[0].reflection_prompt),expected);
assert.deepEqual(Patch.diff(reopened,edited,8).lessons_upsert,[],
  'Reopening without editing must not resave or reset a reflection');
assert.equal(reopened.modules[0].lessons[0].response_required,true);

console.log('Reflection prompts: safe emphasis, exact line breaks, body typography and no-loss save/reopen checks passed.');
