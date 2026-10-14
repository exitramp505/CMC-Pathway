const assert = require('node:assert/strict');
const codec = require('../lesson-content');

function expectThrows(fn, messagePattern) {
  assert.throws(fn, messagePattern);
}

const oldMarkdown = '## Apostolic foundations\n- **Multiplication**\n> Scripture quotation';
assert.equal(codec.lessonBody(oldMarkdown), oldMarkdown, 'Legacy Markdown must be returned unchanged.');
assert.equal(codec.validateContent(oldMarkdown), oldMarkdown, 'Legacy Markdown must not be wrapped or rewritten.');
assert.deepEqual(codec.lessonFormats(oldMarkdown, {lesson_type:'article'}), ['article']);
assert.match(codec.render(oldMarkdown), /<h3>Apostolic foundations<\/h3>/);
assert.match(codec.render(oldMarkdown), /<blockquote>Scripture quotation<\/blockquote>/);

const legacyVideo = {
  lesson_type:'video',
  video_url:'https://www.youtube.com/watch?v=1234567',
  image_url:'/assets/discover-apostolic-cycle.svg',
  reflection_prompt:'What will you apply?',
  resource_url:'https://example.org/handout'
};
assert.deepEqual(codec.lessonFormats(oldMarkdown, legacyVideo),
  ['article','video','image','reflection','resource'],
  'Existing lessons should infer all filled components.');

const selected = ['article','video','image','reflection'];
const stored = codec.serializeLesson(selected, oldMarkdown);
assert.ok(stored.startsWith(codec.LESSON_PREFIX));
assert.equal(codec.lessonBody(stored), oldMarkdown);
assert.deepEqual(codec.lessonFormats(stored, {lesson_type:'article'}), selected);
assert.equal(codec.render(stored), codec.render(oldMarkdown));
assert.equal(codec.validateContent(stored), stored, 'The stored multi-format envelope must round-trip.');

const emptyLesson = codec.serializeLesson(['video','reflection'], '');
assert.equal(codec.lessonBody(emptyLesson), '', 'Empty selected formats must persist.');
assert.deepEqual(codec.lessonFormats(emptyLesson, {lesson_type:'article'}), ['video','reflection']);

const formatted = codec.serializeDelta([
  {insert:'A scripture passage\n',attributes:{blockquote:true}},
  {insert:'Bold words',attributes:{bold:true}},
  {insert:'\n'}
]);
assert.deepEqual(codec.lessonFormats(codec.serializeLesson(['article','video'],formatted)), ['article','video']);
assert.match(codec.render(codec.serializeLesson(['article','video'],formatted)), /<blockquote>/);
assert.match(codec.render(codec.serializeLesson(['article','video'],formatted)), /<strong>Bold words<\/strong>/);

const injection = codec.serializeDelta([
  {insert:'Dangerous',attributes:{link:'javascript:alert(1)'}},
  {insert:'\n'}
]);
assert.ok(!codec.render(codec.serializeLesson(['article'],injection)).includes('javascript:'));
assert.match(codec.render(codec.serializeLesson(['article'],injection)), /Dangerous/);
expectThrows(() => codec.serializeLesson(['unknown'], 'content'), /supported lesson format/);
expectThrows(() => codec.serializeLesson([], 'content'), /at least one/);
expectThrows(() => codec.validateContent(codec.LESSON_PREFIX + 'broken'), /could not be read/);
expectThrows(() => codec.validateContent(
  codec.LESSON_PREFIX + JSON.stringify({formats:['article'],content:codec.LESSON_PREFIX + '{}'})
), /invalid/);
expectThrows(() => codec.serializeLesson(['article'], 'x'.repeat(codec.MAX_LENGTH)), /50,000/);

console.log('Course multi-format compatibility, safety and rendering checks passed.');
