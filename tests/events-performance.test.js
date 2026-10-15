const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../netlify/functions/events-admin.js'),'utf8');
const start=source.indexOf('async function loadAdminData(');
const end=source.indexOf('\nasync function saveEvent(',start);
assert.ok(start>=0&&end>start,'Event data loader should be present');
let lookups=0;
const load= new Function('isUuid','loadParticipant','eventVisibleToRegion','httpError',
  source.slice(start,end)+'\nreturn loadAdminData;')(
  value=>/^[0-9a-f-]{36}$/i.test(value),
  async(_db,_viewer,id)=>{lookups++;await new Promise(r=>setTimeout(r,12));return {id,region:'East'};},
  (event,region)=>event.region===region,
  (status,msg)=>Object.assign(new Error(msg),{statusCode:status})
);
function fakeDb(){
  const started=[];
  const tables={
    cmc_events:[
      {id:'east-event',region:'East',status:'published',starts_at:'2026-11-01',ends_at:'2027-11-01'},
      {id:'central-event',region:'Central',status:'published',starts_at:'2026-11-01',ends_at:'2027-11-01'},
      {id:'draft-event',region:'East',status:'draft',starts_at:'2026-11-01',ends_at:'2027-11-01'}
    ],
    candidate_profiles:[{id:'east-1',region:'East',account_role:'participant',archived_at:null},
      {id:'central-1',region:'Central',account_role:'participant',archived_at:null}],
    cmc_event_invitations:[{id:'invite-1',user_id:'east-1',event_id:'east-event'}]
  };
  const db={started,from(table){
    return {
      filters:[],table,
      select(){return this;},order(){return this;},
      eq(k,v){this.filters.push(row=>row[k]===v);return this;},
      is(k,v){this.filters.push(row=>row[k]===v);return this;},
      in(k,vs){this.filters.push(row=>vs.includes(row[k]));return this;},
      then(resolve,reject){
        started.push({table,at:Date.now()});
        return new Promise(done=>setTimeout(()=>{
          done({data:(tables[table]||[]).filter(row=>this.filters.every(fn=>fn(row))),error:null});
        },12)).then(resolve,reject);
      }
    };
  }};
  return db;
}
async function run(){
  const viewer={id:'leader',account_role:'regional_leader',region:'East'};
  let db=fakeDb();
  let result=await load(db,viewer,{});
  assert.deepEqual(result.events.map(x=>x.id),['east-event','draft-event']);
  assert.deepEqual(result.participants.map(x=>x.id),['east-1']);
  assert.equal(result.invitations.length,1);
  assert.equal(db.started.length,3);
  assert.ok(Math.abs(db.started[0].at-db.started[1].at)<8,
    'Independent event and participant listings must begin concurrently');

  db=fakeDb();
  result=await load(db,viewer,{participant_id:'11111111-1111-4111-8111-111111111111'});
  assert.equal(lookups,1);
  assert.deepEqual(result.events.map(x=>x.id),['east-event']);
  assert.ok(db.started.some(q=>q.table==='cmc_event_invitations'));
  assert.equal(db.started[0].table,'cmc_events');
  assert.rejects(
    ()=>load(fakeDb(),viewer,{participant_id:'not-a-uuid'}),
    e=>e.statusCode===400
  );
  console.log('Event-list concurrency and regional access tests passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
