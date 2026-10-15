(async function(){
  const session=await dcAuth.getCurrentSession().catch(()=>null);
  if(!session?.user){window.location.href='login.html';return}
  // Coach dashboard verifies permissions and returns the current viewer.
  // Avoid an extra client profile request for the same role information.
  const token=session.access_token||'';
  let people=[];
  const list=document.getElementById('coachPeopleList');
  document.getElementById('coachPeopleSearch').addEventListener('input',render);
  try{
    const response=await fetch('/.netlify/functions/coach-dashboard',{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){window.location.href='login.html';return}
    if(response.status===403){window.location.replace('dashboard.html');return}
    if(!response.ok||!data.ok)throw new Error(data.error||'Could not load your people.');
    if(!data.viewer?.is_coach)throw new Error('Coach permissions could not be verified.');
    dcAuth.renderRoleNavigation(data.viewer,'coaching');
    people=data.participants||[];document.getElementById('coachRegions').textContent=(data.regions||[]).join(' · ')||'No region assigned';document.getElementById('coachPeopleCount').textContent=`${people.length} active ${people.length===1?'relationship':'relationships'}`;render()}catch(error){list.innerHTML=`<div class="cmcLeaderError"><strong>Unable to load coaching.</strong><p>${esc(error.message)}</p></div>`}function render(){const query=document.getElementById('coachPeopleSearch').value.toLowerCase().trim();const visible=people.filter(person=>[person.full_name,person.email,person.church_name,person.region].join(' ').toLowerCase().includes(query));list.innerHTML=visible.length?visible.map(person=>`<article><span class="cmcAvatar">${initials(person.full_name)}</span><div class="cmcCoachPersonCopy"><small>${esc(person.region)} · ${esc(title(person.current_stage||'discover'))}</small><strong>${esc(person.full_name||person.email)}</strong><span>${esc([person.ministry_role,person.church_name].filter(Boolean).join(' · ')||person.email)}</span><div class="cmcCoachPersonProgress"><i style="width:${person.task_progress}%"></i></div><em>${person.task_plan_count?`${person.task_progress}% of task-plan work complete`:'No task plan assigned'}</em></div><a class="cmcPrimaryButton" href="coach-participant.html?id=${esc(person.id)}">Open overview →</a></article>`).join(''):'<div class="cmcLeaderEmpty">No active coaching relationships match this view.</div>'}function title(value){return String(value).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}function initials(value){return String(value||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}function esc(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}})();
