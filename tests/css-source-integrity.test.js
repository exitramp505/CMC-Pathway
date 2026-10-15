const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('styles/manifest.json'));
const output=manifest.files.map(file=>read('styles/'+file)).join('');
const served=read('style.css');

// This is a strict CSS visual-parity test, across all viewports: the browser
// receives exactly the same stylesheet bytes as before the source split.
assert.equal(output,served,'The checked-in production CSS must match the ordered sources byte-for-byte');
assert.equal(manifest.files.length,15,'Keep all fifteen cascade-ordered modules represented');
assert.deepEqual([...fs.readdirSync(path.join(root,'styles')).filter(x=>x.endsWith('.css'))].sort(),
  [...manifest.files].sort(),'The manifest must account for all CSS source files');
assert.ok(served.startsWith('@import url("https://fonts.googleapis.com/css2?family=Montserrat'),
  'Keep the existing font import in its original position');
assert.match(read('styles/01-design-foundation.css'),/--cmcInk:#151616/);
assert.match(read('styles/01-design-foundation.css'),/--cmc-type-body:16px/);
assert.match(read('styles/14-final-design-contract.css'),/v143: Shared design-system contract/);
assert.match(read('STYLE-GUIDE.md'),/styles\/manifest\.json/);
console.log('CSS source integrity, shared CMC tokens and exact served-asset parity passed.');
