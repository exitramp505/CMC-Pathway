const assert=require('node:assert/strict');
const bank=require('../ministry-style-v2-bank.js');
const {scoreMinistryStyleV2}=require('../netlify/functions/_ministry-style-v2.js');
assert.equal(bank.VERSION,2);
assert.equal(bank.ITEMS.length,64);
assert.equal(new Set(bank.ITEMS.map(q=>q.id)).size,64);
assert.deepEqual(bank.STYLES,['pioneer','mobilizer','shepherd','steward']);
for(const style of bank.STYLES){
 assert.equal(bank.ITEMS.filter(q=>q.style===style&&q.kind==='agreement').length,12);
 assert.equal(bank.ITEMS.filter(q=>q.style===style&&q.kind==='ease').length,4);
}
const baseline=Object.fromEntries(bank.ITEMS.map(q=>[q.id,3]));
const neutral=scoreMinistryStyleV2(baseline);
assert.equal(neutral.instrumentVersion,2);
for(const style of bank.STYLES){assert.equal(neutral.agreement[style],50);assert.equal(neutral.ease[style],50);}
assert.equal(neutral.completedSets,64);
const favorable=Object.fromEntries(bank.ITEMS.map(q=>[q.id,q.kind==='agreement'&&q.style==='pioneer'?(q.reverse?1:5):3]));
const scored=scoreMinistryStyleV2(favorable);
assert.equal(scored.primaryStyle,'pioneer');
assert.equal(scored.agreement.pioneer,100);
assert.equal(scored.ease.pioneer,50);
assert.ok(scored.domainPatterns.some(d=>d.name==='Church multiplication'));
assert.ok(scored.domainPatterns.every(d=>Object.values(d.patterns).every(v=>v===null||v>=0&&v<=100)));
const changedEase={...favorable};
for(const q of bank.ITEMS.filter(q=>q.style==='shepherd'&&q.kind==='ease'))changedEase[q.id]=5;
const afterEase=scoreMinistryStyleV2(changedEase);
assert.deepEqual(afterEase.agreement,scored.agreement,'Ease ratings must not distort style preferences');
assert.ok(afterEase.ease.shepherd>scored.ease.shepherd);
assert.throws(()=>scoreMinistryStyleV2({...favorable,A01:0}),/answer every inventory/i);
assert.throws(()=>scoreMinistryStyleV2({...favorable,unknown:5}),/unknown response/i);
const incomplete={...favorable};delete incomplete.E16;
assert.throws(()=>scoreMinistryStyleV2(incomplete),/answer every inventory/i);
console.log('Ministry Style Inventory v2 scoring tests passed.');
