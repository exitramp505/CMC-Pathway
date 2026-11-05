const assert=require('node:assert/strict');
const config=require('../regional-assessment-config.json');
assert.equal(config.sections.length,8);
assert.equal(config.reflections.length,8);
assert.equal(config.sections.flatMap(x=>x.questions).length,40);
assert.equal(config.sections.reduce((n,x)=>n+x.scoreMax,0),200);
console.log('Native regional assessment question parity passed.');
