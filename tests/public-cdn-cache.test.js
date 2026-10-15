'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const contentPath=path.resolve(__dirname,'../netlify/functions/public-site-content.js');
const eventsPath=path.resolve(__dirname,'../netlify/functions/public-events.js');
const fake={
 from(name){
  return {
   select(){return this},
   eq(){return this},
   or(){return this},
   order(){return this},
   then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
  };
 }
};
async function run(){
 const old=Module._load;
 Module._load=function(name,parent,isMain){
  if(name==='@supabase/supabase-js')return {createClient:()=>fake};
  if(name==='./_auth'&&parent?.filename===contentPath){
   return {
    adminClient:()=>fake,
    json:(status,body)=>({statusCode:status,headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)})
   };
  }
  return old.call(this,name,parent,isMain);
 };
 try{
  delete require.cache[contentPath];
  delete require.cache[eventsPath];
  const content=require(contentPath).handler;
  const events=require(eventsPath).handler;
  process.env.SUPABASE_URL='https://public.example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-private-key';
  for(const fn of [content,events]){
   const good=await fn({httpMethod:'GET',queryStringParameters:{key:'team'}});
   assert.equal(good.statusCode,200);
   assert.match(good.headers['Netlify-CDN-Cache-Control'],/s-maxage=60/);
   assert.match(good.headers['Netlify-CDN-Cache-Control'],/durable/);
   assert.match(good.headers['Netlify-CDN-Cache-Control'],/stale-while-revalidate=60/);
   assert.doesNotMatch(good.headers['Cache-Control'],/max-age=3600/);
   const bad=await fn({httpMethod:'POST',queryStringParameters:{}});
   assert.equal(bad.statusCode,405);
   assert.equal(bad.headers['Cache-Control'],'no-store');
   assert.doesNotMatch(bad.headers['Netlify-CDN-Cache-Control']||'public',/s-maxage=/);
  }
  console.log('Public feed cache rules: public-only, limited freshness, no-cache errors passed.');
 }finally{Module._load=old;}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
