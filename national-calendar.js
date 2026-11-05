(async()=>{
 const session=await dcAuth.getCurrentSession();
 if(!session?.user){location.href='login.html';return;}
 const profile=await dcAuth.getProfile(session.user.id);
 dcAuth.renderRoleNavigation(profile,'calendar');
 const response=await fetch('/.netlify/functions/national-calendar',{headers:{Authorization:'Bearer '+session.access_token}});
 const result=await response.json();
 const status=document.getElementById('calendarStatus');
 if(!response.ok||!result.ok){status.textContent=result.error||'Calendar unavailable.';return;}
 if(!result.calendar?.calendar_id){status.textContent='A national administrator must connect the calendar in National Settings.';return;}
 document.getElementById('calendarHeading').textContent=result.calendar.label;
 document.getElementById('googleCalendarFrame').hidden=true;
 document.getElementById('openInGoogle').href='https://calendar.google.com/';
 document.getElementById('calendarViewer').classList.remove('hidden');
 status.textContent='Open Google Calendar using the organizational account that has access to this calendar.';
})();