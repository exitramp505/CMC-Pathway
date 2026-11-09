const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../auth.js'),'utf8'),context);
const items=profile=>JSON.parse(JSON.stringify(context.window.dcAuth.roleNavigationItems(profile)));
const keys=profile=>items(profile).map(item=>item.key);
const regional={account_role:'regional_leader',cmc_national_access:'none'};
const viewer={account_role:'cmc_viewer',cmc_national_access:'viewer'};
const admin={account_role:'cmc_admin',cmc_national_access:'admin',cmc_regional_director_region:'East'};
assert.deepEqual(keys({account_role:'participant'}),['pathway']);
assert.deepEqual(keys(null),['pathway']);
assert.deepEqual(keys({account_role:'participant',is_coach:true}),['pathway','coaching']);
assert.deepEqual(keys(regional),['home','people','health','pathway','events','team']);
assert.deepEqual(keys(viewer),['home','health']);
assert.deepEqual(keys({...regional,cmc_national_access:'viewer'}),keys(regional));
assert.equal(items(regional).find(i=>i.key==='health').href,'regional-assessment.html');
assert.equal(items({...regional,cmc_national_access:'viewer'}).find(i=>i.key==='health').href,'regional-reports.html');
assert.deepEqual(keys(admin),['home','people','health','pathway','events','plans','courses','website','team','settings']);
assert.deepEqual(items(admin).filter(i=>!i.group).map(i=>i.label),['Home','People','Regional Health','My Pathway']);
assert.deepEqual(items(admin).filter(i=>i.group==='Planning').map(i=>i.label),['Events','Task Plans']);
assert.deepEqual(items(admin).filter(i=>i.group==='Content').map(i=>i.label),['Courses','Website']);
assert.deepEqual(items(admin).filter(i=>i.group==='Administration').map(i=>i.label),['Team','National Settings']);
assert.equal(items({account_role:'participant'}).find(i=>i.key==='pathway').href,'dashboard.html');
assert.equal(items(admin).find(i=>i.key==='pathway').href,'dashboard.html?view=participant');
assert.equal(items({account_role:'cmc_admin'}).find(i=>i.key==='health').href,'regional-reports.html','Legacy administrator profiles retain reporting');
// A mismatched legacy role must not expose tools whose page/API guards reject it.
assert.ok(!keys({...regional,cmc_national_access:'admin'}).includes('settings'));
for(const profile of [null,{},regional,viewer,admin,{account_role:'participant',is_coach:true}]){
 for(const item of items(profile))assert.ok(fs.existsSync(path.join(__dirname,'..',item.href.split('?')[0])),item.href);
}
console.log('Navigation role matrix, dual-role reporting, coach access, grouping and route targets passed.');
