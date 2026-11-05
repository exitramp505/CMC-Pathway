(async function(){
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const session=await dcAuth.getCurrentSession().catch(()=>null);
 if(!session?.user){window.location.replace('login.html');return;}
 const token=session.access_token;
 const profile=await dcAuth.getProfile(session.user.id).catch(()=>null);
 if(profile?.account_role!=='cmc_admin'){window.location.replace('leadership-home.html');return;}
 dcAuth.renderRoleNavigation(profile,'settings');
 let year=new Date().getFullYear()<=2026?new Date().getFullYear():new Date().getFullYear()-1;
 let snapshot=null,pending=null;
 function status(message,error=false){
   const el=$('annualAdminMessage');el.textContent=message||'';
   el.classList.toggle('error',error);
   el.classList.toggle('hidden',!message);
 }
 function feedback(message,error=false){
   $('annualDirectorFeedback').textContent=message||'';
   $('annualDirectorFeedback').style.color=error?'#96443b':'#456e60';
 }
 async function api(method='GET',body=null,selectedYear=year){
   const response=await fetch('/.netlify/functions/annual-assessment-admin?year='+selectedYear,{
     method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
     ...(body?{body:JSON.stringify({...body,year:selectedYear})}:{})
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.ok)throw Error(payload.error||'Unable to update annual assessments.');
   return payload;
 }
 function initSelect(id,start,end){
   $(id).innerHTML=Array.from({length:end-start+1},(_,i)=>start+i)
     .map(v=>'<option value="'+v+'">'+v+'</option>').join('');
 }
 function initYear(){
   const now=new Date().getFullYear();
   $('annualReportingYear').innerHTML=Array.from({length:Math.min(6,now-2025)},(_,i)=>now-i)
     .map(v=>'<option value="'+v+'">'+v+'</option>').join('');
   $('annualReportingYear').value=String(year);
 }
 function populateSettings(settings){
   $('annualEnabled').checked=settings.enabled;
   $('annualInviteDay').value=String(settings.invitation_day);
   $('annualReminderDay').value=String(settings.reminder_day);
   $('annualDueDay').value=String(settings.due_day);
   $('annualFirstYear').value=String(settings.first_campaign_year);
   $('annualSubject').value=settings.subject_template;
   $('annualIntro').value=settings.email_intro;
   $('annualScheduleStatus').textContent=settings.enabled?'Automatic schedule enabled':'Schedule paused';
   $('annualScheduleStatus').classList.toggle('paused',!settings.enabled);
 }
 function collectSettings(){
   return {enabled:$('annualEnabled').checked,invitation_day:Number($('annualInviteDay').value),
     reminder_day:Number($('annualReminderDay').value),due_day:Number($('annualDueDay').value),
     first_campaign_year:Number($('annualFirstYear').value),
     subject_template:$('annualSubject').value,email_intro:$('annualIntro').value};
 }
 function emailLabel(note){
   if(note?.status==='sent')return 'Sent';
   if(note?.status==='failed')return 'Email failed';
   if(note?.status==='sending')return 'Sending';
   return 'Not sent';
 }
 function render(){
   if(!snapshot)return;
   const summary=snapshot.summary;
   $('annualDirectorCount').textContent=summary.directors;
   $('annualAssignedCount').textContent=summary.assigned;
   $('annualSubmittedCount').textContent=summary.submitted;
   $('annualOutstandingCount').textContent=summary.outstanding;
   $('annualReportingSummary').textContent='Reporting year '+year+' · Due February '+
     snapshot.settings.due_day+', '+snapshot.campaign_year;
   populateSettings(snapshot.settings);
   const roster=snapshot.roster||[];
   $('annualDirectorList').innerHTML=roster.length?roster.map(person=>{
     const code=person.status==='submitted'?'submitted':person.status==='draft'?'draft':'not_started';
     const label=code==='submitted'?'Submitted':code==='draft'?'Draft saved':'Not started';
     const sent=person.invitation?.status==='sent';
     const mail=person.email?emailLabel(person.invitation):'Email missing';
     const reminder=person.reminder?.status==='sent'?' · Reminder sent':'';
     const deliveryError=person.invitation?.error||person.reminder?.error;
     return '<article class="cmcAnnualDirectorRow"><div class="cmcAnnualDirectorIdentity">'+
       '<strong>'+esc(person.name)+'</strong><span>'+esc(person.region)+' Region</span></div>'+
       '<span class="cmcAnnualDirectorStatus '+code+'">'+esc(label)+'</span>'+
       '<div class="cmcAnnualDirectorMeta"><span>'+esc(person.assignment_id?'Task assigned':'Not assigned')+'</span>'+
       '<span>'+esc(mail+reminder)+'</span>'+
       (deliveryError?'<span class="cmcAnnualDeliveryError">'+esc(deliveryError)+'</span>':'')+'</div>'+
       (person.status==='submitted'?'<button type="button" data-reopen="'+esc(person.assessment_id)+'">Reopen</button>':'')+
       '</article>';
   }).join(''):'<p class="cmcHealthEmpty">There are no active CMC directors with assigned regions.</p>';
   $('annualSettingsApp').classList.remove('hidden');
   $('annualReportingYear').value=String(year);
 }
 async function load(){
   status('Loading '+year+' assignments and national settings…');
   try{
     snapshot=await api();
     render();
     status('');
   }catch(error){status(error.message,true);}
 }
 function showDialog(action,id=null){
   pending={action,id};
   $('annualReopenReasonRow').classList.toggle('hidden',action!=='reopen');
   $('annualReopenReason').value='';
   const targets=(snapshot.roster||[]).filter(x=>x.status!=='submitted');
   if(action==='send'){
     $('annualDialogTitle').textContent='Send annual invitations?';
     $('annualDialogMessage').textContent='This will assign the '+year+' assessment and email directors who have not already received an invitation. '+targets.length+' director(s) are outstanding. Existing emails will not be duplicated.';
     $('annualDialogConfirm').textContent='Send invitations';
   }else if(action==='assign'){
     $('annualDialogTitle').textContent='Assign annual assessments?';
     $('annualDialogMessage').textContent='Create the '+year+' assessment task for active directors. No emails will be sent. Directors can see the task on their dashboard.';
     $('annualDialogConfirm').textContent='Create tasks';
   }else{
     const director=(snapshot.roster||[]).find(x=>x.assessment_id===id);
     $('annualDialogTitle').textContent='Reopen submitted assessment?';
     $('annualDialogMessage').textContent='This will unlock '+(director?.name||'this director')+'’s '+year+' assessment for editing and record your reason in the audit log.';
     $('annualDialogConfirm').textContent='Reopen assessment';
   }
   $('annualConfirmDialog').showModal();
 }
 function closeDialog(){$('annualConfirmDialog').close();pending=null;}
 $('annualScheduleForm').addEventListener('submit',async event=>{
   event.preventDefault();const button=$('annualSaveSettings');
   button.disabled=true;$('annualSettingsSaveStatus').textContent='Saving…';
   try{
     snapshot=await api('POST',{action:'save_settings',settings:collectSettings()});
     render();$('annualSettingsSaveStatus').textContent='Schedule saved.';
   }catch(error){$('annualSettingsSaveStatus').textContent=error.message;}
   finally{button.disabled=false;}
 });
 $('annualReportingYear').addEventListener('change',async()=>{year=Number($('annualReportingYear').value);feedback('');await load();});
 $('annualCreateTasks').addEventListener('click',()=>showDialog('assign'));
 $('annualSendInvitations').addEventListener('click',()=>showDialog('send'));
 $('annualDirectorList').addEventListener('click',event=>{
   const el=event.target.closest('[data-reopen]');
   if(el)showDialog('reopen',el.dataset.reopen);
 });
 $('annualDialogCancel').addEventListener('click',closeDialog);
 $('annualConfirmDialog').addEventListener('close',()=>{pending=null;});
 $('annualDialogConfirm').addEventListener('click',async()=>{
   if(!pending)return;
   const {action,id}=pending;
   if(action==='reopen'&&$('annualReopenReason').value.trim().length<8){
     $('annualReopenReason').focus();return;
   }
   const button=$('annualDialogConfirm');button.disabled=true;button.textContent='Working…';
   try{
     const data=await api('POST',action==='reopen'?
       {action:'reopen',assessment_id:id,reason:$('annualReopenReason').value}:
       {action,confirmation:action==='send'?'SEND':undefined});
     snapshot=data;render();
     const result=data.result;
     const summary=action==='reopen'?'Assessment reopened. The director can now edit and resubmit.':
       action==='assign'?'Director assessment tasks created. No emails were sent.':
       'Invitations sent: '+(result?.initial_sent||0)+'. Skipped already-notified directors. '+
       (result?.failed?'Email failures: '+result.failed+'. ':'');
     closeDialog();feedback(summary,Boolean(result?.failed));
   }catch(error){feedback(error.message,true);}
   finally{button.disabled=false;button.textContent='Confirm';}
 });
 initSelect('annualInviteDay',1,14);
 initSelect('annualReminderDay',2,27);
 initSelect('annualDueDay',15,28);
 initYear();await load();
})();