const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const access=require('../netlify/functions/_leadership-access');
const {resolveAccessChange}=require('../netlify/functions/admin-leaders')._test;
const {canSee,canEdit}=require('../netlify/functions/leadership-home')._test;
const root=path.resolve(__dirname,'..');

const admin={
 id:'admin',region:'East',account_role:'cmc_admin',
 cmc_regional_director_region:'East',cmc_national_access:'admin'
};
const nationalOnly={
 id:'national',region:'Central',account_role:'cmc_admin',
 cmc_regional_director_region:null,cmc_national_access:'admin'
};
const east={id:'east',region:'East',account_role:'regional_leader',
 cmc_regional_director_region:'East',cmc_national_access:'none'};
const pacific={id:'pacific',region:'Pacific',account_role:'regional_leader',
 cmc_regional_director_region:'Pacific',cmc_national_access:'none'};
const nationalViewer={id:'viewer',region:'East',account_role:'cmc_viewer',
 cmc_regional_director_region:null,cmc_national_access:'viewer'};
const participant={id:'member',region:'East',account_role:'participant',
 cmc_regional_director_region:null,cmc_national_access:'none',archived_at:null};

assert.equal(access.regionOf(admin),'East');
assert.equal(access.regionOf(nationalOnly),null,
  'National admin home region is not automatically a regional director assignment');
assert.equal(access.nationalOf(admin),'admin');
assert.equal(access.nationalOf(east),'none');
assert.equal(access.effectiveRole('East','viewer'),'regional_leader',
  'National reporting must not remove regional editing rights');
assert.equal(access.effectiveRole('East','admin'),'cmc_admin');
assert.equal(access.effectiveRole(null,'viewer'),'cmc_viewer');
assert.equal(access.effectiveRole(null,'none'),'participant');
assert.equal(access.leadershipAccount(nationalOnly),true);

let changed=resolveAccessChange({viewer:admin,target:participant,
 regionalRegion:'East',nationalAccess:'viewer'});
assert.equal(changed.cmc_regional_director_region,'East');
assert.equal(changed.cmc_national_access,'viewer');
assert.equal(changed.account_role,'regional_leader');
assert.equal(changed.region,'East');

changed=resolveAccessChange({viewer:admin,target:participant,
 regionalRegion:'Pacific',nationalAccess:'admin'});
assert.equal(changed.account_role,'cmc_admin');
assert.equal(changed.region,'Pacific');

changed=resolveAccessChange({viewer:admin,target:nationalOnly,
 regionalRegion:null,nationalAccess:'admin'});
assert.equal(changed.account_role,'cmc_admin');
assert.ok(!Object.hasOwn(changed,'region'),
  'National-only administration must not silently assign regional responsibility');

changed=resolveAccessChange({viewer:admin,target:east,
 regionalRegion:null,nationalAccess:'none'});
assert.equal(changed.account_role,'participant');
assert.equal(changed.cmc_regional_director_region,null);

changed=resolveAccessChange({viewer:east,target:participant,
 regionalRegion:'East',nationalAccess:'none'});
assert.equal(changed.account_role,'regional_leader');
assert.throws(()=>resolveAccessChange({viewer:east,target:participant,
 regionalRegion:'Central',nationalAccess:'none'}),/own region/i);
assert.throws(()=>resolveAccessChange({viewer:east,target:participant,
 regionalRegion:'East',nationalAccess:'viewer'}),/national administrator/i);
assert.throws(()=>resolveAccessChange({viewer:east,target:nationalOnly,
 regionalRegion:'East',nationalAccess:'none'}),/national access/i);
assert.throws(()=>resolveAccessChange({viewer:admin,target:admin,
 regionalRegion:null,nationalAccess:'none'}),/own leadership access/i);
assert.throws(()=>resolveAccessChange({viewer:admin,target:{...participant,archived_at:'2026-01-01'},
 regionalRegion:'East',nationalAccess:'none'}),/Restore/i);
assert.throws(()=>resolveAccessChange({viewer:admin,target:participant,
 regionalRegion:'Atlantis',nationalAccess:'admin'}),/valid Open Bible region/i);

const hybrid={...east,cmc_national_access:'viewer'};
const nationalTeamTask={created_by:'other',visibility:'team',region:'Central'};
const eastTeamTask={created_by:'other',visibility:'team',region:'East'};
assert.equal(canSee(hybrid,nationalTeamTask),true,
 'Dual-role regional director can view national leadership activity');
assert.equal(canEdit(hybrid,nationalTeamTask),false,
 'National reporting must not grant editing outside assigned region');
assert.equal(canEdit(hybrid,eastTeamTask),true,
 'Dual-role director must retain regional editing permissions');
assert.equal(canEdit(nationalViewer,eastTeamTask),false,
 'National reporting-only is read-only');
assert.equal(canEdit(admin,nationalTeamTask),true);
assert.equal(canEdit(east,nationalTeamTask),false);

const html=fs.readFileSync(path.join(root,'manage-leaders.html'),'utf8');
const script=fs.readFileSync(path.join(root,'manage-leaders.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'roles-access.css'),'utf8');
new vm.Script(script,{filename:'manage-leaders.js'});
for(const id of ['leaderSearch','leaderRoster','addLeaderButton','hasRegionalAccess','regionalAccessRegion',
 'leaderRegion','nationalAccessChoices','leaderAccessPreview','leaderAccessSubmit','leaderAccessForm',
 'selectLeaderDialog','accountSearch','accountPickerResults','leaderAccessDialog']){
 assert.ok(html.includes('id="'+id+'"'),'Missing functional Roles & Access control: '+id);
}
for(const choice of ['none','viewer','admin'])assert.ok(html.includes('name="nationalAccess" value="'+choice+'"'));
assert.match(script,/data-pick-person/,'Adding an existing account must be wired');
assert.match(script,/data-select-person/,'Selecting a leader must be wired');
assert.match(script,/canManageNational/,'Only authorized admins manage national permissions');
assert.match(script,/Discard your unsaved access changes/,'Changing people must not lose unsaved edits silently');
assert.match(script,/confirmChange\(/,'Privileged changes need confirmation');
assert.match(styles,/@media\(max-width:840px\)/,'Editor must stack on tablets and phones');
assert.match(styles,/@media\(max-width:520px\)/,'Mobile controls must be responsive');

const regional=fs.readFileSync(path.join(root,'netlify/functions/regional-assessments.js'),'utf8');
const campaign=fs.readFileSync(path.join(root,'netlify/functions/_annual-assessment-campaign.js'),'utf8');
assert.match(regional,/regionOf\(viewer\)/);
assert.match(regional,/nationalReporting\(viewer\)/);
assert.match(campaign,/regionOf\(p\)/);
assert.match(campaign,/regionOf\(viewer\)/);
const nav=fs.readFileSync(path.join(root,'auth.js'),'utf8');
assert.match(nav,/nationalReports\?'regional-reports\.html'/);

console.log('Dual-role authorization, region isolation, secure role editor, and mobile layout contract passed.');
