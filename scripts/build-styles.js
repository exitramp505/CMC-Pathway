#!/usr/bin/env node
// Combine reviewed CSS modules into the one production stylesheet.
// Preserve bytes, whitespace and cascade order. Do not minify/reorder.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'styles/manifest.json'),'utf8'));
const css=manifest.files.map(filename=>{
  if(!/^[a-z0-9-]+\.css$/.test(filename))throw new Error('Unexpected stylesheet module path: '+filename);
  return fs.readFileSync(path.join(root,'styles',filename),'utf8');
}).join('');
const destination=path.join(root,'style.css');
if(process.argv.includes('--check')){
  const compiled=fs.readFileSync(destination,'utf8');
  if(compiled!==css){
    let i=0;while(i<Math.min(compiled.length,css.length)&&compiled[i]===css[i])i++;
    throw new Error('style.css differs from ordered CSS source at character '+i+
      '. Run npm run build:styles and commit style.css alongside the source files.');
  }
  console.log('CSS source parity passed: '+manifest.files.length+' modules, '+css.length+' characters, identical output.');
}else{
  fs.writeFileSync(destination,css,'utf8');
  console.log('Built style.css from '+manifest.files.length+' ordered sources ('+css.length+' characters).');
}
