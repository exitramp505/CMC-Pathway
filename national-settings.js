(async function(){
  const $=id=>document.getElementById(id);
  const session=await dcAuth.getCurrentSession().catch(()=>null);
  if(!session?.user){location.replace('login.html');return;}
  const profile=await dcAuth.getProfile(session.user.id).catch(()=>null);
  if(profile?.account_role!=='cmc_admin'){location.replace('leadership-home.html');return;}
  dcAuth.renderRoleNavigation(profile,'settings');
  const token=session.access_token;
  const status=(message,error=false)=>{
    $('calendarSettingsStatus').textContent=message||'';
    $('calendarSettingsStatus').classList.toggle('error',error);
  };
  const syncStatus=calendar=>{
    const enabled=Boolean(calendar?.feed_enabled);
    const latest=calendar?.synced_at?new Intl.DateTimeFormat(undefined,{
      dateStyle:'medium',timeStyle:'short'
    }).format(new Date(calendar.synced_at)):'not yet';
    $('calendarSyncStatus').textContent=!calendar?.calendar_id
      ? 'No official calendar configured yet.'
      : enabled?'Automatic calendar refresh enabled · Last checked '+latest
        :'Calendar meetings imported · Last checked '+latest+'. Automatic updates are not enabled.';
  };
  async function api(method='GET',payload=null){
    const response=await fetch('/.netlify/functions/national-calendar',{
      method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw Error(data.error||'Unable to save calendar connection.');
    return data;
  }
  try{
    const data=await api();
    $('calendarLabel').value=data.calendar?.label||'Open Bible CMC Leadership';
    $('calendarId').value=data.calendar?.calendar_id||'';
    $('previewCalendar').classList.toggle('hidden',!data.calendar?.calendar_id);
    syncStatus(data.calendar);
    status(data.warning||'',Boolean(data.warning));
  }catch(error){status(error.message,true);}
  $('removeCalendarFeed').addEventListener('change',()=>{
    $('privateIcalUrl').disabled=$('removeCalendarFeed').checked;
    if($('removeCalendarFeed').checked)$('privateIcalUrl').value='';
  });
  $('calendarSettingsForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('saveCalendarSettings');
    button.disabled=true;
    status('Saving official Google Calendar…');
    try{
      const data=await api('POST',{
        label:$('calendarLabel').value,
        calendar_id:$('calendarId').value,
        private_ical_url:$('privateIcalUrl').value,
        remove_feed:$('removeCalendarFeed').checked
      });
      $('privateIcalUrl').value='';
      $('removeCalendarFeed').checked=false;
      $('privateIcalUrl').disabled=false;
      $('previewCalendar').classList.toggle('hidden',!data.calendar?.calendar_id);
      syncStatus(data.calendar);
      status(data.warning||'Official Google Calendar settings saved.',Boolean(data.warning));
    }catch(error){status(error.message,true);}
    finally{button.disabled=false;}
  });
})();