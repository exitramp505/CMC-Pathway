const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const campaign=require('../netlify/functions/_annual-assessment-campaign');
const root=path.resolve(__dirname,'..');
for(const script of ['regional-assessment.js','regional-reports.js','leadership-home.js','annual-assessment-settings.js']){
  new vm.Script(fs.readFileSync(path.join(root,script),'utf8'),{filename:script});
}
for(const entry of ['annual-assessment-settings.html','national-settings.html','leadership-home.html','regional-reports.html','regional-assessment.html']){
  const html=fs.readFileSync(path.join(root,entry),'utf8');
  assert.match(html,/annual-assessment-settings/,'Annual assessment controls should be reachable: '+entry);
}
const home=fs.readFileSync(path.join(root,'leadership-home.js'),'utf8');
assert.match(home,/annual_assessment/);
assert.match(home,/data\.annual_assessment/);
assert.match(home,/annual\.status!=='submitted'/);
const national=fs.readFileSync(path.join(root,'regional-reports.html'),'utf8');
assert.match(national,/id="myRegionAssessmentAction"/);
const regionalApi=fs.readFileSync(path.join(root,'netlify/functions/regional-assessments.js'),'utf8');
assert.match(regionalApi,/\['regional_leader','cmc_admin'\]\.includes/);
assert.throws(()=>campaign.safeSettings({invitation_day:20}),/Choose February/);
assert.equal(campaign.dueDate(2026),'2027-02-28');
assert.equal(campaign.defaultYear(new Date('2027-02-15T15:00:00Z')),2026);
assert.equal(campaign.defaultYear(new Date('2026-11-05T15:00:00Z')),2026);
const east='11111111-1111-4111-8111-111111111111';
const pacific='22222222-2222-4222-8222-222222222222';
const tables={
  candidate_profiles:[
    {id:east,full_name:'East Leader',email:'east@example.org',region:'East',archived_at:null,account_role:'cmc_admin'},
    {id:pacific,full_name:'Pacific Director',email:'pacific@example.org',region:'Pacific',archived_at:null,account_role:'regional_leader'},
    {id:'33333333-3333-4333-8333-333333333333',full_name:'Viewer',email:'viewer@example.org',region:'East',archived_at:null,account_role:'cmc_viewer'}
  ],
  cmc_annual_assessment_settings:[{...campaign.DEFAULTS}],
  cmc_annual_assessment_assignments:[],
  cmc_regional_assessments:[],
  cmc_annual_assessment_emails:[]
};
class Query{
  constructor(name){this.name=name;this.filters=[];this.sort=null;this.max=null;this.operation='select';this.value=null;this.upsertOptions={};}
  select(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  is(k,v){this.filters.push(r=>r[k]===v);return this;}
  in(k,values){this.filters.push(r=>values.includes(r[k]));return this;}
  order(k,{ascending=true}={}){this.sort=[k,ascending];return this;}
  limit(n){this.max=n;return this;}
  insert(v){this.operation='insert';this.value=v;return this;}
  update(v){this.operation='update';this.value=v;return this;}
  upsert(v,opts={}){this.operation='upsert';this.value=v;this.upsertOptions=opts;return this;}
  async run(){
    const rows=tables[this.name];
    if(!rows)throw Error('Unexpected mocked table '+this.name);
    const selected=rows.filter(r=>this.filters.every(f=>f(r)));
    if(this.operation==='insert'){
      const row={id:crypto.randomUUID(),...this.value};
      if(this.name==='cmc_annual_assessment_emails'&&rows.some(x=>x.assignment_id===row.assignment_id&&x.kind===row.kind))
        return {data:null,error:{code:'23505'}};
      rows.push(row);
      return {data:row,error:null};
    }
    if(this.operation==='update'){
      selected.forEach(r=>Object.assign(r,this.value));
      return {data:selected[0]||null,error:null};
    }
    if(this.operation==='upsert'){
      const values=Array.isArray(this.value)?this.value:[this.value];
      for(const value of values){
        const conflict=this.upsertOptions.onConflict?.split(',')||['id'];
        const existing=rows.find(r=>conflict.every(key=>r[key]===value[key]));
        if(existing){if(!this.upsertOptions.ignoreDuplicates)Object.assign(existing,value);}
        else rows.push({id:crypto.randomUUID(),...value,assigned_at:'2027-02-01T13:00:00Z'});
      }
      return {data:null,error:null};
    }
    if(this.sort){const [key,asc]=this.sort;selected.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''))*(asc?1:-1));}
    return {data:this.max?selected.slice(0,this.max):selected,error:null};
  }
  async maybeSingle(){const x=await this.run();return {data:Array.isArray(x.data)?x.data[0]||null:x.data,error:x.error};}
  then(resolve,reject){return this.run().then(resolve,reject);}
}
const sb={from:name=>new Query(name)};
const priorKey=process.env.RESEND_API_KEY,priorFrom=process.env.FROM_EMAIL;
process.env.RESEND_API_KEY='test_key';
process.env.FROM_EMAIL='CMC <notifications@example.org>';
const sent=[];
async function mockSend(message,options){
  sent.push({message,options});
  return {data:{id:'test-'+sent.length}};
}
async function verify(){
  const noAction=await campaign.runCycle(sb,{now:new Date('2026-11-05T15:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(noAction.skipped,true);
  assert.equal(tables.cmc_annual_assessment_assignments.length,0);
  const first=await campaign.runCycle(sb,{now:new Date('2027-02-01T13:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(first.assigned,2,'National admin who serves a region must be included');
  assert.equal(first.initial_sent,2);
  assert.equal(tables.cmc_annual_assessment_assignments.length,2);
  assert.equal(sent.length,2);
  assert.match(sent[0].message.subject,/2026/);
  assert.ok(sent[0].message.text.includes('regional-assessment.html?year=2026'));
  const repeat=await campaign.runCycle(sb,{now:new Date('2027-02-01T15:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(repeat.created,0);
  assert.equal(repeat.initial_sent,0);
  assert.equal(sent.length,2,'Re-running the cron must not duplicate invitations');
  const adminStatus=await campaign.ownAssessmentStatus(sb,tables.candidate_profiles[0],new Date('2027-02-01T15:00:00Z'));
  assert.equal(adminStatus.assigned,true);
  assert.equal(adminStatus.reporting_year,2026);
  assert.equal(adminStatus.due_date,'2027-02-28');
  assert.equal(await campaign.ownAssessmentStatus(sb,tables.candidate_profiles[2]),null);
  tables.cmc_regional_assessments.push({id:crypto.randomUUID(),director_id:east,reporting_year:2026,status:'submitted',
    submitted_at:'2027-02-14T19:00:00Z',scores:{spiritual:20}});
  const feb15=await campaign.runCycle(sb,{now:new Date('2027-02-15T13:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(feb15.reminders_sent,1,'Only the outstanding director should get a reminder');
  assert.equal(sent.length,3);
  const secondReminder=await campaign.runCycle(sb,{now:new Date('2027-02-16T13:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(secondReminder.reminders_sent,0);
  assert.equal(sent.length,3,'Reminder must not repeat');
  const submitted=await campaign.ownAssessmentStatus(sb,tables.candidate_profiles[0],new Date('2027-02-16T13:00:00Z'));
  assert.equal(submitted.status,'submitted');
  const afterDeadline=await campaign.runCycle(sb,{now:new Date('2027-03-01T13:00:00Z'),mode:'automatic',sendImpl:mockSend});
  assert.equal(afterDeadline.skipped,true);
  console.log('February annual assessment schedule, role inclusion, task completion, invitations, and deduplicated reminders passed.');
}
verify().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
 if(priorKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=priorKey;
 if(priorFrom===undefined)delete process.env.FROM_EMAIL;else process.env.FROM_EMAIL=priorFrom;
});
