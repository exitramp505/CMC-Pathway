const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = path => fs.readFileSync(require('node:path').join(root, path), 'utf8');
const classList = () => ({ add(){}, remove(){}, toggle(){} });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

async function testPasswordVisibility() {
  const handlers = {};
  const text = {textContent:'Show'};
  const input = {type:'password',focused:false,focus(){this.focused=true}};
  const attributes = { 'aria-controls':'signupPassword' };
  const button = {
    getAttribute:key=>attributes[key], setAttribute:(key,val)=>{attributes[key]=val;},
    querySelector:()=>text, addEventListener:(name,callback)=>{handlers[name]=callback}
  };
  vm.runInNewContext(read('password-toggle.js'), {
    document:{
      querySelectorAll:()=>[button],
      getElementById:()=>input
    }
  });
  handlers.click();
  assert.equal(input.type,'text');
  assert.equal(attributes['aria-pressed'],'true');
  assert.equal(attributes['aria-label'],'Hide password');
  assert.equal(text.textContent,'Hide');
  assert.equal(input.focused,true);
  handlers.click();
  assert.equal(input.type,'password');
  assert.equal(attributes['aria-pressed'],'false');
}

async function testDuplicateSignup() {
  let resolveSignup;
  let calls = 0;
  const events = {};
  const google = {
    disabled:false,innerHTML:'Google',setAttribute(){},
    addEventListener(name,callback){this[name]=callback;}
  };
  const submitButton = {disabled:false,textContent:'Create Account'};
  const form = {
    elements:{email:{value:''}},
    addEventListener(name,callback){events[name]=callback;},
    querySelector:()=>submitButton,
    setAttribute(){},
    reportValidity:()=>true
  };
  const msg = {classList:classList(),textContent:''};
  const data = {email:'sample@example.test',password:'secure-test-password'};
  const context = {
    URLSearchParams,
    FormData:class { constructor(){} get(key){return data[key]} },
    document:{
      getElementById:id=>({signupForm:form,authMessage:msg,googleSignupBtn:google})[id]
    },
    window:{location:{search:'',origin:'https://pathway.example.test'}},
    dcAuth:{
      getCurrentSession:async()=>null,
      getSupabaseClient:async()=>({auth:{signUp:()=>{
        calls++;
        return new Promise(resolve=>{resolveSignup=resolve});
      }}})
    }
  };
  vm.runInNewContext(read('signup.js'),context);
  await flush();
  assert.equal(typeof events.submit,'function','Signup handler should be attached');
  const ev={preventDefault(){}};
  const pending=events.submit(ev);
  await flush();
  await events.submit(ev);
  assert.equal(calls,1,'Only one signup request may be in flight');
  assert.equal(submitButton.disabled,true,'Button must be disabled while waiting');
  resolveSignup({data:{session:null,user:null},error:null});
  await pending;
  assert.equal(submitButton.disabled,true,'Successful signup stays locked');
  await events.submit(ev);
  assert.equal(calls,1,'Success must not allow another signup submission');
  assert.match(msg.textContent,/CMC profile/);
}

async function testProfilePartialSuccess() {
  let profileWrites = 0;
  let assignmentCalls = 0;
  const events = {};
  const formInputs = {};
  for (const key of ['email','name','phone','state','married','churchName','ministryRole','pathwayInterest']) {
    formInputs[key]={value:''};
  }
  const submit = {disabled:false};
  const form = Object.assign({
    addEventListener(name,callback){events[name]=callback;},
    querySelector(){return submit},
    reportValidity:()=>true
  },formInputs);
  const retry = {disabled:false,addEventListener(name,callback){this[name]=callback}};
  const actions={hidden:true};
  const msg={classList:classList(),textContent:''};
  const go={href:''};
  const ids={state:form.state,profileForm:form,profileMessage:msg,
    retryCourseSetupBtn:retry,profileSetupActions:actions,continueToPathwayLink:go};
  const payload={name:'Sample Person',phone:'555-000-0000',state:'Ohio'};
  const context={
    URLSearchParams,
    FormData:class {get(name){return payload[name]||''}},
    setTimeout:()=>{},
    window:{location:{search:'',href:''}},
    document:{getElementById:id=>ids[id]||null},
    fetch:async()=>{
      assignmentCalls++;
      return {ok:assignmentCalls>1,json:async()=>({ok:assignmentCalls>1,error:'Assignments failed'})};
    },
    dcAuth:{
      setupLogout(){},fillStateSelect(){},requireUser:async()=>({id:'test-id',email:'sample@example.test'}),
      getProfile:async()=>null,renderRoleNavigation(){},regionForState:()=>'East',
      upsertProfile:async()=>{profileWrites++},
      getSupabaseClient:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}})
    }
  };
  vm.runInNewContext(read('profile.js'),context);
  await flush();
  assert.equal(typeof events.submit,'function');
  await events.submit({preventDefault(){}});
  assert.equal(profileWrites,1);
  assert.equal(assignmentCalls,1);
  assert.equal(actions.hidden,false);
  assert.match(msg.textContent,/profile was saved/i,
    'Assignment failure must not be reported as a profile-save failure');
  await retry.click();
  assert.equal(profileWrites,1,'Retry must not resave the profile');
  assert.equal(assignmentCalls,2);
  assert.equal(actions.hidden,true);
  assert.match(msg.textContent,/assignments are ready/i);
}

async function main() {
  const login = read('login.html');
  const signup = read('signup.html');
  const reset = read('reset-password.html');
  const profile = read('profile.html');
  assert.match(login,/href="forgot-password.html"/);
  assert.match(login,/data-password-toggle/);
  assert.match(signup,/data-password-toggle/);
  assert.match(reset,/data-password-toggle/);
  assert.match(profile,/id="retryCourseSetupBtn"/);
  assert.match(profile,/id="continueToPathwayLink"/);
  assert.match(read('style.css'),/cmcProfileSetupActions\[hidden\]/);
  await testPasswordVisibility();
  await testDuplicateSignup();
  await testProfilePartialSuccess();
  console.log('Onboarding usability regression checks passed.');
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
