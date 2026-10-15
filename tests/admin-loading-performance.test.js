'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const flush=async()=>{for(let n=0;n<15;n++)await Promise.resolve();};
function gate(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function dom(){
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id)){
      const classes=new Set();
      nodes.set(id,{
        id,innerHTML:'',textContent:'',value:'',disabled:false,hidden:false,handlers:{},
        classList:{
          add(...names){for(const n of names)classes.add(n)},
          remove(...names){for(const n of names)classes.delete(n)},
          toggle(name,enabled){if(enabled===undefined)enabled=!classes.has(name);if(enabled)classes.add(name);else classes.delete(name);return enabled},
          contains(name){return classes.has(name)}
        },
        addEventListener(event,callback){this.handlers[event]=callback},
        querySelectorAll(){return []},
        close(){}, showModal(){}, reset(){}, setAttribute(){}, focus(){},
        get elements(){return new Proxy({}, {get(){return {value:'',checked:false}}});}
      });
    }
    return nodes.get(id);
  }
  return {nodes,document:{getElementById:node,querySelectorAll(){return []}},node};
}
function sandbox(file){
  const d=dom(),session=gate(),profile=gate(),response=gate();
  const calls=[],redirects=[],navigation=[];
  const location={search:file==='course-builder.js'?'?id=course-123':'',hostname:'pathway.openbiblecmc.org',href:file,
    replace(url){redirects.push(url);this.href=url}};
  const app={
    window:{location,CMCBuilderUI:{initShell(){}},crypto:{randomUUID(){return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}},
    location,
    document:d.document,
    URLSearchParams,
    Date,
    console,
    fetch(url,options){
      calls.push(['fetch',url,options?.headers?.Authorization]);
      return response.promise;
    },
    dcAuth:{
      getCurrentSession(){calls.push(['session']);return session.promise},
      getProfile(id){calls.push(['profile',id]);return profile.promise},
      requireUser(){calls.push(['legacy-requireUser']);throw Error('Legacy second-session call detected')},
      getSupabaseClient(){calls.push(['legacy-getSupabaseClient']);throw Error('Legacy second-session call detected')},
      renderRoleNavigation(p,key){navigation.push([p,key])},
      setupLogout(){}
    }
  };
  const running=vm.runInNewContext(read(file),app);
  return {session,profile,response,calls,redirects,navigation,location,...d,running};
}
const http=(payload,code=200)=>({ok:code>=200&&code<300,status:code,json:async()=>payload});
async function startSession(a){
  a.session.resolve({user:{id:'viewer-1'},access_token:'token-abc'});
  await flush();
}
async function testTaskPlans(){
  let a=sandbox('task-plans.js');
  await startSession(a);
  assert.deepEqual(a.calls.map(x=>x[0]),['session','profile','fetch'],
    'Task Plan requests must overlap after a single session read');
  assert.equal(a.calls[2][1],'/.netlify/functions/task-plan-admin');
  assert.equal(a.calls[2][2],'Bearer token-abc');
  a.response.resolve(http({ok:true,templates:[{
    id:'task-plan-1',title:'Ready Plan',slug:'ready',description:'Summary',
    stage_key:'deploy',status:'draft',version:1,cmc_task_plan_sections:[{count:1}],cmc_task_plan_tasks:[{count:2}]
  }]}));
  await flush();
  assert.equal(a.node('taskPlanLibrary').innerHTML,'',
    'Never display protected tasks while the profile request is pending');
  a.profile.resolve({account_role:'cmc_admin'});
  await a.running;
  assert.match(a.node('taskPlanLibrary').innerHTML,/Ready Plan/);
  assert.equal(a.navigation[0][1],'plans');

  a=sandbox('task-plans.js');
  await startSession(a);
  a.response.resolve(http({ok:true,templates:[{id:'private',title:'Sensitive Plan',status:'draft'}]}));
  a.profile.resolve({account_role:'regional_leader'});
  await a.running;
  assert.deepEqual(a.redirects,['leader.html']);
  assert.equal(a.node('taskPlanLibrary').innerHTML,'');
  assert.equal(a.navigation.length,0);

  a=sandbox('task-plans.js');
  await startSession(a);
  a.profile.resolve({account_role:'cmc_admin'});
  a.response.resolve(http({ok:false,error:'Network unavailable'},503));
  await a.running;
  assert.equal(a.node('taskPlanLibraryMessage').textContent,'Network unavailable');
}
async function testServerViewer(file,key){
  let a=sandbox(file);
  await startSession(a);
  assert.deepEqual(a.calls.map(x=>x[0]),['session','fetch'],
    file+' must not fetch a second profile or session');
  assert.equal(a.navigation.length,0);
  const viewer={id:'viewer-1',region:'East',account_role:file==='events.js'?'regional_leader':'participant',is_coach:true};
  const data=file==='events.js'
    ?{ok:true,viewer,events:[],participants:[],invitations:[]}
    :{ok:true,viewer,regions:['East'],participants:[]};
  a.response.resolve(http(data));
  await a.running;
  assert.equal(a.navigation.length,1,file+' should use server-confirmed viewer');
  assert.equal(a.navigation[0][1],key);
  if(file==='events.js'){
    assert.equal(a.node('eventRegionField').classList.contains('hidden'),true);
    assert.match(a.node('eventList').innerHTML,/No upcoming events/);
  }else{
    assert.match(a.node('coachPeopleList').innerHTML,/No active coaching relationships/);
  }

  a=sandbox(file);
  await startSession(a);
  a.response.resolve(http({ok:false,error:'Forbidden'},403));
  await a.running;
  assert.deepEqual(a.redirects,['dashboard.html'],
    file+' must not render administration for unauthorized users');
  assert.equal(a.navigation.length,0);
}
async function testCourseBuilderPrefetch(){
  const a=sandbox('course-builder.js');
  await startSession(a);
  assert.deepEqual(a.calls.map(x=>x[0]),['session','profile','fetch']);
  assert.match(a.calls[2][1],/course-admin\?id=course-123/);
  a.response.resolve(http({ok:true,course:{id:'course-123'}}));
  await flush();
  assert.equal(a.navigation.length,0,'Course Builder must not initialize before profile check');
  a.profile.resolve({account_role:'regional_leader'});
  await a.running;
  assert.deepEqual(a.redirects,['leader.html']);
  assert.equal(a.navigation.length,0);
}
async function testGuestPaths(){
  for(const file of ['task-plans.js','events.js','coach.js','course-builder.js']){
    const a=sandbox(file);
    a.session.resolve(null);
    await a.running;
    assert.equal(a.location.href,'login.html',file+' must send guests to login');
    assert.deepEqual(a.calls.map(x=>x[0]),['session']);
  }
}
async function main(){
  for(const [page,script,version] of [
    ['task-plans.html','task-plans.js',3],['events.html','events.js',128],
    ['coach.html','coach.js',131],['course-builder.html','course-builder.js',106],
    ['leader.html','leader.js',118]
  ]){
    assert.ok(read(page).includes(script+'?v='+version),page+' must load updated code');
  }
  assert.match(read('leader.js'),/getCurrentSession\(\)/);
  assert.doesNotMatch(read('leader.js'),/dcAuth\.requireUser\(\)/);
  await testTaskPlans();
  await testServerViewer('events.js','events');
  await testServerViewer('coach.js','coaching');
  await testCourseBuilderPrefetch();
  await testGuestPaths();
  console.log('Admin loading waterfall tests passed: concurrent reads, verified server roles, redirects, error and guest handling.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
