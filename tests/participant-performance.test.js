const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const sourcePath=path.resolve(__dirname,'../netlify/functions/participant-detail.js');
const target='22222222-2222-4222-8222-222222222222';

async function run(viewer,targetProfile){
  const started=[];
  const tables={candidate_profiles:[viewer,targetProfile]};
  const db={
    auth:{getUser:async()=>({data:{user:{id:viewer.id}},error:null})},
    from(name){
      const query={filters:[],select(){return this;},eq(k,v){this.filters.push([k,v]);return this;},
        order(){return this;},
        maybeSingle(){return this.execute(true);},
        then(resolve,reject){return this.execute(false).then(resolve,reject);},
        async execute(single){
          started.push({name,at:Date.now(),filters:this.filters});
          await new Promise(r=>setTimeout(r,12));
          const rows=(tables[name]||[]).filter(row=>this.filters.every(([k,v])=>row[k]===v));
          return {data:single?rows[0]||null:rows,error:null};
        }
      };
      return query;
    }
  };
  const old=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='@supabase/supabase-js')return {createClient:()=>db};
    return old.call(this,request,parent,isMain);
  };
  try{
    delete require.cache[sourcePath];
    const handler=require(sourcePath).handler;
    const response=await handler({
      httpMethod:'GET',
      headers:{authorization:'Bearer valid'},
      queryStringParameters:{participant_id:target}
    });
    return {response,started};
  }finally{Module._load=old;}
}
async function main(){
  let viewer={id:'leader-1',region:'East',account_role:'regional_leader'};
  let participant={id:target,region:'Central',account_role:'participant',created_at:null};
  let result=await run(viewer,participant);
  assert.equal(result.response.statusCode,404,'Leaders must not access people from other regions');
  assert.equal(result.started.length,2,'Denied participant requests should stop before sensitive detail queries');
  assert.ok(Math.abs(result.started[0].at-result.started[1].at)<8,
    'Viewer and participant identity checks should run at the same time');

  viewer={id:'viewer-1',region:'East',account_role:'participant'};
  result=await run(viewer,{...participant,region:'East'});
  assert.equal(result.response.statusCode,403,'Participants must never access the leader detail API');
  assert.equal(result.started.length,2);

  viewer={id:'admin-1',region:'East',account_role:'cmc_admin'};
  result=await run(viewer,participant);
  assert.equal(result.response.statusCode,200,'Administrators still have cross-region access');
  assert.equal(JSON.parse(result.response.body).participant.id,target);
  assert.ok(result.started.length>2,'Authorized users should receive the rest of the detail records');

  console.log('Parallel participant authorization and region-boundary tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
