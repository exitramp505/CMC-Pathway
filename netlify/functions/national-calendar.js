const {json,requireUser,httpError}=require('./_auth');
async function viewer(event){
 const auth=await requireUser(event);
 const result=await auth.supabase.from('candidate_profiles').select('account_role,archived_at').eq('id',auth.user.id).maybeSingle();
 if(result.error)throw result.error;
 const profile=result.data;
 if(!profile||profile.archived_at||!['cmc_admin','regional_leader','cmc_viewer'].includes(profile.account_role))throw httpError(403,'Leadership access required.');
 return {...auth,profile};
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return json(405,{ok:false,error:'Method not allowed.'});
 try{
 const auth=await viewer(event);
 if(event.httpMethod==='GET'){
  const result=await auth.supabase.from('cmc_national_calendar_settings').select('calendar_id,label,updated_at').eq('id','national').maybeSingle();
  if(result.error)throw result.error;
  return json(200,{ok:true,calendar:result.data||null});
 }
 if(auth.profile.account_role!=='cmc_admin')throw httpError(403,'National administrator required.');
 const body=JSON.parse(event.body||'{}');
 const id=String(body.calendar_id||'').trim();
 if(id && (id.length>220||!id.includes('@')||id.includes(' ')||id.includes('/')))throw httpError(400,'Enter a valid Google Calendar ID.');
 const label=String(body.label||'Open Bible CMC Leadership').trim().slice(0,90);
 if(!label)throw httpError(400,'Enter a calendar label.');
 const result=await auth.supabase.from('cmc_national_calendar_settings').upsert({id:'national',calendar_id:id||null,label,updated_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:'id'});
 if(result.error)throw result.error;
 return json(200,{ok:true,calendar:{calendar_id:id||null,label}});
 }catch(error){
  return json(error.statusCode||500,{ok:false,error:error.statusCode?error.message:'Could not save calendar settings.'});
 }
};