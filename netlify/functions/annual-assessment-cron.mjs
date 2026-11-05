// Netlify Scheduled Function. Runs at 8 AM Eastern during February (13:00 UTC).
// The campaign engine decides whether the invitation or reminder is due, and logs
// each notice uniquely so reruns never create duplicate assignments or messages.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {adminClient}=require('./_auth.js');
const {runCycle}=require('./_annual-assessment-campaign.js');
export default async ()=>{
  if(process.env.CONTEXT && process.env.CONTEXT!=='production'){
    console.info('Annual CMC assessment: skipping non-production execution.');
    return new Response(null,{status:204});
  }
  const sb=adminClient();
  if(!sb){
    console.error('Annual CMC assessment: Supabase service credentials missing.');
    return new Response(null,{status:500});
  }
  try{
    const result=await runCycle(sb,{mode:'automatic',now:new Date(),sendEmails:true});
    console.info('Annual CMC assessment campaign:',JSON.stringify(result));
    return new Response(null,{status:204});
  }catch(error){
    console.error('Annual CMC assessment campaign failed:',error.message);
    return new Response(null,{status:500});
  }
};
