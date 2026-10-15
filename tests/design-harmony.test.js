const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const css=read('style.css');
const guide=read('TYPOGRAPHY-GUIDE.md');
const pages=fs.readdirSync(path.join(__dirname,'..')).filter(file=>file.endsWith('.html'));
const styled=pages.filter(page=>read(page).includes('style.css?v='));
assert.ok(styled.length>=30,'All user and admin pages must share the stylesheet');
for(const page of styled){
  assert.match(read(page),/style\.css\?v=139/,page+' must use the latest shared visual rules');
}
const formsCss=read('forms.css');
for(const page of pages){
  const html=read(page);
  if(html.includes('forms.css?v='))assert.match(html,/forms\.css\?v=127/,page+' must load the updated shared form styles');
}
assert.match(formsCss,/\.cmcFormBody \.cmcFormHero>p:not\(\.cmcEyebrow\)/);
assert.match(formsCss,/font-size:var\(--cmc-type-body\)/);
assert.match(css,/--cmc-type-body:16px/);
assert.match(css,/--cmc-space-4:16px/);
assert.match(css,/--cmcSand:#fbf0de/);
assert.match(css,/@media \(min-width:721px\) and \(max-width:1080px\)/);
assert.match(css,/\.cmcNav:not\(\.cmcAuthNav\)\.cmcNavOpen \.cmcNavMenu/);
assert.match(css,/\.cmcHeader \.cmcAuthNav>a/);
assert.match(css,/\.cmcLeaderStats span,[\s\S]*?font-size:var\(--cmc-type-label\)/);
assert.match(css,/\.cmcWebsiteTabs button,[\s\S]*?scroll-snap-align:start/);
assert.match(css,/\.cmcLessonHeader \.cmcLessonSummary\{[\s\S]*?font-size:var\(--cmc-type-body\)/);
assert.match(css,/\.cmcReviewDialogClose\{min-width:44px;min-height:44px\}/);
assert.match(css,/\.cmcPlanPhaseDots button\.active\{[\s\S]*?width:44px/);
assert.match(css,/env\(safe-area-inset-bottom\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(guide,/44 × 44px touch target/);
assert.match(guide,/tablets?/i);
assert.match(guide,/Inputs, selects, and textareas should use Body/);
for(const page of ['login.html','signup.html','course.html','participant.html','leader.html','events.html','course-builder.html','task-plan-builder.html']){
  assert.match(read(page),/cmcPathwayBody/,page+' must use the shared design system');
}
console.log('Shared visual system, responsive navigation, accessible type and touch rules passed.');
