const {json,requireUser,httpError}=require('./_auth');
const {loadCalendar,validatePrivateIcal}=require('./_national-calendar-events');
const GOOGLE_CALENDAR_ID=/^[A-Za-z0-9_.+%=-]+@[A-Za-z0-9_.-]+$/;
async function getViewer(event){
  const auth=await requireUser(event);
  const {data:profile,error}=await auth.supabase.from('candidate_profiles')
    .select('account_role,archived_at').eq('id',auth.user.id).maybeSingle();
  if(error)throw error;
  if(!profile||profile.archived_at||
     !['cmc_admin','regional_leader','cmc_viewer'].includes(profile.account_role))
    throw httpError(403,'CMC leadership access required.');
  return {...auth,profile};
}
exports.handler=async event=>{
  if(!['GET','POST'].includes(event.httpMethod))
    return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const auth=await getViewer(event);
    if(event.httpMethod==='GET'){
      return json(200,{ok:true,...await loadCalendar(auth.supabase)});
    }
    if(auth.profile.account_role!=='cmc_admin')
      throw httpError(403,'Only national administrators can change the official calendar.');
    const body=JSON.parse(event.body||'{}');
    const id=String(body.calendar_id||'').trim();
    const label=String(body.label||'Open Bible CMC Leadership').trim().slice(0,90);
    if(id&&(id.length>220||!GOOGLE_CALENDAR_ID.test(id)))
      throw httpError(400,'Enter a valid Google Calendar ID.');
    if(!label)throw httpError(400,'Enter a calendar display name.');
    const {data:prior,error:priorError}=await auth.supabase.from('cmc_national_calendar_settings')
      .select('calendar_id,secret_ical_url').eq('id','national').maybeSingle();
    if(priorError)throw priorError;
    let feed=prior?.calendar_id===id?prior?.secret_ical_url||null:null;
    if(body.remove_feed===true)feed=null;
    else if(body.private_ical_url!=null&&String(body.private_ical_url).trim()){
      const candidate=String(body.private_ical_url).trim();
      if(candidate.length>1300||!validatePrivateIcal(candidate,id))
        throw httpError(400,'Use the Secret address in iCal format for this exact Google Calendar.');
      feed=candidate;
    }
    const {error}=await auth.supabase.from('cmc_national_calendar_settings').upsert({
      id:'national',calendar_id:id||null,label,secret_ical_url:feed,
      updated_by:auth.user.id,updated_at:new Date().toISOString()
    },{onConflict:'id'});
    if(error)throw error;
    const data=await loadCalendar(auth.supabase,{refresh:Boolean(feed)});
    return json(200,{ok:true,...data});
  }catch(error){
    console.error('National calendar integration error',error.statusCode||error.message);
    return json(error.statusCode||500,{
      ok:false,error:error.statusCode?error.message:'Unable to access the CMC calendar configuration.'
    });
  }
};
exports._test={GOOGLE_CALENDAR_ID};
