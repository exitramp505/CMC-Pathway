(async function(){
 const $=id=>document.getElementById(id);
 const session=await dcAuth.getCurrentSession().catch(()=>null);
 if(!session?.user){location.replace('login.html');return;}
 const token=session.access_token;
 const result=await dcAuth.getProfile(session.user.id).catch(()=>null);
 if(result?.account_role!=='cmc_admin'){location.replace('leadership-home.html');return;}
 dcAuth.renderRoleNavigation(result,'settings');
 const status=(s,error=false)=>{$('calendarSettingsStatus').textContent=s||'';$('calendarSettingsStatus').classList.toggle('error',error);};
 async function api(method,payload){
   const response=await fetch('/.netlify/functions/national-calendar',{method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw Error(data.error||'Unable to save calendar.');
   return data;
 }
 try{
  const data=await api('GET');
  $('calendarLabel').value=data.calendar?.label||'Open Bible CMC Leadership';
  $('calendarId').value=data.calendar?.calendar_id||'';
  $('previewCalendar').classList.toggle('hidden',!data.calendar?.calendar_id);
 }catch(e){status(e.message,true);}
 $('calendarSettingsForm').addEventListener('submit',async event=>{
   event.preventDefault();
   const button=$('saveCalendarSettings');button.disabled=true;status('Saving…');
   try{
    const data=await api('POST',{label:$('calendarLabel').value,calendar_id:$('calendarId').value});
    $('previewCalendar').classList.toggle('hidden',!data.calendar?.calendar_id);
    status('Calendar reference saved.');
   }catch(e){status(e.message,true);}
   finally{button.disabled=false;}
 });
})();