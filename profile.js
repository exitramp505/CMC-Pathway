(async function(){
  dcAuth.setupLogout();
  dcAuth.fillStateSelect(document.getElementById('state'));

  const user = await dcAuth.requireUser();
  if(!user) return;

  const form = document.getElementById('profileForm');
  const msg = document.getElementById('profileMessage');
  const params = new URLSearchParams(window.location.search);
  const requestedNext = params.get('next') || 'dashboard';
  // Permit only same-site HTML destinations. Never redirect to a supplied URL.
  const next = /^(?:[a-z0-9-]+\.html)(?:\?[a-z0-9_=&%.-]+)?$/i.test(requestedNext)
    ? requestedNext
    : 'dashboard.html';
  const submitButton = form.querySelector('button[type="submit"]');
  const retryButton = document.getElementById('retryCourseSetupBtn');
  const actions = document.getElementById('profileSetupActions');
  document.getElementById('continueToPathwayLink').href = next === 'dashboard' ? 'dashboard.html' : next;
  let saving = false;
  async function ensureDefaultAssignments(){
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    const accessToken = session.data?.session?.access_token || '';
    if(!accessToken) throw new Error('Your session has expired. Log in again to finish course setup.');

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
  const isReturning = Boolean(profile?.full_name && profile?.phone && profile?.state);
  if(isReturning){
    setText('profileEyebrow','YOUR CMC PROFILE');
    setText('profileIntroTitle','Keep your pathway details current.');
    setText('profileIntroCopy','Accurate information helps your CMC regional leader stay connected and support your next steps.');
    setText('profileCardTitle','Your pathway is already underway.');
    setText('profileCardCopy','Update anything that has changed, then return to your dashboard. Discover and your assigned work remain there.');
    setText('profileFormTitle','Update your profile');
    setText('profileFormCopy','Review your information and save any changes.');
  }

  form.email.value = user.email || '';

  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  form.name.value = profile?.full_name || metadataName || '';
  form.phone.value = profile?.phone || '';
  form.state.value = profile?.state || '';
  form.married.value = profile?.married || '';
  form.churchName.value = profile?.church_name || '';
  form.ministryRole.value = profile?.ministry_role || '';
  form.pathwayInterest.value = profile?.pathway_interest || '';

  async function finishCourseSetup(){
    try {
      await ensureDefaultAssignments();
      actions.hidden = true;
      setMessage('CMC profile saved. Your course assignments are ready.', 'success');
      setTimeout(() => {
        window.location.href = next === 'dashboard' ? 'dashboard.html' : next;
      }, 500);
    } catch (error) {
      // The profile upsert already succeeded. This is NOT a profile save error.
      actions.hidden = false;
      setMessage(
        'Your CMC profile was saved, but we could not finish setting up your starting courses. ' +
        'You can retry course setup or continue to your dashboard.',
        'error'
      );
    }
  }

  retryButton.addEventListener('click', async () => {
    if (saving) return;
    saving = true;
    retryButton.disabled = true;
    setMessage('Retrying course setup…');
    try {
      await finishCourseSetup();
    } finally {
      retryButton.disabled = false;
      saving = false;
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(saving || !form.reportValidity()) return;
    saving = true;
    submitButton.disabled = true;
    actions.hidden = true;
    setMessage('Saving your CMC profile…');
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
    }catch(err){
      setMessage(err.message || 'Could not save your CMC profile.', 'error');
      saving = false;
      submitButton.disabled = false;
      return;
    }

    try {
      await finishCourseSetup();
    } finally {
      saving = false;
      submitButton.disabled = false;
    }
  });

  function setText(id,text){
    const element = document.getElementById(id);
    if(element) element.textContent = text;
  }
})();
