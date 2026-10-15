'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const script=fs.readFileSync(path.join(__dirname,'../courses.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../courses.html'),'utf8');

function deferred(){
  let resolve,reject;
  const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});
  return {promise,resolve,reject};
}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}

function startPage(){
  const session=deferred(),profile=deferred(),response=deferred();
  const events=[], redirects=[],elements={
    courseLibrary:{innerHTML:''},
    courseLibraryMessage:{textContent:'Loading courses…',classList:{add(name){events.push('error-class:'+name)}}}
  };
  let sessionCalls=0,profileCalls=0,courseCalls=0;
  const context={
    window:{location:{
      href:'courses.html',
      replace(path){redirects.push(path);}
    }},
    document:{getElementById:id=>elements[id]},
    dcAuth:{
      getCurrentSession(){sessionCalls++;events.push('session');return session.promise;},
      getProfile(id){assert.equal(id,'test-user');profileCalls++;events.push('profile');return profile.promise;},
      renderRoleNavigation(role,key){
        assert.equal(role.account_role,'cmc_admin');
        assert.equal(key,'courses');
        events.push('navigation');
      }
    },
    fetch(url,options){
      assert.equal(url,'/.netlify/functions/course-admin');
      assert.equal(options.headers.Authorization,'Bearer fake-token');
      courseCalls++;
      events.push('courses-request');
      return response.promise;
    },
    Date,encodeURIComponent
  };
  const running=vm.runInNewContext(script,context);
  return {
    running,session,profile,response,redirects,elements,events,
    counts:()=>({sessionCalls,profileCalls,courseCalls})
  };
}
const coursePayload={
  ok:true,
  courses:[{id:'course-1',slug:'discover',title:'Discover',subtitle:'Intro',
    stage_key:'discover',access_mode:'assigned',status:'published',
    updated_at:'2026-10-14T11:00:00.000Z'}]
};

async function main(){
  assert.match(page,/id="courseLibraryMessage"/);
  assert.match(page,/courses\.js\?v=92/);

  const admin=startPage();
  await flush();
  assert.deepEqual(admin.counts(),{sessionCalls:1,profileCalls:0,courseCalls:0});
  admin.session.resolve({user:{id:'test-user'},access_token:'fake-token'});
  await flush();
  assert.deepEqual(admin.counts(),{sessionCalls:1,profileCalls:1,courseCalls:1},
    'The independent course request should start before profile lookup finishes');
  assert.deepEqual(admin.events.slice(0,3),['session','profile','courses-request']);
  admin.response.resolve({ok:true,json:async()=>coursePayload});
  await flush();
  assert.equal(admin.elements.courseLibrary.innerHTML,'',
    'Do not render protected course data until role is confirmed');
  admin.profile.resolve({account_role:'cmc_admin',is_coach:true});
  await admin.running;
  assert.match(admin.elements.courseLibrary.innerHTML,/Discover/);
  assert.equal(admin.elements.courseLibraryMessage.textContent,'');
  assert.ok(admin.events.indexOf('navigation')>admin.events.indexOf('courses-request'));
  assert.deepEqual(admin.redirects,[]);

  const regional=startPage();
  regional.session.resolve({user:{id:'test-user'},access_token:'fake-token'});
  await flush();
  regional.profile.resolve({account_role:'regional_leader'});
  await regional.running;
  assert.deepEqual(regional.redirects,['leader.html']);
  assert.equal(regional.elements.courseLibrary.innerHTML,'');
  regional.response.resolve({ok:false,json:async()=>({ok:false,error:'Forbidden'})});

  const guest=startPage();
  guest.session.resolve(null);
  await guest.running;
  assert.equal(guest.counts().courseCalls,0);
  assert.equal(guest.counts().profileCalls,0);
  assert.equal(guest.elements.courseLibrary.innerHTML,'');
  assert.equal(guest.redirects.length,0);
  assert.equal(guest.events.includes('courses-request'),false);

  const failure=startPage();
  failure.session.resolve({user:{id:'test-user'},access_token:'fake-token'});
  await flush();
  failure.profile.resolve({account_role:'cmc_admin'});
  failure.response.resolve({ok:false,json:async()=>({ok:false,error:'Temporary network failure'})});
  await failure.running;
  assert.equal(failure.elements.courseLibraryMessage.textContent,'Temporary network failure');
  assert.ok(failure.events.includes('error-class:error'));

  const networkError=startPage();
  networkError.session.resolve({user:{id:'test-user'},access_token:'fake-token'});
  await flush();
  networkError.response.reject(new Error('Disconnected'));
  networkError.profile.resolve({account_role:'cmc_admin'});
  await networkError.running;
  assert.equal(networkError.elements.courseLibraryMessage.textContent,'Disconnected');

  console.log('Course library performance: profile and course list overlap after one session lookup; role checks and error flows pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
