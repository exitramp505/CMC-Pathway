const {parseGoogleIcal}=require('./_calendar-ics');
const MAX_ICS_SIZE=1_500_000;
const FRESH_FOR_MS=15*60*1000;
function validatePrivateIcal(url,calendarId){
  let parsed;
  try{parsed=new URL(String(url||''));}catch(_){return false;}
  if(parsed.protocol!=='https:'||parsed.hostname!=='calendar.google.com'||parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash)return false;
  const match=parsed.pathname.match(/^\/calendar\/ical\/([^/]+)\/private-[A-Za-z0-9_-]+\/basic\.ics$/);
  if(!match)return false;
  try{return decodeURIComponent(match[1])===calendarId;}catch(_){return false;}
}
async function settingsFor(supabase){
  const {data,error}=await supabase.from('cmc_national_calendar_settings')
    .select('calendar_id,label,secret_ical_url,updated_at').eq('id','national').maybeSingle();
  if(error)throw error;
  return data;
}
async function cacheFor(supabase,calendarId,now){
  const {data,error}=await supabase.from('cmc_calendar_events_cache')
    .select('calendar_id,occurrence_id,title,starts_at,ends_at,description,location,event_url,status,synced_at')
    .eq('calendar_id',calendarId).gte('ends_at',now.toISOString())
    .order('starts_at',{ascending:true}).limit(100);
  if(error)throw error;
  return data||[];
}
async function fetchGoogleIcal(url){
  const response=await fetch(url,{
    headers:{Accept:'text/calendar; charset=utf-8'},
    redirect:'error',signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw new Error('Google Calendar feed is unavailable.');
  if(Number(response.headers.get('content-length')||0)>MAX_ICS_SIZE)throw new Error('Google Calendar feed exceeds size limit.');
  const calendar=await response.text();
  if(calendar.length>MAX_ICS_SIZE||!calendar.includes('BEGIN:VCALENDAR'))throw new Error('Invalid private Google Calendar feed.');
  return calendar;
}
async function refreshCalendar(supabase,settings,now){
  if(!settings?.calendar_id||!settings.secret_ical_url)return false;
  if(!validatePrivateIcal(settings.secret_ical_url,settings.calendar_id))throw new Error('Invalid private calendar feed configuration.');
  const feed=await fetchGoogleIcal(settings.secret_ical_url);
  const daysPast=new Date(now.getTime()-86400000);
  const horizon=new Date(now.getTime()+440*86400000);
  const entries=parseGoogleIcal(feed,settings.calendar_id,daysPast,horizon);
  if(entries.length>0){
    const {error}=await supabase.from('cmc_calendar_events_cache')
      .upsert(entries.map(row=>({...row,synced_at:now.toISOString()})),{onConflict:'calendar_id,occurrence_id'});
    if(error)throw error;
  }
  // Remove changed/deleted Google occurrences only after a successful full feed read.
  // Restrict to this calendar and future records; older history remains untouched.
  const {error:cleanupError}=await supabase.from('cmc_calendar_events_cache')
    .delete().eq('calendar_id',settings.calendar_id)
    .gte('starts_at',daysPast.toISOString()).lt('synced_at',now.toISOString());
  if(cleanupError)throw cleanupError;
  return true;
}
const toEvent=x=>({
  id:'google:'+x.occurrence_id,
  title:x.title,summary:'Official Google Calendar',
  description:x.description||'',
  starts_at:x.starts_at,ends_at:x.ends_at,
  location_name:x.location&&/^https:\/\//i.test(x.location)?'Online / Zoom':x.location||'',
  address:'',region:null,status:x.status,
  public_url:x.event_url,
  join_url:/^https:\/\//i.test(x.location||'')?x.location:null,
  notes_url:'https://pathway.openbiblecmc.org/leadership-home.html#meetings',
  source:'google_calendar',synced_at:x.synced_at
});
async function loadCalendar(supabase,{now=new Date(),refresh=false}={}){
  const config=await settingsFor(supabase);
  if(!config?.calendar_id)return {calendar:null,events:[]};
  let cache=await cacheFor(supabase,config.calendar_id,now);
  const latest=cache.reduce((v,e)=>Math.max(v,Date.parse(e.synced_at)||0),0);
  const configured=Boolean(config.secret_ical_url);
  let warning=null;
  if(configured&&(refresh||!latest||now.getTime()-latest>FRESH_FOR_MS)){
    try{
      await refreshCalendar(supabase,config,now);
      cache=await cacheFor(supabase,config.calendar_id,now);
    }catch(error){
      console.warn('CMC calendar feed refresh failed:',error.message);
      warning='Google Calendar could not refresh; showing the last available meeting schedule.';
    }
  }
  const syncedAt=cache.reduce((v,e)=>Math.max(v,Date.parse(e.synced_at)||0),0);
  return {
    calendar:{
      calendar_id:config.calendar_id,label:config.label||'Open Bible CMC Leadership',
      feed_enabled:configured,
      synced_at:syncedAt?new Date(syncedAt).toISOString():null,
      sync_mode:configured&&!warning?'automatic':configured?'stale':'snapshot',
      google_url:'https://calendar.google.com/calendar/u/0/r?cid='+encodeURIComponent(config.calendar_id)
    },
    events:cache.filter(x=>x.status!=='cancelled').map(toEvent),
    warning
  };
}
module.exports={loadCalendar,validatePrivateIcal,refreshCalendar,toEvent};
