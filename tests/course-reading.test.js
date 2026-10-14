const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const course = fs.readFileSync(path.join(root, 'course.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'course.html'), 'utf8');

// Test the actual participant-only duplicate-title logic without needing a DOM dependency.
const start = course.indexOf('  function removeDuplicateLessonHeading(');
const finish = course.indexOf('\n  async function completeCurrentLesson()', start);
assert.ok(start > 0 && finish > start, 'The duplicate-title display helper should exist.');
const removeDuplicateLessonHeading = new Function(
  course.slice(start, finish) + '\nreturn removeDuplicateLessonHeading;'
)();

function heading(tagName, textContent) {
  return { tagName, textContent, removed:false, remove(){ this.removed = true; } };
}

const repeated = heading('H3', 'Welcome to Discover 101');
removeDuplicateLessonHeading({firstElementChild:repeated}, 'Welcome to Discover 101');
assert.equal(repeated.removed, true, 'A repeated introductory heading should be hidden.');

const upperCase = heading('H2', '  WELCOME   TO DISCOVER 101  ');
removeDuplicateLessonHeading({firstElementChild:upperCase}, 'Welcome to Discover 101');
assert.equal(upperCase.removed, true, 'The match should ignore case and extra whitespace.');

const unique = heading('H2', 'A Question Worth Considering');
removeDuplicateLessonHeading({firstElementChild:unique}, 'Welcome to Discover 101');
assert.equal(unique.removed, false, 'A genuine section heading must remain visible.');

const paragraph = heading('P', 'Welcome to Discover 101');
removeDuplicateLessonHeading({firstElementChild:paragraph}, 'Welcome to Discover 101');
assert.equal(paragraph.removed, false, 'Body paragraphs should never be removed.');
assert.doesNotThrow(() => removeDuplicateLessonHeading(null, 'Example'));

assert.ok(course.includes('<header class="cmcLessonHeader">'));
assert.ok(course.includes('<div class="cmcLessonMain">'));
assert.ok(course.includes('CMCLessonContent.render(lesson.content)'));
assert.ok(course.includes('reflectionHtml(lesson)'));
assert.ok(course.includes('videoHtml(lesson.video_url'));
assert.ok(course.includes('button.setAttribute(\'aria-expanded\''));
assert.ok(course.includes('button.setAttribute(\'title\', action)'));
assert.ok(course.includes('setSidebarCollapsed(!app.classList.contains(\'sidebar-collapsed\'))'));
assert.ok(course.includes('completeCurrentLesson'));
assert.ok(styles.includes('.cmcCourseBody .cmcLessonContent{'));
assert.ok(styles.includes('.cmcLessonHeader .cmcLessonHeading{'));
assert.ok(styles.includes('.cmcCourseMain .cmcCourseSidebarToggle:focus-visible{'));
assert.ok(styles.includes('@media(max-width:720px)'));
assert.ok(html.includes('course.js?v=121'), 'Course page must load the updated interaction code.');
assert.ok(html.includes('style.css?v=133'), 'Course page must load the updated styles.');

console.log('Course reading layout, sidebar control, and duplicate-heading checks passed.');
