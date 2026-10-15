'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cfg=fs.readFileSync(path.join(__dirname,'../netlify.toml'),'utf8');
assert.match(cfg,/\[functions\."public-site-content"\]\s*node_bundler\s*=\s*"esbuild"/);
assert.doesNotMatch(cfg,/\[functions\]\s*node_bundler\s*=\s*"esbuild"/,
 'Do not switch private handlers without separate validation');
const handler=require('../netlify/functions/public-site-content').handler;
(async()=>{
 const bad=await handler({httpMethod:'POST'});
 assert.equal(bad.statusCode,405);
 assert.equal(JSON.parse(bad.body).ok,false);
 const unknown=await handler({httpMethod:'GET',queryStringParameters:{key:'no-such-content'}});
 assert.equal(unknown.statusCode,400);
 console.log('Read-only esbuild candidate: JS handler API and restricted routes smoke tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
