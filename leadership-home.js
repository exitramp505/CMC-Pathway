(async function(){
  const session=await dcAuth.getCurrentSession().catch(()=>null);
  if(!session?.user){location.replace('login.html');return;}
  const token=session.access_token;
  const $=id=>document.getElementById(id);
  let state={viewer:null,items:[],events:[],leaders:[]},allMeetings=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[ch]));
  const date=s=>s?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(s)):'No date';
  const dateTime=s=>s?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(s)):'';
  const leadershipRole=role=>['regional_leader','cmc_admin','cmc_viewer'].includes(role);
  const fmtLocal=s=>{if(!s)return '';const d=new Date(s);const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
  function showMessage(text,error=false){$('homeMessage').textContent=text;$('homeMessage').classList.toggle('error',error);}
  async function api(method='GET',body){
    const response=await fetch('/.netlify/functions/leadership-home',{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||'Could not complete that request.');
    return data;
  }
  async function reload(){
    try{
      const data=await api();state=data;
      if(!leadershipRole(data.viewer?.account_role)){location.replace('dashboard.html');return;}
      dcAuth.renderRoleNavigation(data.viewer,'home');
      const role=data.viewer.account_role;
      $('leadershipRegion').textContent=role==='regional_leader'?'OPEN BIBLE '+(data.viewer.region||'') .toUpperCase()+' REGION':'NATIONAL LEADERSHIP';
      $('leadershipGreeting').textContent='Welcome'+(data.viewer.full_name?', '+data.viewer.full_name.trim().split(/\s+/)[0]:'')+'.';
      const readOnly=role==='cmc_viewer';
      $('newMeeting').classList.toggle('hidden',readOnly);
      $('newReminder').classList.toggle('hidden',readOnly);
      document.querySelector('.cmcHomePanel a[href="events.html"]')?.classList.toggle('hidden',readOnly);
      document.querySelector('#peopleHeading')?.closest('section')?.classList.toggle('hidden',readOnly);
      $('itemRegion').disabled=role==='regional_leader';
      render();
      showMessage('');
    }catch(e){showMessage(e.message,true);$('reminderList').innerHTML='<p class="cmcHomeEmpty">Unable to load reminders.</p>';$('upcomingList').innerHTML='<p class="cmcHomeEmpty">Unable to load upcoming events.</p>';$('meetingList').innerHTML='<p class="cmcHomeEmpty">Unable to load meeting records.</p>';}
  }
  function visibleName(id){return state.leaders.find(p=>p.id===id)?.full_name||state.leaders.find(p=>p.id===id)?.email||'Unassigned';}
  function sortTasks(a,b){return (a.due_date||'9999').localeCompare(b.due_date||'9999')||a.created_at.localeCompare(b.created_at);}
  function render(){
    const viewer=state.viewer, readOnly=viewer.account_role==='cmc_viewer';
    const reminders=state.items.filter(x=>x.kind==='task'&&!x.completed_at && (viewer.account_role==='cmc_admin'||viewer.account_role==='cmc_viewer'||x.visibility==='personal'||!x.assigned_to||x.assigned_to===viewer.id)).sort(sortTasks).slice(0,7);
    $('reminderList').innerHTML=reminders.length?reminders.map(x=>{
      const overdue=x.due_date&&x.due_date<new Date().toISOString().slice(0,10);
      return '<article class="cmcHomeItem"><div class="cmcHomeItemCopy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.due_date?(overdue?'Overdue · ':'Due ')+date(x.due_date+'T12:00:00'):'No due date')+' · '+esc(x.visibility==='personal'?'Private':x.region||'National')+(x.assigned_to?' · '+esc(visibleName(x.assigned_to)):'')+'</small></div><div class="cmcHomeItemActions">'+(readOnly?'': '<button type="button" data-complete="'+esc(x.id)+'" aria-label="Mark reminder complete">✓</button>')+'<button type="button" data-open="'+esc(x.id)+'">View</button></div></article>';
    }).join(''):'<p class="cmcHomeEmpty">No outstanding reminders. You are up to date.</p>';
    const meetings=state.items.filter(x=>x.kind==='meeting').sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||'')).slice(0,allMeetings?100:4);
    $('meetingList').innerHTML=meetings.length?meetings.map(x=>'<article class="cmcHomeItem"><div class="cmcHomeItemCopy"><strong>'+esc(x.title)+'</strong><small>'+esc(dateTime(x.starts_at))+' · '+esc(x.region||'National')+'</small><p>'+esc((x.decisions||x.body||x.notes||'Agenda and meeting record').slice(0,130))+'</p></div><button type="button" data-open="'+esc(x.id)+'">'+(readOnly?'View':'Open')+'</button></article>').join(''):'<p class="cmcHomeEmpty">No meeting records yet. Create a meeting to begin a shared history.</p>';
    $('viewAllMeetings').textContent=allMeetings?'Show fewer':'Meeting history';
    const now=Date.now();
    const upcoming=[...state.events.map(x=>({...x,_type:'event',when:x.starts_at})),...state.items.filter(x=>x.kind==='meeting'&&new Date(x.starts_at).getTime()>=now).map(x=>({...x,_type:'meeting',when:x.starts_at}))].sort((a,b)=>a.when.localeCompare(b.when)).slice(0,5);
    $('upcomingList').innerHTML=upcoming.length?upcoming.map(x=>'<article class="cmcHomeItem"><div class="cmcHomeItemCopy"><strong>'+esc(x.title)+'</strong><small>'+esc(dateTime(x.when))+' · '+esc(x.region||'All regions')+'</small></div><a class="cmcHomeTextButton" href="'+(x._type==='meeting'?'#meeting-'+encodeURIComponent(x.id):'events.html')+'" '+(x._type==='meeting'?'data-upcoming-meeting="'+esc(x.id)+'"':'')+'>Details</a></article>').join(''):'<p class="cmcHomeEmpty">Nothing scheduled yet. Published CMC events and meetings will appear here.</p>';
    const itemCount=state.items.filter(x=>x.kind==='task'&&!x.completed_at).length;
    $('peopleSummary').textContent=readOnly?'National view of CMC leadership and regional activity.':'Your team has '+itemCount+' open leadership reminders. Go to People for individual pathway progress and follow-ups.';
    if(readOnly) document.querySelectorAll('[data-complete]').forEach(b=>b.remove());
  }
  function openEditor(kind,id=null,related=null){
    const item=id?state.items.find(x=>x.id===id):null;
    if(id&&!item)return;
    const readOnly=state.viewer.account_role==='cmc_viewer';
    $('leadershipForm').reset();
    $('editorMessage').textContent='';
    $('itemKind').value=kind;
    $('itemId').value=item?.id||'';
    $('editorTitle').textContent=(item?'':'New ')+(kind==='meeting'?'meeting':'reminder');
    $('itemTitle').value=item?.title||'';
    $('itemRegion').value=item?.region||'';
    $('itemRegion').disabled=state.viewer.account_role==='regional_leader';
    $('itemStart').value=fmtLocal(item?.starts_at);
    $('itemDue').value=item?.due_date||'';
    $('itemBody').value=item?.body||'';
    $('itemNotes').value=item?.notes||'';
    $('itemDecisions').value=item?.decisions||'';
    $('itemVisibility').value=item?.visibility||'team';
    const isMeeting=kind==='meeting';
    ['meetingDateRow','agendaRow','notesRow','decisionsRow'].forEach(x=>$(x).classList.toggle('hidden',!isMeeting));
    ['dueDateRow','visibilityRow','assigneeRow','parentMeetingRow'].forEach(x=>$(x).classList.toggle('hidden',isMeeting));
    $('regionRow').classList.toggle('hidden',state.viewer.account_role==='regional_leader');
    const leaders=state.leaders.filter(p=>!state.viewer.region || state.viewer.account_role!=='regional_leader'||p.region===state.viewer.region);
    $('itemAssignee').innerHTML='<option value="">Unassigned</option>'+leaders.filter(p=>p.account_role!=='cmc_viewer').map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.email)+'</option>').join('');
    $('itemAssignee').value=item?.assigned_to||'';
    $('itemMeeting').innerHTML='<option value="">None</option>'+state.items.filter(x=>x.kind==='meeting'&&(x.region===(item?.region??(state.viewer.account_role==='regional_leader'?state.viewer.region:null)))).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('');
    $('itemMeeting').value=item?.meeting_id||related||'';
    $('deleteItem').classList.toggle('hidden',!item||readOnly);
    $('saveItem').classList.toggle('hidden',readOnly);
    $('leadershipForm').querySelectorAll('input,select,textarea').forEach(el=>{if(el.id!=='itemId'&&el.id!=='itemKind')el.disabled=readOnly || (el.id==='itemRegion'&&state.viewer.account_role==='regional_leader');});
    $('leadershipEditor').showModal();
  }
  $('newMeeting').addEventListener('click',()=>openEditor('meeting'));
  $('newReminder').addEventListener('click',()=>openEditor('task'));
  $('viewAllMeetings').addEventListener('click',()=>{allMeetings=!allMeetings;render();});
  $('closeEditor').addEventListener('click',()=>$('leadershipEditor').close());
  $('cancelEditor').addEventListener('click',()=>$('leadershipEditor').close());
  $('leadershipEditor').addEventListener('click',e=>{if(e.target===$('leadershipEditor'))$('leadershipEditor').close();});
  $('itemVisibility').addEventListener('change',()=>{if($('itemVisibility').value==='personal'){$('itemAssignee').value='';$('itemMeeting').value='';}});
  document.addEventListener('click',async e=>{
    const open=e.target.closest('[data-open],[data-upcoming-meeting]');if(open){e.preventDefault();const id=open.dataset.open||open.dataset.upcomingMeeting;const item=state.items.find(x=>x.id===id);if(item)openEditor(item.kind,id);return;}
    const done=e.target.closest('[data-complete]');if(done){try{done.disabled=true;await api('PATCH',{id:done.dataset.complete,completed:true});await reload();}catch(error){showMessage(error.message,true);done.disabled=false;}}
  });
  $('leadershipForm').addEventListener('submit',async e=>{
    e.preventDefault();if(state.viewer.account_role==='cmc_viewer')return;
    const kind=$('itemKind').value;
    const body={id:$('itemId').value||undefined,kind,title:$('itemTitle').value,region:state.viewer.account_role==='regional_leader'?state.viewer.region:$('itemRegion').value,visibility:kind==='meeting'?'team':$('itemVisibility').value,body:$('itemBody').value,notes:$('itemNotes').value,decisions:$('itemDecisions').value,starts_at:kind==='meeting'&&$('itemStart').value?new Date($('itemStart').value).toISOString():null,due_date:$('itemDue').value,assigned_to:kind==='task'&&$('itemVisibility').value==='team'?$('itemAssignee').value:null,meeting_id:kind==='task'&&$('itemVisibility').value==='team'?$('itemMeeting').value:null};
    const btn=$('saveItem');btn.disabled=true;
    try{await api(body.id?'PATCH':'POST',body);$('leadershipEditor').close();await reload();}
    catch(error){$('editorMessage').textContent=error.message;}
    finally{btn.disabled=false;}
  });
  $('deleteItem').addEventListener('click',async()=>{const id=$('itemId').value;if(!id||!confirm('Delete this leadership record?'))return;try{await api('DELETE',{id});$('leadershipEditor').close();await reload();}catch(e){$('editorMessage').textContent=e.message;}});
  await reload();
})();