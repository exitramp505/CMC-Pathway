(async function(){
  const $=id=>document.getElementById(id);
  const session=await dcAuth.getCurrentSession().catch(()=>null);
  if(!session?.user){window.location.replace('login.html');return;}
  const token=session.access_token||'';
  const ROLES=['regional_leader','cmc_admin','cmc_viewer'];
  const state={viewer:null,items:[],events:[],leaders:[]};
  let taskFilter='mine',meetingExpanded=false,allTasksExpanded=false,peopleLoaded=false,toaster=null,currentRelatedMeeting=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const title=s=>String(s||'').replace(/\s+[-–—]\s*$/,'').trim();
  const pad=n=>String(n).padStart(2,'0');
  const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
  const shortDate=iso=>{if(!iso)return 'No date';const parts=String(iso).split('-').map(Number);if(parts.length!==3||parts.some(n=>!Number.isFinite(n)))return 'No date';return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(parts[0],parts[1]-1,parts[2],12));};
  const dateTime=iso=>{if(!iso)return 'Not scheduled';const d=new Date(iso);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d):'Invalid date';};
  const shortTime=iso=>new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));
  const dateBadge=iso=>{const d=new Date(iso);return '<span class="cmcHomeDateBadge" aria-hidden="true"><small>'+esc(new Intl.DateTimeFormat(undefined,{month:'short'}).format(d))+'</small><strong>'+esc(new Intl.DateTimeFormat(undefined,{day:'numeric'}).format(d))+'</strong></span>';};
  const localInput=iso=>{if(!iso)return '';const d=new Date(iso);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
  const role=()=>state.viewer?.account_role||'';
  const national=()=>role()==='cmc_admin'||role()==='cmc_viewer';
  const readonly=()=>role()==='cmc_viewer';
  const canEdit=item=>!readonly()&&(!item||item.visibility==='personal'?(!item||item.created_by===state.viewer.id):(role()==='cmc_admin'||item.region===state.viewer.region));
  const ownerName=id=>state.leaders.find(p=>p.id===id)?.full_name||state.leaders.find(p=>p.id===id)?.email||(id?'Assigned leader':'Unassigned');
  const isMine=item=>item.visibility==='personal'||item.assigned_to===state.viewer.id||(!item.assigned_to&&item.created_by===state.viewer.id);
  const openTasks=()=>state.items.filter(x=>x.kind==='task'&&!x.completed_at);
  const allMeetings=()=>state.items.filter(x=>x.kind==='meeting');
  const futureMeetings=()=>allMeetings().filter(x=>new Date(x.starts_at).getTime()>=Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  const elHtml=(id,html)=>{$(id).innerHTML=html;};
  const setText=(id,value)=>{$(id).textContent=String(value??'');};
  function notice(message,error=false){
    const node=$('homeMessage');node.textContent=message||'';node.hidden=!message;node.classList.toggle('error',error);
  }
  function toast(message){
    const n=$('homeToast');n.textContent=message;n.classList.remove('hidden');
    if(toaster)clearTimeout(toaster);
    toaster=setTimeout(()=>n.classList.add('hidden'),3300);
  }
  async function api(method='GET',body){
    const response=await fetch('/.netlify/functions/leadership-home',{method,headers:{
      Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})
    },...(body?{body:JSON.stringify(body)}:{})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ok)throw new Error(payload.error||'The leadership workspace could not complete that request.');
    return payload;
  }
  function empty(icon,heading,description,buttonText,action){
    return '<div class="cmcHomeEmptyState"><span class="cmcHomeEmptyIcon" aria-hidden="true">'+icon+'</span><strong>'+esc(heading)+'</strong><p>'+esc(description)+'</p>'+
      (buttonText&&!readonly()?'<button type="button" data-quick="'+esc(action)+'">'+esc(buttonText)+'</button>':'')+'</div>';
  }

  function renderOverview(){
    setText('openActionsCount',openTasks().length);
    setText('upcomingMeetingsCount',futureMeetings().length);
    setText('upcomingEventsCount',state.events.length);
  }
  function renderTasks(){
    const mine=openTasks().filter(isMine);
    const team=openTasks().filter(x=>x.visibility==='team');
    const done=state.items.filter(x=>x.kind==='task'&&x.completed_at);
    setText('mineTaskCount',mine.length);
    setText('teamTaskCount',team.length);
    const tabs=document.querySelectorAll('[data-task-filter]');
    tabs.forEach(b=>{const active=b.dataset.taskFilter===taskFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    const items=(taskFilter==='mine'?mine:taskFilter==='team'?team:done)
      .slice().sort((a,b)=>taskFilter==='done'?String(b.completed_at).localeCompare(String(a.completed_at)):
        String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))||String(a.created_at).localeCompare(String(b.created_at)));
    if(!items.length){
      const copy=taskFilter==='mine'?['No actions assigned to you','Personal and assigned follow-ups will appear here.','Add your first action','task']:
        taskFilter==='team'?['No shared actions yet','Add a team action or create follow-ups from a meeting.','Add a team action','task']:
          ['No completed actions yet','Completed reminders stay in this history so you can refer back to them.',null,null];
      elHtml('reminderList',empty('✓',copy[0],copy[1],copy[2],copy[3]));
      return;
    }
    const rendered=(allTasksExpanded?items:items.slice(0,12)).map(item=>{
      const doneFlag=Boolean(item.completed_at),overdue=!doneFlag&&item.due_date&&item.due_date<todayKey();
      const due=item.due_date?(doneFlag?'Completed · ':overdue?'Overdue · ':'Due ')+shortDate(item.due_date):
        doneFlag?'Completed '+dateTime(item.completed_at):'No due date';
      const scope=item.visibility==='personal'?'Private':item.region||'National';
      const who=item.assigned_to?' · '+ownerName(item.assigned_to):'';
      const taskEditable=canEdit(item);
      const action=taskEditable?
        '<button type="button" class="cmcHomeTick'+(doneFlag?' isDone':'')+'" data-toggle="'+esc(item.id)+'" data-value="'+(doneFlag?'false':'true')+'" aria-label="'+(doneFlag?'Reopen':'Complete')+' '+esc(item.title)+'">'+(doneFlag?'↺':'✓')+'</button>':'';
      return '<article class="cmcHomeTask"><div class="cmcHomeTaskCopy"><strong>'+esc(item.title)+'</strong><p class="cmcHomeTaskMeta">'+
        (overdue?'<span class="cmcHomeTag isOverdue">Overdue</span> ':'')+esc(due+' · '+scope+who)+
        '</p></div><div class="cmcHomeRowActions">'+action+'<button type="button" class="cmcHomeRowButton" data-open="'+esc(item.id)+'">'+(taskEditable?'Edit':'View')+'</button></div></article>';
    }).join('');
    elHtml('reminderList',rendered+(items.length>12?'<button type="button" class="cmcHomeTextButton" data-more-tasks>'+(allTasksExpanded?'Show fewer':'Show all '+items.length+' action items')+'</button>':''));
  }
  function renderMeetings(){
    const upcoming=futureMeetings();
    if(upcoming.length){
      const next=upcoming[0],description=(next.body||'Agenda not added yet.').split('\n')[0].slice(0,130);
      elHtml('nextMeeting','<div class="cmcHomeFeature"><div><p class="cmcEyebrow">NEXT LEADERSHIP MEETING</p><strong>'+esc(title(next.title))+'</strong><p>'+
        esc(dateTime(next.starts_at)+' · '+(next.region||'National'))+'</p><p>'+esc(description)+'</p></div>'+
        '<button class="cmcHomeRowButton" type="button" data-open="'+esc(next.id)+'">Open agenda</button></div>');
    }else{
      elHtml('nextMeeting',empty('▦','No leadership meetings scheduled','Create a meeting to prepare an agenda and capture its decisions.','Schedule a meeting','meeting'));
    }
    const search=$('meetingSearch').value.trim().toLowerCase();
    const archive=allMeetings().filter(x=>!upcoming.length||x.id!==upcoming[0].id)
      .filter(x=>!search||[x.title,x.body,x.notes,x.decisions,x.region].join(' ').toLowerCase().includes(search))
      .sort((a,b)=>String(b.starts_at).localeCompare(String(a.starts_at)));
    const shown=meetingExpanded?archive:archive.slice(0,3);
    $('viewAllMeetings').classList.toggle('hidden',archive.length<=3);
    $('viewAllMeetings').setAttribute('aria-expanded',String(meetingExpanded));
    setText('viewAllMeetings',meetingExpanded?'Show fewer':'View all '+archive.length);
    if(!archive.length){
      elHtml('meetingList','<p class="cmcHomeMeetingListHeading">Meeting history</p><p class="cmcHomeHelper">'+
        esc(search?'No meetings match that search.':'Past agendas, notes, and decisions will collect here after your first meeting.')+'</p>');
      return;
    }
    elHtml('meetingList','<p class="cmcHomeMeetingListHeading">Meeting history</p>'+shown.map(x=>{
      const summary=(x.decisions||x.notes||x.body||'Agenda saved.').trim().replace(/\s+/g,' ').slice(0,135);
      return '<article class="cmcHomeMeetingRow"><div class="cmcHomeMeetingCopy"><strong>'+esc(title(x.title))+'</strong><p class="cmcHomeMeetingMeta">'+esc(dateTime(x.starts_at))+' · '+esc(x.region||'National')+'</p><p>'+esc(summary)+'</p></div>'+
        '<button type="button" class="cmcHomeRowButton" data-open="'+esc(x.id)+'">Open</button></article>';
    }).join(''));
  }
  function renderCalendar(){
    const now=Date.now();
    const events=[
      ...state.events.filter(x=>new Date(x.ends_at||x.starts_at).getTime()>=now).map(x=>({...x,_kind:'event',when:x.starts_at})),
      ...futureMeetings().map(x=>({...x,_kind:'meeting',when:x.starts_at}))
    ].sort((a,b)=>String(a.when).localeCompare(String(b.when))).slice(0,7);
    if(!events.length){
      elHtml('upcomingList',empty('▦','Nothing scheduled yet','Published CMC events and your upcoming leadership meetings will appear here.','Schedule a meeting','meeting'));
      return;
    }
    elHtml('upcomingList',events.map(x=>{
      const details=x._kind==='meeting'?'Meeting':'CMC event';
      const name=title(x.title);
      const where=x.location_name?' · '+x.location_name:'';
      const button=x._kind==='meeting'?
        '<button type="button" class="cmcHomeTextButton" data-open="'+esc(x.id)+'">Agenda</button>':
        '<button type="button" class="cmcHomeTextButton" data-event-details="'+esc(x.id)+'">Details</button>';
      return '<article class="cmcHomeCalendarRow">'+dateBadge(x.when)+'<div class="cmcHomeCalendarCopy"><strong>'+esc(name)+'</strong>'+
        '<p class="cmcHomeCalendarMeta">'+esc(dateTime(x.when))+'</p><p class="cmcHomeCalendarMeta">'+esc(details+where)+'</p></div>'+button+'</article>';
    }).join(''));
    $('eventCaveat').classList.remove('hidden');
  }
  async function loadPeople(){
    if(peopleLoaded||readonly())return;
    peopleLoaded=true;
    try{
      const response=await fetch('/.netlify/functions/regional-participants',{headers:{Authorization:'Bearer '+token}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload.ok)throw new Error(payload.error||'Could not load pathway information.');
      const participants=(payload.participants||[]).filter(p=>p.account_role==='participant'&&!p.archived_at);
      const followup=participants.filter(p=>{
        const discover=(p.assignments||[]).find(x=>x.item_key==='discover_course'&&x.status==='assigned');
        return discover&&(Number(discover.progress)|| (discover.external_status==='completed'?100:0))>=100;
      });
      const discern=participants.filter(p=>(p.assignments||[]).some(x=>x.stage_key==='discern'&&x.status==='assigned'));
      setText('activityScope',national()?'ALL REGIONS':'REGIONAL PATHWAY');
      elHtml('peopleSummary',[
        ['Active participants',participants.length],
        ['Ready to follow up',followup.length],
        ['In discernment',discern.length]
      ].map(([name,value])=>'<div class="cmcHomeProgressStat"><strong>'+value+'</strong><span>'+esc(name)+'</span></div>').join('')+
      '<p class="cmcHomeProgressNote">'+(followup.length?esc(followup.length+' participant'+(followup.length===1?' is':'s are')+' ready for a leader conversation.'):'Open People to review progress and assignments.')+'</p>');
    }catch(error){
      elHtml('peopleSummary','<p class="cmcHomeEmpty">'+esc(error.message)+'</p><button type="button" class="cmcHomeRowButton" data-retry-people>Try again</button>');
    }
  }
  function renderAll(){renderOverview();renderTasks();renderMeetings();renderCalendar();}
  async function load(){
    try{
      const data=await api();
      if(!ROLES.includes(data.viewer?.account_role)){window.location.replace('dashboard.html');return;}
      state.viewer=data.viewer;state.items=data.items||[];state.events=data.events||[];state.leaders=data.leaders||[];
      dcAuth.renderRoleNavigation(state.viewer,'home');
      const isNational=national();
      setText('leadershipRegion',isNational?'NATIONAL LEADERSHIP':'OPEN BIBLE '+String(state.viewer.region||'').toUpperCase()+' REGION');
      const givenName=String(state.viewer.full_name||'').trim().split(/\s+/)[0];
      setText('leadershipGreeting','Welcome back'+(givenName?', '+givenName:'')+'.');
      setText('homeToday',new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date()));
      if(isNational){taskFilter='team';}else{taskFilter='mine';}
      const assessmentLink=$('regionalAssessmentLink');
      assessmentLink.href=role()==='regional_leader'?'regional-assessment.html':'regional-reports.html';
      assessmentLink.firstChild.textContent=role()==='regional_leader'?'Open assessment ':'View national reports ';
      $('newMeeting').classList.toggle('hidden',readonly());
      $('newReminder').classList.toggle('hidden',readonly());
      $('allEventsLink').classList.toggle('hidden',readonly());
      $('activity').classList.toggle('hidden',readonly());
      document.querySelector('[data-task-filter="mine"]').classList.toggle('hidden',readonly());
      $('itemRegion').disabled=role()==='regional_leader';
      renderAll();
      notice(Array.isArray(data.warnings)&&data.warnings.length?data.warnings.join(' '):'',Boolean(data.warnings?.length));
      loadPeople();
    }catch(err){
      notice(err.message||'Unable to load your leadership workspace.',true);
      elHtml('reminderList',empty('!','Unable to load actions','Refresh the page to try again.',null,null));
      elHtml('meetingList','');elHtml('upcomingList','');
    }
  }
  function meetingOptions(){
    const region=role()==='regional_leader'?state.viewer.region:$('itemRegion').value||null;
    const current=$('itemMeeting').value;
    $('itemMeeting').innerHTML='<option value="">None</option>'+
      allMeetings().filter(x=>x.region===region).sort((a,b)=>String(b.starts_at).localeCompare(String(a.starts_at)))
        .map(x=>'<option value="'+esc(x.id)+'">'+esc(title(x.title))+'</option>').join('');
    if(allMeetings().some(x=>x.id===current&&x.region===region))$('itemMeeting').value=current;
  }
  function assigneeOptions(){
    const region=role()==='regional_leader'?state.viewer.region:$('itemRegion').value||null;
    const current=$('itemAssignee').value;
    const people=state.leaders.filter(p=>p.account_role!=='cmc_viewer' && (!region||p.account_role==='cmc_admin'||p.region===region));
    $('itemAssignee').innerHTML='<option value="">Unassigned</option>'+
      people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.email)+'</option>').join('');
    if(people.some(p=>p.id===current))$('itemAssignee').value=current;
  }
  function adjustTaskScope(){
    const isPrivate=$('itemVisibility').value==='personal';
    $('assigneeRow').classList.toggle('hidden',isPrivate);
    $('parentMeetingRow').classList.toggle('hidden',isPrivate);
    if(isPrivate){$('itemAssignee').value='';$('itemMeeting').value='';}
  }
  function openEventDetails(id){
    const event=state.events.find(x=>x.id===id);
    if(!event)return;
    setText('eventDetailsTitle',title(event.title));
    setText('eventDetailsTime',dateTime(event.starts_at)+(event.ends_at?' – '+dateTime(event.ends_at):''));
    setText('eventDetailsLocation',[event.location_name,event.address].filter(Boolean).join(' · ')||'Location not listed');
    setText('eventDetailsDescription',event.description||event.summary||'No additional description was provided.');
    const a=$('eventDetailsLink');
    let valid=false;
    if(event.public_url)try{const url=new URL(event.public_url);if(url.protocol==='https:'||url.protocol==='http:'){a.href=url.href;valid=true;}}catch(_){}
    a.classList.toggle('hidden',!valid);
    if(!valid)a.removeAttribute('href');
    $('eventDetailsDialog').showModal();
  }
  function renderMeetingFollowups(meeting){
    if(!meeting||meeting.kind!=='meeting'){ $('meetingFollowups').classList.add('hidden');return;}
    $('meetingFollowups').classList.remove('hidden');
    const editable=canEdit(meeting);
    $('addMeetingFollowup').classList.toggle('hidden',!editable);
    const tasks=state.items.filter(x=>x.kind==='task'&&x.meeting_id===meeting.id);
    elHtml('meetingFollowupList',tasks.length?tasks.map(x=>
      '<div class="cmcHomeFollowupsItem"><div><span>'+esc(x.title)+'</span><br><small>'+
      esc(x.completed_at?'Completed':x.due_date?'Due '+shortDate(x.due_date):'No due date')+'</small></div><button class="cmcHomeRowButton" type="button" data-related-task="'+esc(x.id)+'">View</button></div>'
    ).join(''):'<p class="cmcHomeHelper">No follow-up actions linked to this meeting yet.</p>');
  }
  function openEditor(kind,id=null,related=null){
    if(!state.viewer)return;
    const item=id?state.items.find(x=>x.id===id):null;
    if(id&&!item)return;
    const isMeeting=kind==='meeting';
    const permitted=canEdit(item);
    const parent=related?allMeetings().find(x=>x.id===related):null;
    $('leadershipForm').reset();
    $('editorMessage').textContent='';
    $('itemId').value=item?.id||'';
    $('itemKind').value=kind;
    currentRelatedMeeting=related||null;
    setText('editorTitle',(item?'':'New ')+(isMeeting?'meeting':'action item'));
    setText('editorDescription',isMeeting?(item?'Review the agenda, discussion and follow-up actions.':'Prepare the conversation. Notes and decisions can be added after saving.'):'Track an agreed next step, assignee, and due date.');
    $('itemTitle').value=item?.title||'';
    const initialRegion=item?item.region:parent?parent.region:role()==='regional_leader'?state.viewer.region:null;
    $('itemRegion').value=initialRegion||'';
    $('itemStart').value=localInput(item?.starts_at);
    $('itemStart').required=isMeeting;
    $('itemDue').value=item?.due_date||'';
    $('itemBody').value=item?.body||'';
    $('itemNotes').value=item?.notes||'';
    $('itemDecisions').value=item?.decisions||'';
    $('itemVisibility').value=item?.visibility||'team';
    setText('bodyLabel',isMeeting?'Agenda':'Details');
    $('itemBody').placeholder=isMeeting?'Topics, questions, and outcomes to cover':'What needs to happen?';
    $('agendaRow').classList.remove('hidden');
    $('meetingDateRow').classList.toggle('hidden',!isMeeting);
    $('dueDateRow').classList.toggle('hidden',isMeeting);
    $('visibilityRow').classList.toggle('hidden',isMeeting);
    $('notesRow').classList.toggle('hidden',!isMeeting||!item);
    $('decisionsRow').classList.toggle('hidden',!isMeeting||!item);
    $('assigneeRow').classList.toggle('hidden',isMeeting);
    $('parentMeetingRow').classList.toggle('hidden',isMeeting);
    $('regionRow').classList.toggle('hidden',role()==='regional_leader');
    $('itemRegion').disabled=role()==='regional_leader'||!permitted;
    assigneeOptions();meetingOptions();
    $('itemAssignee').value=item?.assigned_to||'';
    $('itemMeeting').value=item?.meeting_id||related||'';
    if(!isMeeting)adjustTaskScope();
    renderMeetingFollowups(isMeeting?item:null);
    $('leadershipForm').querySelectorAll('input,select,textarea').forEach(el=>{
      if(el.type!=='hidden')el.disabled=!permitted||(el.id==='itemRegion'&&role()==='regional_leader');
    });
    $('deleteItem').classList.toggle('hidden',!item||!permitted);
    $('saveItem').classList.toggle('hidden',!permitted);
    $('cancelEditor').textContent=permitted?'Cancel':'Close';
    $('leadershipEditor').showModal();
    if(permitted)$('itemTitle').focus();
  }
  function closeEditor(){$('leadershipEditor').close();}
  $('newMeeting').addEventListener('click',()=>openEditor('meeting'));
  $('viewGoogleCalendar')?.addEventListener('click',()=>{window.location.href='national-calendar.html';});
  fetch('/.netlify/functions/national-calendar').then(r=>r.json()).then(c=>{
    if(c.ok && c.calendar?.calendar_id)$('nationalCalendarActions').classList.remove('hidden');
  }).catch(()=>{});
  $('newReminder').addEventListener('click',()=>openEditor('task'));
  $('viewAllMeetings').addEventListener('click',()=>{meetingExpanded=!meetingExpanded;renderMeetings();});
  $('meetingSearch').addEventListener('input',()=>{meetingExpanded=false;renderMeetings();});
  document.querySelectorAll('[data-task-filter]').forEach(button=>{
    button.addEventListener('click',()=>{taskFilter=button.dataset.taskFilter;allTasksExpanded=false;renderTasks();});
  });
  $('closeEditor').addEventListener('click',closeEditor);
  $('closeEventDetails').addEventListener('click',()=>$('eventDetailsDialog').close());
  $('cancelEditor').addEventListener('click',closeEditor);
  $('itemRegion').addEventListener('change',()=>{assigneeOptions();meetingOptions();});
  $('itemVisibility').addEventListener('change',adjustTaskScope);
  $('addMeetingFollowup').addEventListener('click',()=>{
    const id=$('itemId').value;if(!id)return;
    const saved=state.items.find(x=>x.id===id);
    if(saved && (
      $('itemTitle').value!==saved.title ||
      $('itemBody').value!==(saved.body||'') ||
      $('itemNotes').value!==(saved.notes||'') ||
      $('itemDecisions').value!==(saved.decisions||'') ||
      $('itemStart').value!==localInput(saved.starts_at)
    )){
      $('editorMessage').textContent='Save changes to this meeting before adding a follow-up.';
      return;
    }
    closeEditor();openEditor('task',null,id);
  });
  document.addEventListener('click',async event=>{
    const moreTasks=event.target.closest('[data-more-tasks]');if(moreTasks){allTasksExpanded=!allTasksExpanded;renderTasks();return;}
    const eventButton=event.target.closest('[data-event-details]');if(eventButton){openEventDetails(eventButton.dataset.eventDetails);return;}
    const quick=event.target.closest('[data-quick]');if(quick){openEditor(quick.dataset.quick);return;}
    const open=event.target.closest('[data-open]');if(open){
      const item=state.items.find(x=>x.id===open.dataset.open);
      if(item)openEditor(item.kind,item.id);return;
    }
    const related=event.target.closest('[data-related-task]');if(related){
      const item=state.items.find(x=>x.id===related.dataset.relatedTask);
      if(item){closeEditor();openEditor('task',item.id);}return;
    }
    const toggle=event.target.closest('[data-toggle]');if(toggle){
      if(toggle.disabled)return;
      toggle.disabled=true;
      try{
        const payload=await api('PATCH',{id:toggle.dataset.toggle,completed:toggle.dataset.value==='true'});
        state.items=state.items.map(x=>x.id===payload.item.id?payload.item:x);
        renderAll();toast(payload.item.completed_at?'Action completed.':'Action reopened.');
      }catch(e){notice(e.message,true);toggle.disabled=false;}
      return;
    }
    const retry=event.target.closest('[data-retry-people]');if(retry){peopleLoaded=false;loadPeople();}
  });
  $('leadershipForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(readonly())return;
    const kind=$('itemKind').value,isMeeting=kind==='meeting',id=$('itemId').value||undefined;
    if(!String($('itemTitle').value).trim()){$('editorMessage').textContent='Enter a title.';return;}
    if(isMeeting&&!$('itemStart').value){$('editorMessage').textContent='Select a date and time for the meeting.';return;}
    const parent=currentRelatedMeeting;
    const payload={id,kind,title:$('itemTitle').value,
      region:role()==='regional_leader'?state.viewer.region:$('itemRegion').value||null,
      visibility:isMeeting?'team':$('itemVisibility').value,
      body:$('itemBody').value,notes:isMeeting?$('itemNotes').value:'',decisions:isMeeting?$('itemDecisions').value:'',
      starts_at:isMeeting?new Date($('itemStart').value).toISOString():null,
      due_date:isMeeting?null:$('itemDue').value||null,
      assigned_to:!isMeeting&&$('itemVisibility').value==='team'?$('itemAssignee').value||null:null,
      meeting_id:!isMeeting&&$('itemVisibility').value==='team'?$('itemMeeting').value||null:null};
    const save=$('saveItem');save.disabled=true;$('leadershipForm').setAttribute('aria-busy','true');save.textContent='Saving…';
    $('editorMessage').textContent='';
    try{
      const result=await api(id?'PATCH':'POST',payload);
      state.items=id?state.items.map(x=>x.id===result.item.id?result.item:x):[result.item,...state.items];
      closeEditor();renderAll();toast(isMeeting?'Meeting saved.':'Action item saved.');
      if(parent&&state.items.some(x=>x.id===parent))openEditor('meeting',parent);
    }catch(e){$('editorMessage').textContent=e.message||'Could not save this record.';}
    finally{save.disabled=false;save.textContent='Save record';$('leadershipForm').removeAttribute('aria-busy');}
  });
  $('deleteItem').addEventListener('click',async()=>{
    if(readonly())return;
    const id=$('itemId').value,item=state.items.find(x=>x.id===id);
    if(!item||!canEdit(item))return;
    const message=item.kind==='meeting'?'Delete this meeting? Linked follow-up tasks will remain, but lose their meeting connection.':'Delete this action item?';
    if(!window.confirm(message))return;
    const button=$('deleteItem');button.disabled=true;
    try{
      await api('DELETE',{id});
      state.items=state.items.filter(x=>x.id!==id).map(x=>x.meeting_id===id?{...x,meeting_id:null}:x);
      closeEditor();renderAll();toast(item.kind==='meeting'?'Meeting deleted.':'Action item deleted.');
    }catch(e){$('editorMessage').textContent=e.message;button.disabled=false;}
  });
  await load();
})();