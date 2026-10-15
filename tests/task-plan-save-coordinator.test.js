'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'task-plan-save-coordinator.js'),'utf8');
const script=fs.readFileSync(path.join(root,'task-plan-builder.js'),'utf8');
const html=fs.readFileSync(path.join(root,'task-plan-builder.html'),'utf8');
const browser={window:{}};
vm.runInNewContext(source,browser);
const create=browser.window.CMCTaskPlanSave.create;

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}){
  const state={id:options.id||null,title:options.title||'',status:options.status||'draft',
    version:options.version||0,publishedAt:options.publishedAt||null};
  const calls=[],messages=[];
  let blockNext=null,failNext=null,active=0,maxConcurrent=0;
  const coordinator=create({
    hasExisting:()=>Boolean(state.id),
    getPayload:()=>({template:{id:state.id,title:state.title,status:state.status},sections:[]}),
    setStatus:(message,error)=>messages.push({message,error:Boolean(error)}),
    applyResponse:data=>{
      state.id=data.template.id;
      state.status=data.template.status;
      state.version=data.template.version;
      state.publishedAt=data.template.published_at;
    },
    write:async payload=>{
      active+=1;maxConcurrent=Math.max(maxConcurrent,active);
      calls.push({title:payload.template.title,action:payload.action||'draft',id:payload.template.id});
      try{
        const gate=blockNext;blockNext=null;
        if(gate)await gate.promise;
        const failure=failNext;failNext=null;
        if(failure)throw new Error(failure);
        const publish=payload.action==='publish';
        return {template:{
          id:state.id||'plan-123',
          title:payload.template.title,
          status:publish?'published':'draft',
          version:publish?state.version+1:state.version,
          published_at:publish?'2026-10-15T12:00:00.000Z':state.publishedAt
        },sections:[]};
      }finally{active-=1;}
    }
  });
  return {
    state,calls,messages,coordinator,
    block(gate){blockNext=gate;},
    fail(message){failNext=message;},
    getMax:()=>maxConcurrent,
    lastMessage:()=>messages[messages.length-1]?.message
  };
}

async function run(){
  assert.match(html,/task-plan-save-coordinator\.js\?v=1/);
  assert.match(html,/task-plan-builder\.js\?v=5/);
  assert.ok(html.indexOf('task-plan-save-coordinator.js?v=1')<html.indexOf('task-plan-builder.js?v=5'));
  assert.match(script,/saveCoordinator\.flush\(\)/);
  assert.match(script,/saveCoordinator\.publish\(\)/);
  assert.match(script,/syncSavedIds\(data.sections\|\|\[\],payload.sections\|\|\[\]\)/);
  assert.doesNotMatch(script,/if \(saving\) \{ queued = true; return current; \}/,
    'The old non-awaited save-in-progress shortcut must stay removed.');

  const empty=setup();
  assert.equal(await empty.coordinator.flush(),false,'Untitled draft must not be saved');
  assert.equal(empty.calls.length,0);
  empty.state.title='New Plan';empty.coordinator.markDirty();
  assert.equal(await empty.coordinator.flush(),true);
  assert.equal(empty.state.id,'plan-123');
  assert.equal(empty.lastMessage(),'All changes saved');

  const edits=setup({id:'plan-1',title:'Original'});
  edits.state.title='First draft';edits.coordinator.markDirty();
  const firstGate=deferred();edits.block(firstGate);
  const first=edits.coordinator.flush();
  await tick();
  assert.deepEqual(edits.calls.map(c=>c.title),['First draft']);
  edits.state.title='Second draft';edits.coordinator.markDirty();
  const second=edits.coordinator.flush();
  assert.equal(edits.calls.length,1,'Overlapping autosaves should not write concurrently');
  firstGate.resolve();
  assert.equal(await first,true);
  assert.equal(await second,true);
  assert.deepEqual(edits.calls.map(c=>c.title),['First draft','Second draft']);
  assert.equal(edits.getMax(),1);
  assert.equal(edits.lastMessage(),'All changes saved');

  const pending=setup({id:'plan-2',title:'Before'});
  pending.state.title='Edited while saving';pending.coordinator.markDirty();
  const secondGate=deferred();pending.block(secondGate);
  const slowSave=pending.coordinator.flush();await tick();
  pending.state.title='Latest before publish';pending.coordinator.markDirty();
  const publish=pending.coordinator.publish();
  assert.equal(pending.coordinator.isPublishing(),true);
  assert.equal(await pending.coordinator.publish(),false,'Double publish must be rejected');
  assert.equal(pending.calls.length,1);
  secondGate.resolve();
  assert.equal(await slowSave,true);
  assert.equal(await publish,true);
  assert.deepEqual(pending.calls.map(c=>c.action),['draft','draft','publish']);
  assert.equal(pending.calls[2].title,'Latest before publish');
  assert.equal(pending.getMax(),1);
  assert.equal(pending.lastMessage(),'Published · version 1');
  assert.equal(await pending.coordinator.flush(),true);
  assert.equal(pending.lastMessage(),'Published · version 1',
    'A later preview must not erase an accurate Published status');

  const fail=setup({id:'plan-3',title:'First'});
  fail.state.title='Change that cannot save';fail.coordinator.markDirty();
  fail.fail('Network unavailable');
  assert.equal(await fail.coordinator.publish(),false);
  assert.deepEqual(fail.calls.map(c=>c.action),['draft']);
  assert.equal(fail.lastMessage(),'Network unavailable');
  assert.equal(fail.coordinator.needsSave(),true);
  await tick();
  assert.equal(fail.calls.length,1,'Failed save must not cause a hidden automatic retry');
  assert.equal(await fail.coordinator.publish(),true,'A deliberate retry should be possible');
  assert.deepEqual(fail.calls.map(c=>c.action),['draft','draft','publish']);

  const late=setup({id:'plan-4',title:'Start'});
  late.state.title='First version';late.coordinator.markDirty();
  const publishedGate=deferred();
  late.block(publishedGate);
  const during=late.coordinator.publish();
  await tick();
  assert.equal(late.calls[0].action,'draft');
  // The first request is a draft save. This edit happens while saving.
  late.state.title='Second version';late.coordinator.markDirty();
  publishedGate.resolve();
  assert.equal(await during,true);
  assert.equal(late.calls.slice(-1)[0].title,'Second version');
  assert.equal(late.calls.slice(-1)[0].action,'publish');

  const after=setup({id:'plan-5',title:'Originally drafted'});
  const hold=deferred();
  after.block(hold);
  const publishing=after.coordinator.publish();
  await tick();
  // First no-op draft, then the publish request is in flight.
  assert.equal(after.calls[0].action,'publish');
  after.state.title='Edited during publish';after.coordinator.markDirty();
  hold.resolve();
  assert.equal(await publishing,true);
  assert.equal(after.state.id,'plan-5');
  await tick();await tick();
  assert.deepEqual(after.calls.map(c=>c.action),['publish','draft']);
  assert.equal(after.calls[1].title,'Edited during publish');
  assert.equal(after.getMax(),1);
  assert.equal(after.lastMessage(),'Draft saved · Unpublished edits');

  const failedPublish=setup({id:'plan-6',title:'Confirmed'});
  failedPublish.fail('Publish rejected');
  assert.equal(await failedPublish.coordinator.publish(),false);
  assert.equal(failedPublish.lastMessage(),'Publish rejected');
  assert.equal(failedPublish.state.status,'draft');

  console.log('Task Plan coordinated saving: overlapping edits, publishing, failed saves, retry, unsaved edits and status passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
