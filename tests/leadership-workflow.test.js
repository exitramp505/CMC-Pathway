const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

// Catch syntax regressions and missing controls even when no browser is running.
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'leadership-home.js'),'utf8');
const html=fs.readFileSync(path.join(root,'leadership-home.html'),'utf8');
new vm.Script(script,{filename:'leadership-home.js'});
for(const id of ['homeMessage','newMeeting','newReminder','viewAllMeetings','meetingSearch','upcomingList','reminderList','meetingList',
  'itemId','itemKind','itemTitle','itemRegion','itemStart','itemDue','itemVisibility','itemAssignee','itemMeeting','itemBody','itemNotes',
  'itemDecisions','meetingFollowups','addMeetingFollowup','meetingFollowupList','leadershipForm','leadershipEditor','saveItem','deleteItem',
  'closeEditor','cancelEditor','homeToast','peopleSummary','activityScope','leadershipGreeting','leadershipRegion','homeToday',
  'openActionsCount','upcomingMeetingsCount','upcomingEventsCount','mineTaskCount','teamTaskCount','editorMessage','editorDescription',
  'editorTitle','bodyLabel','agendaRow','meetingDateRow','dueDateRow','visibilityRow','notesRow','decisionsRow','assigneeRow',
  'parentMeetingRow','regionRow','eventCaveat','allEventsLink','nextMeeting']){
  assert.match(html,new RegExp('id=["\x27]'+id+'["\x27]'),'Missing dashboard control: '+id);
}
assert.match(script,/data-task-filter/,'Task filters must be wired');
assert.match(script,/data-toggle/,'Task completion must be wired');
assert.match(script,/data-related-task/,'Meeting follow-ups must open');
assert.match(script,/loadPeople\(\)/,'People card must use real participant information');
assert.match(script,/starts_at:isMeeting\?new Date/,'Meeting start must be serialized');
assert.match(html,/rel="icon" type="image\/svg\+xml" href="cmc-logo-mark\.svg"/);

// Mock the authenticated Supabase backend to test a full meeting/action lifecycle.
const authPath=require.resolve('../netlify/functions/_auth');
const prior=require.cache[authPath];
const adminId='11111111-1111-4111-8111-111111111111';
const eastId='22222222-2222-4222-8222-222222222222';
const westId='33333333-3333-4333-8333-333333333333';
const presidentId='44444444-4444-4444-8444-444444444444';
let actor=adminId;
const tables={
  candidate_profiles:[
    {id:adminId,full_name:'National Admin',account_role:'cmc_admin',region:'East'},
    {id:eastId,full_name:'East Director',account_role:'regional_leader',region:'East'},
    {id:westId,full_name:'Pacific Director',account_role:'regional_leader',region:'Pacific'},
    {id:presidentId,full_name:'President',account_role:'cmc_viewer',region:null}
  ],
  cmc_events:[],
  cmc_leadership_items:[]
};
class Query{
  constructor(name){this.name=name;this.filters=[];this.op='select';this.value=null;this.sort=null;this.max=null;}
  select(){return this;}
  eq(k,v){this.filters.push(row=>row[k]===v);return this;}
  in(k,values){this.filters.push(row=>values.includes(row[k]));return this;}
  is(k,v){this.filters.push(row=>row[k]===v);return this;}
  gte(k,v){this.filters.push(row=>row[k]>=v);return this;}
  or(){return this;}
  order(k,{ascending=true}={}){this.sort=[k,ascending];return this;}
  limit(n){this.max=n;return this;}
  insert(value){this.op='insert';this.value=value;return this;}
  update(value){this.op='update';this.value=value;return this;}
  delete(){this.op='delete';return this;}
  async run(){
    const rows=tables[this.name];
    if(!rows)throw Error('Unexpected table: '+this.name);
    const matches=rows.filter(r=>this.filters.every(f=>f(r)));
    if(this.op==='insert'){
      const record={...this.value,id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),completed_at:null};
      rows.push(record);
      return {data:record,error:null};
    }
    if(this.op==='update'){
      matches.forEach(r=>Object.assign(r,this.value));
      return {data:matches[0]||null,error:null};
    }
    if(this.op==='delete'){
      matches.forEach(r=>rows.splice(rows.indexOf(r),1));
      return {data:null,error:null};
    }
    const selected=[...matches];
    if(this.sort){const [k,asc]=this.sort;selected.sort((a,b)=>String(a[k]||'').localeCompare(String(b[k]||''))*(asc?1:-1));}
    return {data:this.max?selected.slice(0,this.max):selected,error:null};
  }
  async single(){const {data,error}=await this.run();return {data:Array.isArray(data)?data[0]||null:data,error};}
  async maybeSingle(){return this.single();}
  then(ok,bad){return this.run().then(ok,bad);}
}
const supabase={from:name=>new Query(name)};
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const httpError=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{json,httpError,requireUser:async()=>({user:{id:actor},supabase})}};
const endpoint=require('../netlify/functions/leadership-home');
async function call(method,body){
  const event={httpMethod:method,body:body?JSON.stringify(body):'',headers:{authorization:'Bearer mocked'}};
  const reply=await endpoint.handler(event);
  return {...JSON.parse(reply.body),statusCode:reply.statusCode};
}
async function run(){
  actor=adminId;
  const init=await call('GET');
  assert.equal(init.statusCode,200);
  assert.ok(Array.isArray(init.items));
  const meeting=await call('POST',{kind:'meeting',title:'CMC Team Meeting',region:'East',starts_at:'2026-12-02T19:00:00Z',body:'Review Exponential plans'});
  assert.equal(meeting.statusCode,201);
  assert.equal(meeting.item.title,'CMC Team Meeting');
  const action=await call('POST',{kind:'task',title:'Send prep materials',region:'East',visibility:'team',meeting_id:meeting.item.id,assigned_to:eastId,due_date:'2026-11-28'});
  assert.equal(action.statusCode,201);
  assert.equal(action.item.meeting_id,meeting.item.id);
  const done=await call('PATCH',{id:action.item.id,completed:true});
  assert.equal(done.statusCode,200);
  assert.ok(done.item.completed_at);
  const reopened=await call('PATCH',{id:action.item.id,completed:false});
  assert.equal(reopened.statusCode,200);
  assert.equal(reopened.item.completed_at,null);
  const edited=await call('PATCH',{id:meeting.item.id,notes:'Discussed regional assessment',decisions:'Schedule annual follow-up'});
  assert.equal(edited.statusCode,200);
  assert.equal(edited.item.decisions,'Schedule annual follow-up');
  const read=await call('GET');
  assert.equal(read.items.length,2);
  actor=westId;
  const westView=await call('GET');
  assert.equal(westView.statusCode,200);
  assert.equal(westView.items.length,0,'Regional directors cannot read another region');
  const forbidden=await call('PATCH',{id:meeting.item.id,title:'Tamper'});
  assert.equal(forbidden.statusCode,404,'Cross-region records should appear absent');
  actor=presidentId;
  const presidentView=await call('GET');
  assert.equal(presidentView.items.length,2,'National viewer can read cross-region leadership data');
  const denied=await call('POST',{kind:'task',title:'Not allowed',region:'East'});
  assert.equal(denied.statusCode,403,'National reporting viewer must not write');
  actor=adminId;
  const deleted=await call('DELETE',{id:action.item.id});
  assert.equal(deleted.statusCode,200);
  assert.equal((await call('GET')).items.length,1);
  console.log('Leadership UI bindings and authenticated meeting/reminder lifecycle passed');
}
run().then(()=>{if(prior)require.cache[authPath]=prior;else delete require.cache[authPath];})
  .catch(e=>{console.error(e);process.exitCode=1;if(prior)require.cache[authPath]=prior;else delete require.cache[authPath];});