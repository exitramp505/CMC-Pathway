const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const handlerPath=path.resolve(__dirname,'../netlify/functions/course-get.js');

class Query {
  constructor(state,table){this.state=state;this.table=table;this.op='read';this.filters=[];}
  select(){return this;}
  eq(k,v){this.filters.push([k,v]);return this;}
  order(){return this;}
  maybeSingle(){return this.execute(true);}
  upsert(data,options){this.op='upsert';this.values=data;this.options=options;return this;}
  update(data){this.op='update';this.values=data;return this;}
  then(resolve,reject){return this.execute(false).then(resolve,reject);}
  async execute(single){
    this.state.events.push({table:this.table,op:this.op,at:Date.now()});
    await new Promise(r=>setTimeout(r,this.state.delay||0));
    if(this.op!=='read'){
      this.state.writes.push({table:this.table,op:this.op,values:this.values,options:this.options,filters:this.filters});
      return {data:null,error:null};
    }
    const rows=this.state.tables[this.table];
    const results=Array.isArray(rows) ? rows.filter(row=>this.filters.every(([k,v])=>row[k]===v)) : rows;
    return {data:single?(Array.isArray(results)?results[0]||null:results||null):(results||[]),error:null};
  }
}

async function runHandler(state){
  const db={
    auth:{getUser:async token=>({data:{user:token==='valid' ? {id:'person-1'} : null},error:token==='valid'?null:new Error('Denied')})},
    from(table){return new Query(state,table);}
  };
  const old=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='@supabase/supabase-js')return {createClient:()=>db};
    return old.call(this,request,parent,isMain);
  };
  try{delete require.cache[handlerPath];const handler=require(handlerPath).handler;
    return handler({httpMethod:'GET',headers:{authorization:'Bearer valid'},queryStringParameters:{slug:'discover'}});
  }finally{Module._load=old;}
}

function fixture(role='participant',access='automatic',status='published'){
  return {delay:10,events:[],writes:[],tables:{
    candidate_profiles:[{id:'person-1',account_role:role,full_name:'Sample',email:'sample@example.org'}],
    cmc_courses:[{id:'course-1',slug:'discover',status,access_mode:access}],
    candidate_assignments:[],
    cmc_course_modules:[{id:'module-1',course_id:'course-1',position:0,title:'Start'}],
    cmc_course_lessons:[{id:'lesson-1',course_id:'course-1',module_id:'module-1',title:'Welcome',position:0}],
    cmc_course_lesson_progress:[],
    cmc_course_lesson_responses:[],
    cmc_course_enrollments:[]
  }};
}

async function main(){
  let s=fixture('participant','assigned','draft');
  let response=await runHandler(s);
  assert.equal(response.statusCode,404,'Participants must not see draft course content');
  assert.equal(s.writes.length,0,'Do not create enrollments for hidden drafts');

  s=fixture('participant','assigned');
  response=await runHandler(s);
  assert.equal(response.statusCode,403,'Unassigned participant access must remain blocked');
  assert.equal(s.writes.length,0,'Do not write enrollment for unauthorized participants');

  s=fixture('cmc_admin','assigned','draft');
  response=await runHandler(s);
  assert.equal(response.statusCode,200,'Administrators can preview draft courses');
  assert.ok(JSON.parse(response.body).course.modules[0].lessons[0]);
  assert.match(response.headers['Server-Timing'],/auth;dur=.*data;dur=.*total;dur=/);
  assert.equal(s.writes.filter(w=>w.table==='cmc_course_enrollments').length,1);

  s=fixture();
  s.tables.candidate_assignments=[{
    id:'manual-assignment',user_id:'person-1',item_key:'discover_course',
    assignment_source:'leader',status:'assigned',hidden_at:null
  }];
  response=await runHandler(s);
  assert.equal(response.statusCode,200);
  assert.equal(s.writes.filter(w=>w.table==='candidate_assignments').length,0,
    'Repeated course visits must not rewrite manually assigned access');
  const relevant=s.events.filter(e=>['candidate_profiles','cmc_courses'].includes(e.table));
  assert.equal(relevant.length,2,'Course and profile should each load once');
  assert.ok(Math.abs(relevant[0].at-relevant[1].at)<8,
    'Independent course and profile lookups should start together');

  s=fixture();
  response=await runHandler(s);
  assert.equal(response.statusCode,200);
  assert.equal(s.writes.filter(w=>w.table==='candidate_assignments').length,1,
    'Missing automatic assignments should still be created');
  const inserted=s.writes.find(w=>w.table==='candidate_assignments');
  assert.equal(inserted.op,'upsert');
  assert.equal(inserted.values.assignment_source,'automatic');
  assert.equal(inserted.options.onConflict,'user_id,item_key');
  const contentCalls=s.events.filter(e=>[
    'cmc_course_lessons','cmc_course_modules','cmc_course_enrollments'
  ].includes(e.table));
  assert.equal(contentCalls.length,3);
  assert.ok(Math.max(...contentCalls.map(e=>e.at))-Math.min(...contentCalls.map(e=>e.at))<8,
    'Lesson reads and last-opened updates should run concurrently');

  const { _test:{withTiming} }=require('../netlify/functions/course-admin');
  const timed=withTiming({statusCode:200,headers:{'Content-Type':'application/json'},body:'{}'},100,245,690);
  assert.equal(timed.statusCode,200);
  assert.equal(timed.body,'{}','Instrumentation must not rewrite payloads');
  assert.equal(timed.headers['Content-Type'],'application/json');
  assert.equal(timed.headers['Cache-Control'],'private, no-store',
    'Private Course Admin responses must never be cached');
  assert.equal(timed.headers['Server-Timing'],'auth;dur=145, operation;dur=445, total;dur=590');
  const unauthenticated=withTiming({statusCode:401,headers:{},body:'{}'},100,null,175);
  assert.equal(unauthenticated.headers['Server-Timing'],'total;dur=75');
  assert.equal(unauthenticated.headers['Cache-Control'],'private, no-store');
  console.log('Course Admin Server-Timing, privacy, and original response preservation passed.');
  console.log('Course loading security, concurrency and assignment tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
