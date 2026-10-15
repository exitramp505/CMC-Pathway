#!/usr/bin/env node
// Inventory repeated selectors WITHOUT attempting a dangerous cascade rewrite.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
const counts=new Map();
// A simple inventory for human review, not a CSS parser or automatic deduper.
for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const selector=match[1].trim();
  if(!selector||selector.startsWith('@')||selector.includes('/*'))continue;
  for(const name of selector.split(',').map(x=>x.trim()).filter(x=>x.startsWith('.cmc'))){
    counts.set(name,(counts.get(name)||0)+1);
  }
}
const repeated=[...counts.entries()].filter(([,n])=>n>1)
  .sort((a,b)=>b[1]-a[1]).slice(0,40).map(([selector,rules])=>({selector,rules}));
console.log(JSON.stringify({message:'Review repeat selectors in cascade context before removing any. Media and state overrides may be intentional.',repeated},null,2));
