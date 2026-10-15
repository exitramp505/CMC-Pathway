const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const guide=read('STYLE-GUIDE.md');
const oldGuide=read('TYPOGRAPHY-GUIDE.md');
const css=read('style.css');
const formCss=read('forms.css');
const pages=fs.readdirSync(root).filter(file=>file.endsWith('.html'));
const styled=pages.filter(page=>read(page).includes('style.css?v='));
assert.ok(styled.length>=30,'All CMC participant and administrator pages should use shared styles');
assert.match(guide,/Single source of truth/i);
assert.match(guide,/Brand colors and their jobs/);
assert.match(guide,/Typography: one family, named roles/);
assert.match(guide,/Page-family reference/);
assert.match(guide,/Responsive and accessible behavior/);
assert.match(oldGuide,/\[CMC Pathway Style Guide\]\(STYLE-GUIDE\.md\)/);
const tokens={
  '--cmcInk':'#151616','--cmcSlate':'#293d48','--cmcSlate2':'#20323b',
  '--cmcSand':'#fbf0de','--cmcPaper':'#fffaf1',
  '--cmcEmber':'#ea9f43','--cmcEmberText':'#935312',
  '--cmcSage':'#4da79c','--cmcSageText':'#236f68',
  '--cmcTextMuted':'#607078',
  '--cmcRadiusControl':'13px','--cmcRadiusCard':'24px',
  '--cmcRadiusHero':'32px','--cmcTouchTarget':'44px',
  '--cmc-type-body-sm':'14px','--cmc-type-body':'16px',
  '--cmc-space-4':'16px','--cmc-space-5':'24px'
};
for(const [token,value] of Object.entries(tokens)){
  assert.ok(css.includes(token+':'+value),token+' must retain the documented foundation value');
  assert.ok(guide.includes(String.fromCharCode(96)+token+String.fromCharCode(96)),
    token+' must be documented in STYLE-GUIDE.md');
}
assert.match(formCss,/--formText:var\(--cmcSlate\)/);
assert.match(formCss,/--formMuted:var\(--cmcTextMuted\)/);
assert.match(formCss,/--formLine:var\(--cmcBorder\)/);
assert.match(formCss,/--formSurface:var\(--cmcPaper\)/);
for(const page of styled){
  const html=read(page);
  assert.match(html,/style\.css\?v=144/,page+' must use the current shared CSS');
  assert.match(html,/<body[^>]*class="[^"]*\bcmcPathwayBody\b/i,
    page+' must use the CMC design shell');
  assert.match(html,/class="cmcSkipLink" href="#main-content"/,
    page+' must include a keyboard skip link');
  assert.equal((html.match(/id="main-content"/g)||[]).length,1,
    page+' must have exactly one main-content target');
  assert.match(html,/<main id="main-content" tabindex="-1"/,
    page+' must support focus transfer into content');
  assert.ok(html.indexOf('class="cmcSkipLink"')<html.indexOf('<header'),
    page+' skip link must precede header navigation');
  if(html.includes('forms.css?v=')){
    assert.match(html,/forms\.css\?v=128/,page+' must use the current form styles');
  }
}
assert.match(css,/\.cmcPathwayBody \.cmcSkipLink:focus-visible/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/\/\* v143: Shared design-system contract/);
function luminance(hex){
  const parts=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return parts[0]*0.2126+parts[1]*0.7152+parts[2]*0.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
assert.ok(contrast('#151616','#4da79c')>=4.5,'Ink on bright sage should be readable');
assert.ok(contrast('#935312','#fbf0de')>=4.5,'Light-panel amber should be readable');
assert.ok(contrast('#151616','#ea9f43')>=4.5,'Ink on amber should be readable');
assert.match(css,/\.cmcStageCard\.complete>a/,'Sage actions should use readable ink');
console.log('CMC design system: one guide, shared pages, tokens and contrast passed.');
