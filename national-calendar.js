(async function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateTime=iso=>new Intl.DateTimeFormat(undefined,{
    weekday:'short',month:'short',day:'numeric',year:'numeric',
    hour:'numeric',minute:'2-digit',timeZoneName:'short'
  }).format(new Date(iso));
  const safeUrl=value=>{
    try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch(_){return null;}
  };
  const showStatus=(message,error=false)=>{
    $('calendarStatus').textContent=message||'';
    $('calendarStatus').classList.toggle('error',error);
    $('calendarStatus').classList.toggle('hidden',!message);
  };
  try{
    const session=await dcAuth.getCurrentSession();
    if(!session?.user){window.location.replace('login.html');return;}
    const [profile,response]=await Promise.all([
      dcAuth.getProfile(session.user.id),
      fetch('/.netlify/functions/national-calendar',{
        headers:{Authorization:'Bearer '+session.access_token}
      })
    ]);
    dcAuth.renderRoleNavigation(profile,'calendar');
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw Error(data.error||'Could not load the official calendar.');
    if(!data.calendar?.calendar_id){
      showStatus('No Google Calendar is configured yet. A national administrator can connect one in National Settings.');
      return;
    }
    const calendar=data.calendar;
    $('calendarHeading').textContent=calendar.label||'Open Bible CMC Leadership';
    $('openInGoogle').href=calendar.google_url;
    const last=calendar.synced_at?dateTime(calendar.synced_at):'Not yet imported';
    $('calendarFreshness').textContent=calendar.feed_enabled
      ? 'Automatic Google Calendar updates · Last checked '+last
      : 'Imported Google Calendar schedule · Last checked '+last+' · Automatic refresh is not yet configured';
    const events=(data.events||[]).filter(x=>new Date(x.ends_at||x.starts_at).getTime()>=Date.now()).slice(0,24);
    if(events.length){
      $('googleUpcomingList').innerHTML=events.map(event=>{
        const google=safeUrl(event.public_url);
        const zoom=safeUrl(event.join_url);
        const notes='leadership-home.html#meetings';
        return '<article class="cmcCalendarEventRow"><div class="cmcCalendarEventInfo"><strong>'+esc(event.title)+'</strong>'+
          '<p>'+esc(dateTime(event.starts_at))+'</p>'+
          '<p class="cmcCalendarEventLocation">'+(event.location_name?esc(event.location_name):'CMC leadership meeting')+'</p></div>'+
          '<div class="cmcCalendarEventActions">'+
          (zoom?'<a href="'+esc(zoom)+'" target="_blank" rel="noopener noreferrer">Join Zoom ↗</a>':'')+
          '<a href="'+notes+'">Meeting notes</a>'+
          (google?'<a href="'+esc(google)+'" target="_blank" rel="noopener noreferrer">Google event ↗</a>':'')+
          '</div></article>';
      }).join('');
    }else{
      $('googleUpcomingList').innerHTML='<p class="cmcHealthEmpty">No upcoming meetings are currently listed on this calendar.</p>';
    }
    $('calendarViewer').classList.remove('hidden');
    showStatus(data.warning||'',Boolean(data.warning));
  }catch(error){showStatus(error.message||'Unable to load the official calendar.',true);}
})();