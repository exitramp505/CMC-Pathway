const {json,requireUser,httpError} = require('./_auth');
const config=require('../../regional-assessment-config.json');
const REGIONS=['Central','East','Mountain Plains','Pacific','Southeast'];
const VALID_SCORES=new Set(config.sections.map(s=>s.id));
const VALID_QUESTIONS=new Set(config.sections.flatMap(s=>s.questions.map(q=>q.id)));
const VALID_REFLECTIONS=new Set(config.reflections.map(r=>r.id));
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

function yearParam(value) {
 const year=Number(value);
 if(!Number.isInteger(year)||year<2022||year>new Date().getUTCFullYear()+1)throw httpError(400,'Choose a valid reporting year.');
 return year;
}
function normalizeText(input,valid,max) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw httpError(400,'Invalid assessment answers.');
 const result={};
 for(const [key,value] of Object.entries(input)){
   if(!valid.has(key))throw httpError(400,'Unknown assessment question: '+key);
   if(typeof value!=='string'||value.length>max)throw httpError(400,'One of the responses is too long.');
   if(value.trim())result[key]=value.trim();
 }
 return result;
}
function normalizeScores(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw httpError(400,'Invalid system scores.');
 const out={};
 for(const [key,value] of Object.entries(input)){
   if(!VALID_SCORES.has(key))throw httpError(400,'Unknown system score.');
   if(value===null||value==='')continue;
   const n=Number(value);
   if(!Number.isInteger(n)||n<0||n>25)throw httpError(400,'Each system score must be a whole number from 0 to 25.');
   out[key]=n;
 }
 return out;
}
function validateSubmission(scores,reflections) {
 const missing=config.sections.filter(s=>!Object.hasOwn(scores,s.id)).map(s=>s.name);
 if(missing.length)throw httpError(400,'Complete all eight system scores before submitting: '+missing.join(', ')+'.');
 if(!reflections.r7)throw httpError(400,'Describe the five next steps you can take in the next 45 days before submitting.');
}
async function viewerFor(event) {
 const {user,supabase}=await requireUser(event);
 const {data:viewer,error}=await supabase.from('candidate_profiles')
   .select('id,full_name,email,region,account_role,archived_at').eq('id',user.id).maybeSingle();
 if(error)throw error;
 if(!viewer||viewer.archived_at||!['regional_leader','cmc_admin','cmc_viewer'].includes(viewer.account_role))throw httpError(403,'CMC leadership access is required.');
 return {viewer,supabase};
}
function handleError(error){
 return json(error.statusCode||500,{ok:false,error:error.statusCode?error.message:'Could not load or save the annual assessment.'});
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return json(405,{ok:false,error:'Method not allowed.'});
 try{
 const {viewer,supabase}=await viewerFor(event);
 const mode=event.queryStringParameters?.mode||'mine';
 const national=['cmc_admin','cmc_viewer'].includes(viewer.account_role);
 if(event.httpMethod==='GET'){
   if(mode==='mine'){
     if(viewer.account_role!=='regional_leader')throw httpError(403,'Only regional directors complete annual assessments.');
     if(!REGIONS.includes(viewer.region))throw httpError(403,'Your region must be set before starting the assessment.');
     const year=yearParam(event.queryStringParameters?.year||new Date().getUTCFullYear());
     const [current,history]=await Promise.all([
       supabase.from('cmc_regional_assessments').select('*').eq('director_id',viewer.id).eq('reporting_year',year).maybeSingle(),
       supabase.from('cmc_regional_assessments').select('id,region,reporting_year,status,submitted_at,scores,updated_at').eq('director_id',viewer.id).order('reporting_year',{ascending:false})
     ]);
     if(current.error)throw current.error;if(history.error)throw history.error;
     return json(200,{ok:true,viewer,year,record:current.data||null,history:history.data||[]});
   }
   if(mode==='reports'){
     if(!national)throw httpError(403,'National reporting access is required.');
     const year=yearParam(event.queryStringParameters?.year||new Date().getUTCFullYear());
     const [entries,roster]=await Promise.all([
       supabase.from('cmc_regional_assessments')
         .select('id,director_id,director_name,region,reporting_year,scores,submitted_at')
         .eq('status','submitted').gte('reporting_year',Math.max(2022,year-1)).lte('reporting_year',year)
         .order('submitted_at',{ascending:false}).limit(500),
       supabase.from('candidate_profiles').select('id,full_name,region')
         .eq('account_role','regional_leader').is('archived_at',null)
         .order('full_name',{ascending:true})
     ]);
     if(entries.error)throw entries.error;if(roster.error)throw roster.error;
     return json(200,{ok:true,viewer,year,entries:entries.data||[],roster:roster.data||[]});
   }
   if(mode==='detail'){
     const id=String(event.queryStringParameters?.id||'');
     if(!UUID.test(id))throw httpError(400,'Invalid assessment identifier.');
     const {data,error}=await supabase.from('cmc_regional_assessments').select('*').eq('id',id).maybeSingle();
     if(error)throw error;
     if(!data||(!national&&data.director_id!==viewer.id)||(national&&data.status!=='submitted'))throw httpError(404,'Assessment not found.');
     return json(200,{ok:true,viewer,record:data});
   }
   throw httpError(400,'Unknown assessment view.');
 }
 if(viewer.account_role!=='regional_leader')throw httpError(403,'Only regional directors can complete the assessment.');
 if(!REGIONS.includes(viewer.region))throw httpError(403,'Your account needs a valid Open Bible region.');
 const body=JSON.parse(event.body||'{}');
 if(!['save','submit'].includes(body.action))throw httpError(400,'Choose save or submit.');
 const year=yearParam(body.year||new Date().getUTCFullYear());
 const answers=normalizeText(body.answers,VALID_QUESTIONS,3000);
 const scores=normalizeScores(body.scores);
 const reflections=normalizeText(body.reflections,VALID_REFLECTIONS,7000);
 if(body.action==='submit')validateSubmission(scores,reflections);
 const {data:existing,error:readError}=await supabase.from('cmc_regional_assessments')
   .select('id,status,region').eq('director_id',viewer.id).eq('reporting_year',year).maybeSingle();
 if(readError)throw readError;
 if(existing?.status==='submitted')throw httpError(409,'This year’s assessment has already been submitted and is locked.');
 if(existing&&existing.region!==viewer.region)throw httpError(409,'Your region changed. Ask a national administrator to review this draft.');
 const now=new Date().toISOString();
 const payload={director_name:viewer.full_name||viewer.email||'Regional CMC Director',
   region:viewer.region,answers,scores,reflections,updated_at:now,
   status:body.action==='submit'?'submitted':'draft',
   submitted_at:body.action==='submit'?now:null};
 let result;
 if(existing){
   result=await supabase.from('cmc_regional_assessments').update(payload)
     .eq('id',existing.id).eq('status','draft')
     .select('id,region,reporting_year,status,submitted_at,updated_at,scores,answers,reflections').maybeSingle();
 }else{
   result=await supabase.from('cmc_regional_assessments')
     .insert({...payload,director_id:viewer.id,reporting_year:year})
     .select('id,region,reporting_year,status,submitted_at,updated_at,scores,answers,reflections').maybeSingle();
 }
 if(result.error){
   if(result.error.code==='23505')throw httpError(409,'An assessment for this year already exists. Refresh and try again.');
   throw result.error;
 }
 if(!result.data)throw httpError(409,'This assessment changed while you were editing it. Refresh to continue.');
 return json(200,{ok:true,record:result.data});
 }catch(error){console.error('Regional assessment error',error.statusCode||error.message);return handleError(error);}
};
exports._test={normalizeScores,normalizeText,validateSubmission,yearParam};
