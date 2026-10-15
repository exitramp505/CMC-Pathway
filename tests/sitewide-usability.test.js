const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

for (const file of files) {
  const html = read(file);
  assert.match(html, /<html[^>]*\blang=["']en["']/i, file + ' must declare the page language');
  assert.match(html, /name=["']viewport["']/i, file + ' must be mobile responsive');
  assert.match(html, /<title>/i, file + ' must have a title');
  if (html.includes('style.css?v=')) {
    assert.match(html,/style\.css\?v=138/,file + ' must load the latest shared stylesheet');
    assert.match(html,/rel="icon" type="image\/svg\+xml" href="cmc-logo-mark\.svg"/,file + ' must provide a favicon');
  }
  if (html.includes('@supabase/supabase-js@2')) {
    assert.ok(html.includes('@supabase/supabase-js@2.105.4'),file + ' must pin its browser SDK');
  }
}
const css = read('style.css');
assert.match(css, /\.cmcPathwayBody \.cmcBuilderSettings label>span/);
assert.match(css, /\.cmcPathwayBody \.cmcEventFieldGrid label/);
assert.match(css, /font-size:13px/);
assert.match(css, /font-size:16px/);
assert.match(read('website.html'),/target="_blank" rel="noopener noreferrer"/);
assert.match(read('course.js'),/<h1 class="cmcLessonHeading"/);
assert.match(read('login.html'),/aria-live="polite"/);
assert.match(read('signup.html'),/aria-live="polite"/);

async function checkDuplicateLogin() {
  const events = {};
  let resolveSignIn;
  let loginCalls = 0;
  const status={textContent:'',classList:{remove(){},add(){}}};
  const loginBtn={textContent:'Login',disabled:false};
  const googleBtn={disabled:false,addEventListener(event,callback){events['google'+event]=callback}};
  const form={
    reportValidity:()=>true,setAttribute(){},
    querySelector:()=>loginBtn,addEventListener:(event,callback)=>{events[event]=callback}
  };
  const auth={
    signInWithPassword(){
      loginCalls++;
      return new Promise(resolve=>{resolveSignIn=resolve});
    }
  };
  const sandbox={
    URLSearchParams,FormData:class{get(key){return key==='email'?'test@example.test':'password'}},
    document:{getElementById:id=>({loginForm:form,authMessage:status,googleLoginBtn:googleBtn})[id]},
    window:{location:{origin:'https://pathway.example.test',href:''}},
    dcAuth:{
      getCurrentSession:async()=>null,
      getSupabaseClient:async()=>({auth}),
      getProfile:async()=>({account_role:'participant'})
    }
  };
  vm.runInNewContext(read('login.js'),sandbox);
  for(let i=0;i<7;i++)await Promise.resolve();
  const event={preventDefault(){}};
  const first=events.submit(event);
  for(let i=0;i<7;i++)await Promise.resolve();
  await events.submit(event);
  assert.equal(loginCalls,1,'Double login clicks must produce only one request');
  assert.equal(loginBtn.disabled,true,'Submitting should lock login button');
  assert.equal(googleBtn.disabled,true,'Submitting should lock Google button');
  resolveSignIn({data:{user:{id:'abc'}},error:null});
  await first;
  assert.equal(sandbox.window.location.href,'dashboard.html');
  assert.equal(loginBtn.disabled,true,'Login remains locked during navigation');
}
checkDuplicateLogin()
  .then(()=>console.log('Sitewide accessibility, stable SDK, cache and login-submit checks passed.'))
  .catch(error=>{console.error(error);process.exitCode=1});
