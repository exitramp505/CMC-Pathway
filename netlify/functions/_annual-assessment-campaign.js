const {Resend}=require('resend');
const {regionOf}=require('./_leadership-access');
const REGIONS=['Central','East','Mountain Plains','Pacific','Southeast'];
const EMAIL_KINDS=['invitation','reminder'];
const DEFAULTS={
  id:'national',enabled:true,first_campaign_year:2027,
  invitation_day:1,reminder_day:15,due_day:28,
  subject_template:'Your {year} CMC Annual Systems Assessment is ready',
  email_intro:'Each year, we take time to reflect on the health of our church multiplication systems. Please complete your annual assessment in CMC Pathway.'
};
const APP_URL='https://pathway.openbiblecmc.org';
const clean=value=>String(value??'').trim();
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function easternDate(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(date);
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function defaultYear(now=new Date()){
  const {year,month}=easternDate(now);
  return year<=2026?year:year-1;
}
function dueDate(reportingYear,settings=DEFAULTS){
  return (reportingYear+1)+'-02-'+String(settings.due_day||28).padStart(2,'0');
}
function safeSettings(input){
  const settings={...DEFAULTS,...input};
  for(const key of ['first_campaign_year','invitation_day','reminder_day','due_day']){
    settings[key]=Number(settings[key]);
    if(!Number.isInteger(settings[key]))throw new Error('Invalid schedule '+key);
  }
  if(settings.first_campaign_year<2027||settings.first_campaign_year>2100 ||
     settings.invitation_day<1||settings.invitation_day>14 ||
     settings.reminder_day<2||settings.reminder_day>27 ||
     settings.due_day<15||settings.due_day>28 ||
     !(settings.invitation_day<settings.reminder_day&&settings.reminder_day<=settings.due_day))
    throw new Error('Choose February dates in order: assignment, reminder, deadline.');
  settings.subject_template=clean(settings.subject_template).slice(0,160);
  settings.email_intro=clean(settings.email_intro).slice(0,1600);
  if(!settings.subject_template||!settings.email_intro)throw new Error('Email subject and introduction are required.');
  if(typeof settings.enabled!=='boolean')throw new Error('Enable or disable the annual schedule.');
  return settings;
}
async function loadSettings(sb){
  const {data,error}=await sb.from('cmc_annual_assessment_settings')
    .select('id,enabled,first_campaign_year,invitation_day,reminder_day,due_day,subject_template,email_intro,updated_at')
    .eq('id','national').maybeSingle();
  if(error)throw error;
  return safeSettings(data||DEFAULTS);
}
async function directors(sb){
  const {data,error}=await sb.from('candidate_profiles')
    .select('id,full_name,email,region,account_role,cmc_regional_director_region,cmc_national_access')
    .in('account_role',['regional_leader','cmc_admin'])
    .is('archived_at',null)
    .order('full_name',{ascending:true}).limit(400);
  if(error)throw error;
  return (data||[]).filter(p=>Boolean(regionOf(p))).map(p=>({...p,region:regionOf(p)}));
}
async function submittedIds(sb,reportingYear){
  const {data,error}=await sb.from('cmc_regional_assessments')
    .select('director_id').eq('reporting_year',reportingYear).eq('status','submitted').limit(500);
  if(error)throw error;
  return new Set((data||[]).map(r=>r.director_id));
}
async function assignmentsFor(sb,reportingYear){
  const {data,error}=await sb.from('cmc_annual_assessment_assignments')
    .select('id,director_id,reporting_year,region,due_date,assigned_at')
    .eq('reporting_year',reportingYear).limit(500);
  if(error)throw error;
  return data||[];
}
async function ensureAssignments(sb,reportingYear,roster,settings){
  const existing=await assignmentsFor(sb,reportingYear);
  const known=new Set(existing.map(row=>row.director_id));
  const missing=roster.filter(p=>!known.has(p.id));
  if(missing.length){
    const values=missing.map(p=>({director_id:p.id,reporting_year:reportingYear,region:p.region,due_date:dueDate(reportingYear,settings)}));
    // Unique constraint makes reruns and concurrent February workers safe.
    const {error}=await sb.from('cmc_annual_assessment_assignments')
      .upsert(values,{onConflict:'director_id,reporting_year',ignoreDuplicates:true});
    if(error)throw error;
  }
  return {assignments:await assignmentsFor(sb,reportingYear),created:missing.length};
}
function composeEmail(director,assignment,kind,settings){
  const year=assignment.reporting_year;
  const name=clean(director.full_name).split(/\s+/)[0]||'there';
  const due='February '+settings.due_day+', '+(year+1);
  const url=APP_URL+'/regional-assessment.html?year='+year;
  const subject=kind==='reminder'
    ? 'Reminder: your '+year+' CMC Annual Systems Assessment is due '+due
    :settings.subject_template.replaceAll('{year}',String(year)).replaceAll('{due_date}',due);
  const intro=kind==='reminder'
    ? 'Your annual CMC systems assessment has not yet been submitted. Please complete it by '+due+'.'
    :settings.email_intro;
  const text=['Hi '+name+',','',intro,'','Reporting year: '+year,
    'Due date: '+due,'','Start or continue your assessment:',url,'',
    'You can save a draft and return to it. After submission, the annual action will be marked complete on your CMC Pathway dashboard.',
    '','Open Bible CMC Leadership'].join('\n');
  const html='<div style="font-family:Arial,sans-serif;background:#fbf0de;color:#293d48;padding:28px 16px">'+
    '<div style="max-width:580px;margin:auto;background:white;border-radius:18px;overflow:hidden">'+
    '<div style="background:#293d48;padding:28px"><div style="font-size:12px;color:#ea9f43;font-weight:800;letter-spacing:1.3px">OPEN BIBLE CMC</div>'+
    '<h1 style="font-size:26px;color:white;margin:10px 0 0">Annual Systems Assessment</h1></div>'+
    '<div style="padding:28px"><p>Hi '+escapeHtml(name)+',</p><p style="line-height:1.6">'+escapeHtml(intro)+'</p>'+
    '<p><strong>Reporting year:</strong> '+year+'<br><strong>Due:</strong> '+escapeHtml(due)+'</p>'+
    '<a href="'+url+'" style="display:inline-block;background:#2a675a;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Open my assessment</a>'+
    '<p style="line-height:1.6;color:#5d6f73;font-size:13px">Save your work as a draft at any time. Once submitted, your annual task will automatically be completed.</p>'+
    '</div></div></div>';
  return {subject,text,html,url};
}
async function sendNotice(sb,assignment,director,kind,settings,{sendImpl}={}){
  if(!EMAIL_KINDS.includes(kind))throw new Error('Unknown annual email kind.');
  const address=clean(director.email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return {state:'missing_email'};
  const {data:claim,error:claimError}=await sb.from('cmc_annual_assessment_emails')
    .insert({assignment_id:assignment.id,kind,recipient_email:address,status:'sending'})
    .select('id').maybeSingle();
  if(claimError?.code==='23505')return {state:'already_queued'};
  if(claimError)throw claimError;
  if(!claim)throw new Error('Could not reserve annual assessment email.');
  const apiKey=process.env.RESEND_API_KEY,from=process.env.FROM_EMAIL;
  if(!apiKey||!from){
    await sb.from('cmc_annual_assessment_emails').update({status:'failed',last_error:'Email sender is not configured.'}).eq('id',claim.id);
    return {state:'failed',error:'Email sender is not configured.'};
  }
  const content=composeEmail(director,assignment,kind,settings);
  try{
    const sender=sendImpl||((message,options)=>new Resend(apiKey).emails.send(message,options));
    const result=await sender({from,to:[address],subject:content.subject,html:content.html,text:content.text},{
      idempotencyKey:'cmc-annual-'+assignment.reporting_year+'-'+director.id+'-'+kind
    });
    if(result.error||!result.data?.id)throw new Error(result.error?.message||'Email provider did not accept this message.');
    const {error}=await sb.from('cmc_annual_assessment_emails').update({
      status:'sent',sent_at:new Date().toISOString(),provider_id:result.data.id,last_error:null
    }).eq('id',claim.id);
    if(error)throw error;
    return {state:'sent'};
  }catch(error){
    // We do not automatically resend an ambiguous email failure: that risks duplicates
    // when a provider accepted a message but our request timed out.
    await sb.from('cmc_annual_assessment_emails').update({status:'failed',last_error:String(error.message||error).slice(0,500)}).eq('id',claim.id);
    return {state:'failed',error:String(error.message||error)};
  }
}
async function noticesFor(sb,ids){
  if(!ids.length)return [];
  const {data,error}=await sb.from('cmc_annual_assessment_emails')
    .select('id,assignment_id,kind,status,recipient_email,sent_at,attempted_at,last_error')
    .in('assignment_id',ids).limit(1000);
  if(error)throw error;
  return data||[];
}
async function runCycle(sb,{
  now=new Date(),reportingYear=null,mode='automatic',sendEmails=true,sendImpl
}={}){
  const settings=await loadSettings(sb);
  const day=easternDate(now);
  const campaignYear=reportingYear==null?day.year:Number(reportingYear)+1;
  const targetYear=campaignYear-1;
  if(mode==='automatic'){
    if(!settings.enabled||campaignYear<settings.first_campaign_year||day.month!==2||
       day.day<settings.invitation_day||day.day>settings.due_day)
      return {skipped:true,reason:'Outside active February campaign window.',reporting_year:targetYear};
  }
  if(!Number.isInteger(targetYear)||targetYear<2026||targetYear>2100)throw new Error('Invalid reporting year.');
  const roster=await directors(sb);
  const {assignments,created}=await ensureAssignments(sb,targetYear,roster,settings);
  const directorById=new Map(roster.map(p=>[p.id,p]));
  const submitted=await submittedIds(sb,targetYear);
  const result={reporting_year:targetYear,created,assigned:assignments.length,
    submitted:submitted.size,initial_sent:0,reminders_sent:0,failed:0,missing_email:0,already_queued:0};
  if(!sendEmails)return result;
  const noticeRows=await noticesFor(sb,assignments.map(a=>a.id));
  const existing=new Map(noticeRows.map(x=>[x.assignment_id+':'+x.kind,x]));
  const canRemind=day.month===2&&day.day>=settings.reminder_day;
  for(const assignment of assignments){
    if(submitted.has(assignment.director_id))continue;
    const director=directorById.get(assignment.director_id);
    if(!director)continue;
    const invite=existing.get(assignment.id+':invitation');
    if(!invite){
      const outcome=await sendNotice(sb,assignment,director,'invitation',settings,{sendImpl});
      if(outcome.state==='sent')result.initial_sent++;
      else if(outcome.state==='failed')result.failed++;
      else if(outcome.state==='missing_email')result.missing_email++;
      else result.already_queued++;
      continue;
    }
    if(!canRemind||invite.status!=='sent'||existing.has(assignment.id+':reminder'))continue;
    // An invitation just sent on the reminder date gets at least one full day before a reminder.
    if(Date.parse(invite.sent_at||'')>now.getTime()-24*60*60*1000)continue;
    const outcome=await sendNotice(sb,assignment,director,'reminder',settings,{sendImpl});
    if(outcome.state==='sent')result.reminders_sent++;
    else if(outcome.state==='failed')result.failed++;
    else if(outcome.state==='missing_email')result.missing_email++;
    else result.already_queued++;
  }
  return result;
}
async function ownAssessmentStatus(sb,viewer,now=new Date()){
  if(!viewer||!regionOf(viewer))return null;
  const {data:assignment,error}=await sb.from('cmc_annual_assessment_assignments')
    .select('id,reporting_year,due_date,assigned_at')
    .eq('director_id',viewer.id).order('reporting_year',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  const year=assignment?.reporting_year??defaultYear(now);
  const {data:record,error:recordError}=await sb.from('cmc_regional_assessments')
    .select('id,status,submitted_at,updated_at,scores').eq('director_id',viewer.id).eq('reporting_year',year).maybeSingle();
  if(recordError)throw recordError;
  const scored=Object.keys(record?.scores||{}).length;
  return {reporting_year:year,assigned:Boolean(assignment),due_date:assignment?.due_date||null,
    assigned_at:assignment?.assigned_at||null,record_id:record?.id||null,
    status:record?.status==='submitted'?'submitted':record?.id?'draft':'not_started',
    submitted_at:record?.submitted_at||null,scored_systems:scored};
}
module.exports={DEFAULTS,REGIONS,easternDate,defaultYear,dueDate,safeSettings,loadSettings,directors,
  assignmentsFor,submittedIds,ensureAssignments,composeEmail,sendNotice,noticesFor,runCycle,ownAssessmentStatus};
