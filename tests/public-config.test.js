'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {buildPublicConfig}=require('../scripts/build-public-config');

const root=path.resolve(__dirname,'..');
const configFilename='cmc-public-config.json';
const authJs=fs.readFileSync(path.join(root,'auth.js'),'utf8');
const netlify=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');

async function verifyBuild(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cmc-public-config-'));
  try{
    const env={
      SUPABASE_URL:'https://public-example.supabase.co',
      SUPABASE_ANON_KEY:'public-anonymous-test-key',
      SUPABASE_SERVICE_ROLE_KEY:'do-not-ever-publish',
      ADMIN_PASSWORD:'private-password'
    };
    assert.equal(buildPublicConfig(tmp,env),true);
    const json=fs.readFileSync(path.join(tmp,configFilename),'utf8');
    assert.deepEqual(JSON.parse(json),{url:env.SUPABASE_URL,anonKey:env.SUPABASE_ANON_KEY});
    assert.equal(json.includes(env.SUPABASE_SERVICE_ROLE_KEY),false);
    assert.equal(json.includes(env.ADMIN_PASSWORD),false);
    assert.deepEqual(Object.keys(JSON.parse(json)).sort(),['anonKey','url']);
    assert.equal(buildPublicConfig(tmp,{}),false,'A build without env must not ship old configuration');
    assert.equal(fs.existsSync(path.join(tmp,configFilename)),false);
    assert.throws(()=>buildPublicConfig(tmp,{...env,SUPABASE_URL:'http://insecure.example'}),/HTTPS/);
    assert.throws(()=>buildPublicConfig(tmp,{...env,SUPABASE_ANON_KEY:'bad key'}),/whitespace/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}

function makeApp(fetch){
  const window={supabase:{createClient(url,anonKey){return {url,anonKey};}}};
  vm.runInNewContext(authJs,{window,fetch,URL});
  return window.dcAuth;
}
const response=(status,data)=>({ok:status===200,status,json:async()=>data});
async function verifyFallback(){
  let calls=[];
  const app=makeApp(async(route,options)=>{
    calls.push(route);
    assert.equal(options?.credentials,'omit','Public config requests must not send cookies');
    if(route==='/cmc-public-config.json'){
      return response(200,{url:'https://cached.supabase.co',anonKey:'public-key'});
    }
    throw new Error('Runtime config should not be called with a valid static file');
  });
  const [first,second]=await Promise.all([app.getSupabaseClient(),app.getSupabaseClient()]);
  assert.strictEqual(first,second,'Only one client and config request per page');
  assert.deepEqual(calls,['/cmc-public-config.json']);
  assert.equal(first.url,'https://cached.supabase.co');

  calls=[];
  const fallback=makeApp(async(route)=>{
    calls.push(route);
    return route==='/cmc-public-config.json'
      ? response(404,{})
      : response(200,{url:'https://runtime.supabase.co',anonKey:'fallback-key'});
  });
  assert.equal((await fallback.getSupabaseClient()).anonKey,'fallback-key');
  assert.deepEqual(calls,['/cmc-public-config.json','/.netlify/functions/supabase-config']);

  calls=[];
  const badStatic=makeApp(async route=>{
    calls.push(route);
    return route==='/cmc-public-config.json'
      ? response(200,{url:'http://insecure.example',anonKey:'wrong'})
      : response(200,{url:'https://runtime.supabase.co',anonKey:'correct'});
  });
  assert.equal((await badStatic.getSupabaseClient()).anonKey,'correct');
  assert.deepEqual(calls,['/cmc-public-config.json','/.netlify/functions/supabase-config']);

  calls=[];
  let attempts=0;
  const recover=makeApp(async route=>{
    calls.push(route);
    if(route==='/cmc-public-config.json'&&attempts++>=1){
      return response(200,{url:'https://recovered.supabase.co',anonKey:'new'});
    }
    throw new Error('Temporarily unavailable');
  });
  await assert.rejects(recover.getSupabaseClient(),/Temporarily unavailable/);
  assert.equal((await recover.getSupabaseClient()).anonKey,'new',
    'A temporary failure must not permanently poison the client promise');
  assert.deepEqual(calls,[
    '/cmc-public-config.json','/.netlify/functions/supabase-config',
    '/cmc-public-config.json'
  ]);
}
(async()=>{
  await verifyBuild();
  await verifyFallback();
  assert.match(netlify,/command\s*=\s*"npm run build"/);
  assert.match(netlify,/for\s*=\s*"\/cmc-public-config\.json"/);
  assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/^cmc-public-config\.json$/m);
  console.log('Public Supabase config: generated on build, contains no secrets, session startup/rollback/fallback passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
