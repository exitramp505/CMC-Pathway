const assert=require('node:assert/strict');
const {planSummaries,fetchPagedByIds}=require('../netlify/functions/task-plan-assignments')._test;

function database(tables,delay=0){
  const requests=[];
  const db={
    requests,
    from(table){
      const query={table,filters:[],sort:[],
        select(){return this;},
        in(field,ids){this.filters.push([field,new Set(ids)]);return this;},
        order(field){this.sort.push(field);return this;},
        async range(from,to){
          requests.push({table,from,to,ids:[...this.filters[0][1]]});
          await new Promise(resolve=>setTimeout(resolve,delay));
          let rows=(tables[table]||[]).filter(row=>this.filters.every(([field,ids])=>ids.has(row[field])));
          for(const field of [...this.sort].reverse()){
            rows=rows.sort((a,b)=>Number(a[field])-Number(b[field]));
          }
          return {data:rows.slice(from,to+1),error:null};
        }
      };
      return query;
    }
  };
  return db;
}
function task(id,planId,opts={}){
  return {
    id,plan_id:planId,section_position:0,position:0,title:id,
    task_type:'task',status:'not_started',priority:2,due_date:null,...opts
  };
}
async function main(){
  let db=database({
    cmc_participant_plan_tasks:[
      task('done','plan-1',{status:'completed',position:0}),
      task('blocked','plan-1',{position:1,priority:1}),
      task('next','plan-1',{position:2,priority:2}),
      task('group','plan-1',{position:3,task_type:'group'})
    ],
    cmc_participant_plan_dependencies:[
      {task_id:'blocked',depends_on_task_id:'next'}
    ]
  });
  const plans=[{id:'plan-1',title:'First'},{id:'plan-2',title:'Second'}];
  const result=await planSummaries(db,plans);
  assert.equal(result.length,2);
  assert.equal(result[0].total_tasks,3);
  assert.equal(result[0].completed_tasks,1);
  assert.equal(result[0].progress,33);
  assert.equal(result[0].next_task.id,'next','Dependent tasks must still be deprioritized');
  assert.equal(result[1].total_tasks,0);
  assert.equal(result[1].progress,0);
  assert.equal(result[1].next_task,null);
  assert.deepEqual(db.requests.map(x=>x.table),[
    'cmc_participant_plan_tasks','cmc_participant_plan_dependencies'
  ],'Multiple task plans must share batched reads');

  db=database({});
  assert.deepEqual(await planSummaries(db,[]),[]);
  assert.equal(db.requests.length,0,'No plans should not contact the database');

  const many=Array.from({length:901},(_,i)=>task('task-'+i,'plan-3',{position:i}));
  db=database({cmc_participant_plan_tasks:many});
  const pageResult=await fetchPagedByIds(db,'cmc_participant_plan_tasks','plan_id',['plan-3']);
  assert.equal(pageResult.length,901,'Do not silently lose data above Supabase row limits');
  assert.equal(db.requests.length,2,'A second page must load once the first has 900 rows');

  db=database({});
  const ids=Array.from({length:125},(_,i)=>'id-'+i);
  await fetchPagedByIds(db,'cmc_participant_plan_tasks','plan_id',ids);
  assert.equal(db.requests.length,3,'Large IN filters must be split into bounded batches');
  assert.ok(db.requests.every(x=>x.ids.length<=60));
  console.log('Task-plan batching, dependency, empty-list and pagination tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
