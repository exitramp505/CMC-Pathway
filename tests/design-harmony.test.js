const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const css=read('style.css');
const guide=read('STYLE-GUIDE.md');
const legacyGuide=read('TYPOGRAPHY-GUIDE.md');
const pages=fs.readdirSync(path.join(__dirname,'..')).filter(file=>file.endsWith('.html'));
const styled=pages.filter(page=>read(page).includes('style.css?v='));
assert.ok(styled.length>=30,'All user and admin pages must share the stylesheet');
for(const page of styled){
  assert.match(read(page),/style\.css\?v=143/,page+' must use the latest shared visual rules');
}
const formsCss=read('forms.css');
for(const page of pages){
  const html=read(page);
  if(html.includes('forms.css?v='))assert.match(html,/forms\.css\?v=128/,page+' must load the updated shared form styles');
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
assert.match(guide,/44×44px/);
assert.match(guide,/tablets?/i);
assert.match(guide,/16px minimum on iPhone/);
for(const page of ['login.html','signup.html','course.html','participant.html','leader.html','events.html','course-builder.html','task-plan-builder.html']){
  assert.match(read(page),/cmcPathwayBody/,page+' must use the shared design system');
}
assert.match(css,/\/\* v140: Final small-type fixes/);
assert.match(css,/\.cmcParticipantRow \.cmcPerson strong\{[\s\S]*?font-size:var\(--cmc-type-body\)/);
assert.match(css,/\.cmcParticipantStats span,[\s\S]*?font-size:var\(--cmc-type-label\)/);
assert.match(css,/\.cmcBackLink\{[\s\S]*?min-height:44px/);
assert.match(css,/\.cmcRowAction\{[\s\S]*?font-size:var\(--cmc-type-body-sm\)/);

function luminance(color){
  const rgb=[1,3,5].map(pos=>parseInt(color.slice(pos,pos+2),16)/255)
    .map(value=>value<=0.04045?value/12.92:Math.pow((value+0.055)/1.055,2.4));
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/
  (Math.min(luminance(a),luminance(b))+.05);
assert.ok(contrast('#935312','#fbf0de')>=4.5,
  'Light-panel ember text must reach WCAG AA contrast');
assert.match(css,/--cmcEmberText:#935312/);
assert.match(css,/\.cmcPathwayBody \.cmcPlanOutlinePhase strong\{[\s\S]*?font-size:var\(--cmc-type-body-sm\)/);
assert.match(css,/\.cmcPathwayBody \.cmcReorderActions button\{[\s\S]*?min-height:44px/);
assert.match(css,/\.cmcPathwayBody \.cmcInfoTip::before\{[\s\S]*?width:44px;[\s\S]*?height:44px/);
assert.match(css,/\.cmcPathwayBody \.cmcPlanSidebarToggle\{[\s\S]*?min-height:44px/);
assert.match(guide,/Contrast rule/);
assert.match(legacyGuide,/STYLE-GUIDE\.md/);


assert.match(css,/v142: Maintain ink-on-amber contrast/);
assert.ok(contrast('#151616','#f1b45f')>=4.5,
  'Primary hover background and ink text must meet WCAG AA');
assert.match(css,/\.cmcInviteButton:not\(:disabled\):is\(:hover,:focus-visible\)/);
assert.match(css,/\.authSubmitBtn:not\(:disabled\):is\(:hover,:focus-visible\)/);
assert.match(css,/\.cmcLeaderAccessForm button:not\(:disabled\):is\(:hover,:focus-visible\)/);
assert.match(css,/color:var\(--cmcInk\)!important/);


assert.match(guide,/single source of truth/i);
assert.match(guide,/Page-family reference/);
assert.match(guide,/Course reading/);
assert.match(guide,/200% text zoom/);
assert.match(css,/--cmcRadiusControl:13px/);
assert.match(css,/--cmcTouchTarget:44px/);
assert.match(css,/--cmcSageText:#236f68/);
assert.match(css,/--cmcFocusRing:2px solid var\(--cmcSage\)/);
assert.ok(contrast('#151616','#4da79c')>=4.5,
  'Ink on bright sage backgrounds must meet normal-text contrast');
assert.match(css,/\.cmcPathwayBody \.cmcSkipLink\{/);
assert.match(css,/\.cmcPathwayBody \.cmcSkipLink:focus-visible/);

console.log('Shared visual system, responsive navigation, accessible type and touch rules passed.');
