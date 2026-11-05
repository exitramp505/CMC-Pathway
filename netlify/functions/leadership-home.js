const { json, requireUser, httpError } = require('./_auth');
const {loadCalendar}=require('./_national-calendar-events');
const {ownAssessmentStatus}=require('./_annual-assessment-campaign');
const {regionOf,nationalReporting,nationalAdmin}=require('./_leadership-access');
const REGIONS = ['Central','East','Mountain Plains','Pacific','Southeast'];
const KINDS = ['task','meeting'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id,kind,title,region,visibility,body,notes,decisions,starts_at,due_date,meeting_id,assigned_to,completed_at,created_by,created_at,updated_at';

function canSee(viewer, item) {
  if(item.visibility === 'personal') return item.created_by === viewer.id;
  if(nationalReporting(viewer)) return true;
  return item.region === regionOf(viewer) || item.region === null;
}
function canEdit(viewer, item) {
  if(viewer.account_role === 'cmc_viewer') return false;
  if(item.visibility === 'personal') return item.created_by === viewer.id;
  if(nationalAdmin(viewer)) return true;
  return Boolean(regionOf(viewer)) && item.region === regionOf(viewer);
}
function isLead(viewer) { return ['regional_leader','cmc_admin','cmc_viewer'].includes(viewer?.account_role); }
function clean(value,max) { return String(value ?? '').trim().slice(0,max); }
function validDate(value, dateOnly=false) {
  if (!value) return null;
  if(dateOnly && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw httpError(400,'Enter a valid date.');
  const parsed = new Date(dateOnly ? value + 'T12:00:00Z' : value);
  if(!Number.isFinite(parsed.getTime())) throw httpError(400,'Enter a valid date.');
  return dateOnly ? value : parsed.toISOString();
}
function normalized(input,viewer,existing) {
  const kind = existing?.kind || input.kind;
  if(!KINDS.includes(kind)) throw httpError(400,'Choose a meeting or reminder.');
  if(viewer.account_role === 'cmc_viewer') throw httpError(403,'This account has read-only access.');
  const visibility = kind === 'meeting' ? 'team' : input.visibility === 'personal' ? 'personal' : 'team';
  const title = clean(input.title,160);
  if(!title) throw httpError(400,'A title is required.');
  let region = input.region === '' || input.region == null ? null : clean(input.region,40);
  if(region && !REGIONS.includes(region)) throw httpError(400,'Choose a valid region.');
  if(viewer.account_role === 'regional_leader') {
    if(visibility === 'team') region = viewer.region;
    else region = viewer.region;
  }
  if(viewer.account_role === 'regional_leader' && !REGIONS.includes(viewer.region)) throw httpError(403,'Your region is not configured.');
  if(visibility === 'personal' && viewer.account_role === 'cmc_admin') region = region || viewer.region || null;
  const start = kind === 'meeting' ? validDate(input.starts_at) : null;
  if(kind === 'meeting' && !start) throw httpError(400,'Meeting date and time are required.');
  let assigned_to = null, meeting_id = null;
  if(kind === 'task') {
    if(input.assigned_to && !UUID.test(input.assigned_to)) throw httpError(400,'Invalid assignee.');
    assigned_to = input.assigned_to || null;
    if(input.meeting_id && !UUID.test(input.meeting_id)) throw httpError(400,'Invalid meeting.');
    meeting_id = input.meeting_id || null;
  }
  return {
    kind,title,region,visibility,
    body:clean(input.body,12000),
    notes:kind === 'meeting' ? clean(input.notes,30000) : '',
    decisions:kind === 'meeting' ? clean(input.decisions,12000) : '',
    starts_at:start,
    due_date:kind === 'task' ? validDate(input.due_date,true) : null,
    meeting_id,assigned_to
  };
}

async function loadProfiles(supabase,viewer) {
  let q=supabase.from('candidate_profiles')
    .select('id,full_name,email,region,account_role,cmc_national_access,cmc_regional_director_region')
    .in('account_role',['regional_leader','cmc_admin','cmc_viewer'])
    .order('full_name',{ascending:true});
  if(!nationalReporting(viewer)) q=q.eq('region',regionOf(viewer));
  const {data,error}=await q;
  if(error) throw error;
  return data || [];
}
async function loadItems(supabase,viewer) {
  const {data,error}=await supabase.from('cmc_leadership_items').select(FIELDS)
    .order('created_at',{ascending:false}).limit(500);
  if(error) throw error;
  return (data||[]).filter(x=>canSee(viewer,x));
}
async function listEvents(supabase,viewer) {
  const now=new Date().toISOString();
  let query=supabase.from('cmc_events')
    .select('id,title,summary,description,starts_at,ends_at,location_name,address,region,status,public_url')
    .eq('status','published')
    .or('starts_at.gte.'+now+',and(ends_at.not.is.null,ends_at.gte.'+now+')')
    .order('starts_at',{ascending:true})
    .limit(60);
  const {data,error}=await query;
  if(error) throw error;
  return (data||[]).filter(e=>nationalReporting(viewer) || !e.region || e.region===regionOf(viewer)).slice(0,10);
}
async function getViewer(event) {
  const auth=await requireUser(event);
  const {data:viewer,error}=await auth.supabase.from('candidate_profiles')
    .select('id,full_name,email,region,account_role,cmc_national_access,cmc_regional_director_region')
    .eq('id',auth.user.id).maybeSingle();
  if(error) throw error;
  if(!isLead(viewer)) throw httpError(403,'Leadership access is required.');
  return {...auth,viewer};
}
async function loadSingle(sb,id) {
  if(!UUID.test(id)) throw httpError(400,'Invalid record.');
  const {data,error}=await sb.from('cmc_leadership_items').select(FIELDS).eq('id',id).maybeSingle();
  if(error) throw error;
  return data;
}
async function validateRelations(sb,viewer,item) {
  if(item.kind !== 'task') return;
  if(item.visibility==='personal' && item.assigned_to && item.assigned_to!==viewer.id) throw httpError(400,'Private reminders can only be assigned to you.');
  if(item.assigned_to) {
    const {data:target,error}=await sb.from('candidate_profiles').select('id,region,account_role').eq('id',item.assigned_to).maybeSingle();
    if(error) throw error;
    if(!target || !isLead(target)) throw httpError(400,'Choose a current leader.');
    if(viewer.account_role==='regional_leader' && target.region!==viewer.region) throw httpError(403,'That leader is outside your region.');
    if(item.region && target.account_role==='regional_leader' && target.region!==item.region) throw httpError(400,'The assignee is outside this region.');
  }
  if(item.meeting_id) {
    const meeting=await loadSingle(sb,item.meeting_id);
    if(!meeting || meeting.kind!=='meeting' || !canSee(viewer,meeting) || !canEdit(viewer,meeting)) throw httpError(400,'Choose a meeting you can edit.');
    if(meeting.region !== item.region) throw httpError(400,'The reminder must use the meeting region.');
  }
}
exports.handler=async event=>{
  if(!['GET','POST','PATCH','DELETE'].includes(event.httpMethod))
    return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const {supabase,viewer}=await getViewer(event);
    if(event.httpMethod==='GET') {
      const [itemResult,eventResult,leaderResult,calendarResult,annualResult]=await Promise.allSettled([
        loadItems(supabase,viewer),listEvents(supabase,viewer),loadProfiles(supabase,viewer),
        loadCalendar(supabase),ownAssessmentStatus(supabase,viewer)
      ]);
      if(itemResult.status==='rejected')throw itemResult.reason;
      const warnings=[];
      if(eventResult.status==='rejected')warnings.push('Upcoming CMC events could not be loaded.');
      if(leaderResult.status==='rejected')warnings.push('Leader assignments could not be loaded.');
      if(calendarResult.status==='rejected')warnings.push('Google Calendar meetings could not be loaded.');
      if(annualResult.status==='rejected')warnings.push('Annual assessment status could not be loaded.');
      if(calendarResult.status==='fulfilled'&&calendarResult.value.warning)warnings.push(calendarResult.value.warning);
      const normalEvents=eventResult.status==='fulfilled'?eventResult.value:[];
      const googleEvents=calendarResult.status==='fulfilled'?calendarResult.value.events:[];
      const events=[...normalEvents,...googleEvents]
        .sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).slice(0,60);
      return json(200,{ok:true,viewer,items:itemResult.value,
        calendar:calendarResult.status==='fulfilled'?calendarResult.value.calendar:null,
        annual_assessment:annualResult.status==='fulfilled'?annualResult.value:null,
        events,leaders:leaderResult.status==='fulfilled'?leaderResult.value:[],warnings});
    }
    if(viewer.account_role==='cmc_viewer') throw httpError(403,'This account has read-only access.');
    const body=JSON.parse(event.body||'{}');
    if(event.httpMethod==='POST'){
      const record=normalized(body,viewer);
      await validateRelations(supabase,viewer,record);
      const {data,error}=await supabase.from('cmc_leadership_items')
        .insert({...record,created_by:viewer.id}).select(FIELDS).single();
      if(error) throw error;
      return json(201,{ok:true,item:data});
    }
    const existing=await loadSingle(supabase,String(body.id||event.queryStringParameters?.id||''));
    if(!existing || !canSee(viewer,existing)) throw httpError(404,'Record not found.');
    if(!canEdit(viewer,existing)) throw httpError(403,'You cannot modify this record.');
    if(event.httpMethod==='DELETE'){
      const {error}=await supabase.from('cmc_leadership_items').delete().eq('id',existing.id);
      if(error) throw error;
      return json(200,{ok:true});
    }
    // Preserve ownership and scope unless an admin explicitly changes the record.
    const next=normalized({...existing,...body},viewer,existing);
    if(viewer.account_role==='regional_leader' && existing.region!==next.region) throw httpError(403,'Cannot change the record region.');
    if(viewer.account_role==='regional_leader' && existing.visibility!==next.visibility) throw httpError(403,'Cannot change visibility.');
    await validateRelations(supabase,viewer,next);
    const update={...next,completed_at:next.kind==='task' && body.completed===true ? new Date().toISOString()
      : next.kind==='task' && body.completed===false ? null : existing.completed_at,updated_at:new Date().toISOString()};
    const {data,error}=await supabase.from('cmc_leadership_items')
      .update(update).eq('id',existing.id).select(FIELDS).single();
    if(error) throw error;
    return json(200,{ok:true,item:data});
  }catch(error){
    console.error('Leadership home error',error);
    return json(error.statusCode||500,{ok:false,error:error.statusCode?error.message:'Could not save or load the leadership workspace.'});
  }
};
exports._test={canSee,canEdit,normalized};
