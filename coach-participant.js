(async function(){
  const user=await dcAuth.requireUser();
  if(!user)return;
  const profile=await dcAuth.getProfile(user.id).catch(()=>null);
  if(!profile?.is_coach){location.replace('dashboard.html');return}
  dcAuth.renderRoleNavigation(profile,'coaching');
  const id=new URLSearchParams(location.search).get('id');
  const shell=document.getElementById('coachParticipant');
  if(!id){shell.innerHTML='<p class="cmcLeaderError">Choose a participant.</p>';return}
  const sb=await dcAuth.getSupabaseClient();
  const token=(await sb.auth.getSession()).data?.session?.access_token||'';
  try{
    const response=await fetch(`/.netlify/functions/coach-dashboard?participant_id=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||'Could not load this participant.');
    render(data);
  }catch(error){
    shell.innerHTML=`<div class="cmcLeaderError"><strong>Unable to open this coaching overview.</strong><p>${esc(error.message)}</p></div>`;
  }

  function render(data){
    const person=data.participant;
    const enrollments=new Map(data.enrollments.map(item=>[item.course_id,item]));
    const upcoming=data.events.filter(item=>item.event?.status==='published'&&new Date(item.event.ends_at||item.event.starts_at)>new Date());
    document.title=`${person.full_name||'Participant'} | Coaching`;
    shell.innerHTML=`
      <section class="cmcParticipantHero cmcCoachParticipantHero">
        <div class="cmcParticipantIdentity"><span class="cmcParticipantAvatar">${initials(person.full_name)}</span><div><p class="cmcEyebrow">${esc(person.region)} · ${esc(title(person.current_stage||'discover'))}</p><h1>${esc(person.full_name||person.email)}</h1><p class="cmcIntro">${esc([person.ministry_role,person.church_name].filter(Boolean).join(' · ')||'CMC Pathway participant')}</p></div></div>
        <a class="cmcSecondaryAction" href="mailto:${esc(person.email)}">Email participant</a>
      </section>
      <div class="cmcCoachParticipantGrid">
        <section class="cmcParticipantMainPanel"><div class="cmcDetailSectionHeading"><div><p class="cmcEyebrow">TASK PLANS</p><h2>Current plans</h2></div><p>Open a plan to review progress or mark ordinary tasks complete.</p></div><div class="cmcParticipantTaskPlanList">${data.plans.length?data.plans.map(plan=>`<article><div><span>${esc(title(plan.stage_key))}</span><strong>${esc(plan.title)}</strong><small>${esc(plan.description||'Working plan')}</small></div><a href="task-plan.html?id=${esc(plan.id)}&participant_id=${esc(person.id)}&coach=1">Open plan →</a></article>`).join(''):'<p class="cmcDetailEmpty">No active task plan has been assigned.</p>'}</div></section>
        <aside class="cmcCoachParticipantSide">
          <section class="cmcParticipantInfoCard"><p class="cmcEyebrow">ASSESSMENTS</p><h2>Reports</h2><div class="cmcCoachReportList">${data.reports.length?data.reports.map(report=>`<a href="participant-record.html?participant=${esc(person.id)}&type=assessment&record=${esc(report.id)}"><span><strong>${esc(report.title)}</strong><small>${esc(formatDate(report.created_at))}${report.overall_label?` · ${esc(report.overall_label)}`:''}</small></span>→</a>`).join(''):'<p>No assessment reports yet.</p>'}</div></section>
          <section class="cmcParticipantInfoCard"><p class="cmcEyebrow">COURSE PROGRESS</p><h2>Courses</h2><div class="cmcCoachCourseList">${data.courses.map(course=>{const enrollment=enrollments.get(course.id);return`<div><span><strong>${esc(course.title)}</strong><small>${esc(title(course.stage_key))}</small></span><b>${Math.round(Number(enrollment?.progress||0))}%</b></div>`}).join('')||'<p>No courses available.</p>'}</div></section>
          <section class="cmcParticipantInfoCard"><p class="cmcEyebrow">UPCOMING EVENTS</p><h2>Schedule</h2><div class="cmcCoachCourseList">${upcoming.length?upcoming.map(item=>`<div><span><strong>${esc(item.event.title)}</strong><small>${esc(formatDate(item.event.starts_at))}${item.event.location_name?` · ${esc(item.event.location_name)}`:''}</small></span><b>${esc(title(item.rsvp_status||'pending'))}</b></div>`).join(''):'<p>No upcoming events.</p>'}</div></section>
        </aside>
      </div>`;
  }
  function formatDate(value){return new Date(value).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}
  function title(value){return String(value).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
  function initials(value){return String(value||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
  function esc(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
})();
