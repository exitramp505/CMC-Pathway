const {json,requireUser,httpError}=require('./_auth');
const {defaultYear,safeSettings,loadSettings,directors,assignmentsFor,noticesFor,runCycle,REGIONS}=require('./_annual-assessment-campaign');
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function reportingYear(value){
  const year=Number(value);
  if(!Number.isInteger(year)||year<2026||year>new Date().getUTCFullYear()+1)
    throw httpError(400,'Choose a valid reporting year.');
  return year;
}
async function admin(event){
  const {user,supabase}=await requireUser(event);
  const {data,error}=await supabase.from('candidate_profiles')
    .select('id,account_role,archived_at').eq('id',user.id).maybeSingle();
  if(error)throw error;
  if(!data||data.archived_at||data.account_role!=='cmc_admin')
    throw httpError(403,'National administrator access is required.');
  return {supabase,viewer:data};
}
async function overview(sb,reportingYear){
  const [settings,roster,assignments]=await Promise.all([
    loadSettings(sb),directors(sb),assignmentsFor(sb,reportingYear)
  ]);
  const {data:assessmentRows,error}=await sb.from('cmc_regional_assessments')
    .select('id,director_id,reporting_year,status,submitted_at,updated_at')
    .eq('reporting_year',reportingYear).limit(500);
  if(error)throw error;
  const emails=await noticesFor(sb,assignments.map(x=>x.id));
  const assignmentMap=new Map(assignments.map(x=>[x.director_id,x]));
  const assessmentMap=new Map((assessmentRows||[]).map(x=>[x.director_id,x]));
  const notices=new Map(emails.map(x=>[x.assignment_id+':'+x.kind,x]));
  const directorsView=roster.map(person=>{
    const assignment=assignmentMap.get(person.id);
    const assessment=assessmentMap.get(person.id);
    const invitation=assignment?notices.get(assignment.id+':invitation'):null;
    const reminder=assignment?notices.get(assignment.id+':reminder'):null;
    return {id:person.id,name:person.full_name||person.email,region:person.region,
      email:person.email||null,account_role:person.account_role,
      assignment_id:assignment?.id||null,due_date:assignment?.due_date||null,
      assigned_at:assignment?.assigned_at||null,
      assessment_id:assessment?.id||null,submitted_at:assessment?.submitted_at||null,
      status:assessment?.status||'not_started',
      invitation:{status:invitation?.status||'not_sent',sent_at:invitation?.sent_at||null,error:invitation?.last_error||null},
      reminder:{status:reminder?.status||'not_sent',sent_at:reminder?.sent_at||null,error:reminder?.last_error||null}
    };
  });
  const submitted=directorsView.filter(x=>x.status==='submitted').length;
  const assigned=directorsView.filter(x=>x.assignment_id).length;
  return {settings,reporting_year:reportingYear,
    campaign_year:reportingYear+1,roster:directorsView,
    summary:{directors:directorsView.length,assigned,submitted,
      outstanding:Math.max(0,assigned-submitted),
      initial_emails_sent:directorsView.filter(x=>x.invitation.status==='sent').length,
      reminders_sent:directorsView.filter(x=>x.reminder.status==='sent').length,
      email_issues:directorsView.filter(x=>x.invitation.status==='failed'||x.reminder.status==='failed'||!x.email).length}};
}
exports.handler=async event=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const {viewer,supabase}=await admin(event);
    const body=event.httpMethod==='POST'?JSON.parse(event.body||'{}'):{};
    const year=reportingYear(body.year||event.queryStringParameters?.year||defaultYear());
    if(event.httpMethod==='GET')return json(200,{ok:true,...await overview(supabase,year)});
    if(body.action==='save_settings'){
      let validated;
      try{validated=safeSettings(body.settings||{});}catch(error){throw httpError(400,error.message);}
      const updates={
        id:'national',enabled:validated.enabled,first_campaign_year:validated.first_campaign_year,
        invitation_day:validated.invitation_day,reminder_day:validated.reminder_day,
        due_day:validated.due_day,subject_template:validated.subject_template,
        email_intro:validated.email_intro,updated_by:viewer.id,updated_at:new Date().toISOString()
      };
      const {error}=await supabase.from('cmc_annual_assessment_settings').upsert(updates,{onConflict:'id'});
      if(error)throw error;
      return json(200,{ok:true,...await overview(supabase,year)});
    }
    if(body.action==='assign'||body.action==='send'){
      if(body.action==='send'&&body.confirmation!=='SEND')
        throw httpError(400,'Confirm that you want to email all outstanding directors.');
      const result=await runCycle(supabase,{reportingYear:year,mode:'manual',sendEmails:body.action==='send'});
      return json(200,{ok:true,result,...await overview(supabase,year)});
    }
    if(body.action==='reopen'){
      const id=String(body.assessment_id||'');
      const reason=String(body.reason||'').trim().slice(0,500);
      if(!UUID.test(id)||reason.length<8)throw httpError(400,'Provide an assessment and an explanation (at least 8 characters).');
      const {data:prior,error:readError}=await supabase.from('cmc_regional_assessments')
        .select('id,reporting_year,status').eq('id',id).maybeSingle();
      if(readError)throw readError;
      if(!prior||prior.status!=='submitted')throw httpError(409,'Only submitted assessments can be reopened.');
      const {data:updated,error:updateError}=await supabase.from('cmc_regional_assessments')
        .update({status:'draft',submitted_at:null,updated_at:new Date().toISOString()})
        .eq('id',id).eq('status','submitted').select('id').maybeSingle();
      if(updateError)throw updateError;
      if(!updated)throw httpError(409,'The assessment changed; refresh the page.');
      const {error:logError}=await supabase.from('cmc_annual_assessment_audit')
        .insert({assessment_id:id,actor_id:viewer.id,action:'reopened',reason});
      if(logError){console.error('Annual assessment reopen audit failed',logError);throw httpError(500,'The assessment was reopened, but the audit log failed. Contact an administrator.');}
      return json(200,{ok:true,...await overview(supabase,year)});
    }
    throw httpError(400,'Unknown annual assessment action.');
  }catch(error){
    console.error('Annual assessment admin error',error.statusCode||error.message);
    return json(error.statusCode||500,{ok:false,error:error.statusCode?error.message:'Could not load or update annual assessments.'});
  }
};
exports._test={reportingYear,overview};
