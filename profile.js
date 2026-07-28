(async function(){
  dcAuth.setupLogout();
  dcAuth.fillStateSelect(document.getElementById('state'));

  const user = await dcAuth.requireUser();
  if(!user) return;

  const form = document.getElementById('profileForm');
  const msg = document.getElementById('profileMessage');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || 'dashboard';
  async function ensureDefaultAssignments(){
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    const accessToken = session.data?.session?.access_token || '';
    if(!accessToken) return;

    const res = await fetch('/.netlify/functions/candidate-default-assignments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await res.json().catch(() => ({}));
    if(!res.ok || data.ok === false){
      throw new Error(data.error || 'Could not assign default candidate items.');
    }
  }


  function setMessage(text, type){
    if(!msg) return;
    msg.textContent = text || '';
    msg.classList.remove('success','error');
    if(type) msg.classList.add(type);
  }

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  dcAuth.renderRoleNavigation(profile, 'profile');

  form.email.value = user.email || '';

  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  form.name.value = profile?.full_name || metadataName || '';
  form.phone.value = profile?.phone || '';
  form.state.value = profile?.state || '';
  form.married.value = profile?.married || '';
  form.churchName.value = profile?.church_name || '';
  form.ministryRole.value = profile?.ministry_role || '';
  form.pathwayInterest.value = profile?.pathway_interest || '';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    setMessage('Saving...');
    const fd = new FormData(form);

    try{
      await dcAuth.upsertProfile({
        id: user.id,
        full_name: String(fd.get('name') || '').trim(),
        email: user.email || '',
        phone: String(fd.get('phone') || '').trim(),
        state: fd.get('state'),
        region: dcAuth.regionForState(fd.get('state')),
        married: fd.get('married'),
        church_name: String(fd.get('churchName') || '').trim(),
        ministry_role: String(fd.get('ministryRole') || '').trim(),
        pathway_interest: String(fd.get('pathwayInterest') || '').trim()
      });

      await ensureDefaultAssignments();
      await requestDiscoverEnrollment().catch(() => null);

      setMessage('Profile saved.', 'success');

      setTimeout(() => {
        window.location.href = next === 'dashboard' ? 'dashboard.html' : next;
      }, 400);
    }catch(err){
      setMessage(err.message || 'Could not save profile.', 'error');
    }
  });

  async function requestDiscoverEnrollment(){
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    const accessToken = session.data?.session?.access_token || '';
    if(!accessToken) return;
    await fetch('/.netlify/functions/pathwright-enroll', {
      method:'POST',
      headers:{ Authorization:`Bearer ${accessToken}` }
    });
  }
})();
