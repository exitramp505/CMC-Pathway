const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const misses = [];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  const tagPattern = /<(?:a|link|script|img)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    let dest = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|data:|blob:|\/\/|#)/i.test(dest)) continue;
    if (dest.includes('$'+'{') || dest.includes('{'+'{')) continue;
    dest = dest.split(/[?#]/,1)[0];
    if (!dest || dest.startsWith('/.netlify/') || dest === '/') continue;
    if (!/\.(?:html|js|css|svg|png|jpe?g|webp|gif|ico|pdf|json|woff2?)$/i.test(dest)) continue;
    const absolute = path.resolve(root, dest.replace(/^\//,''));
    if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) {
      misses.push(page + ' -> ' + match[1]);
    }
  }
}
assert.deepEqual(misses, [], 'Broken same-site asset/page links found:\n' + misses.join('\n'));
console.log('All static same-site asset and page links exist.');
