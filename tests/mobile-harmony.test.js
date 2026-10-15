const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=read('style.css');
const guide=read('TYPOGRAPHY-GUIDE.md');
const pages=fs.readdirSync(root).filter(file=>file.endsWith('.html'));
const rules=css.slice(css.lastIndexOf('/* v139: Mobile/readability harmonization.'));

assert.ok(rules.startsWith('/* v139:'),'Readability refinements should remain scoped and documented.');
assert.match(css,/--cmc-type-body-sm:14px/);
assert.match(css,/--cmc-type-body:16px/);
assert.match(css,/--cmc-type-label:12px/);
assert.match(css,/--cmcSage:#4da79c/);
assert.match(rules,/\.cmcNav a,.cmcPathwayBody \.cmcNav button\{min-height:44px;font-size:var\(--cmc-type-body-sm\)/);
assert.match(rules,/\.cmcNav \.cmcNavMenu a,.cmcPathwayBody \.cmcNav \.cmcNavMenu button/);
assert.match(rules,/min-height:48px;font-size:var\(--cmc-type-body-sm\)/);
assert.match(rules,/\.cmcParticipantRow \.cmcPerson strong\{font-size:var\(--cmc-type-body\)/);
assert.match(rules,/\.cmcParticipantStats span/);
assert.match(rules,/\.cmcLeaderStats span/);
assert.match(rules,/\.cmcBackLink\{display:inline-flex;min-height:44px/);
assert.match(rules,/\.cmcRowAction\{min-height:44px;font-size:var\(--cmc-type-body-sm\)/);
assert.match(rules,/\.cmcBuilderSettings label>span/);
assert.match(rules,/\.cmcProfileFieldGrid label/);
assert.match(rules,/\.cmcPasswordToggle\{min-height:44px/);
assert.match(rules,/:focus-visible\{outline:2px solid var\(--cmcSage\)/);
assert.match(rules,/overflow-wrap:break-word/);
assert.match(rules,/overflow-wrap:anywhere/);
assert.match(guide,/at least 44 × 44px/);
assert.match(guide,/320px, 390px, 720px/);
assert.match(guide,/Form Label \/ Body roles|Form Label|Form labels use Small body/);

let styled=0;
for(const page of pages){
  const html=read(page);
  if(/style\.css\?v=/.test(html)){
    styled++;
    assert.match(html,/style\.css\?v=139/,page+' should use the same CMC CSS release');
    assert.doesNotMatch(html,/style\.css\?v=138/,page+' should not load a stale version');
  }
}
assert.ok(styled>=30,'Site-wide stylesheet should be consistently applied');
console.log('Mobile harmony typography, focus, tap targets, and page consistency tests passed on '+styled+' pages.');
