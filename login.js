(async function(){
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('authMessage');
  const googleBtn = document.getElementById('googleLoginBtn');
  const submitBtn = form?.querySelector('button[type="submit"]');
  let pending = false;

  function setPending(value) {
    pending = value;
    if (submitBtn) {
      submitBtn.disabled = value;
      submitBtn.textContent = value ? 'Signing in…' : 'Login';
    }
    if (googleBtn) googleBtn.disabled = value;
    if (form) form.setAttribute('aria-busy', String(value));
  }

  function setMessage(text, type){
    if(!msg) return;
    msg.textContent = text || '';
    msg.classList.remove('success','error');
    if(type) msg.classList.add(type);
  }

  function loginRedirectTo(){
    return `${window.location.origin}/dashboard.html`;
  }

  async function routeSignedInUser(user){
    const profile = await dcAuth.getProfile(user.id).catch(() => null);
    window.location.href = ['regional_leader','cmc_admin'].includes(profile?.account_role)
      ? 'leader.html'
      : 'dashboard.html';
  }

  async function signInWithGoogle(){
    if (pending) return;
    setPending(true);
    setMessage('Redirecting to Google...');
    let redirectStarted = false;
    try{
      const sb = await dcAuth.getSupabaseClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: loginRedirectTo() }
      });
      if(error) throw error;
      redirectStarted = true;
    }catch(err){
      setMessage(err.message || 'Could not continue with Google.', 'error');
    }finally{
      if (!redirectStarted) setPending(false);
    }
  }

  try{
    const session = await dcAuth.getCurrentSession();
    if(session?.user){
      await routeSignedInUser(session.user);
      return;
    }
  }catch(err){
    // Keep the login form available if session lookup is temporarily unavailable.
  }

  if(googleBtn) googleBtn.addEventListener('click', signInWithGoogle);

  if(form){
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (pending || !form.reportValidity()) return;
      const fd = new FormData(form);
      setPending(true);
      setMessage('Logging in...');
      let redirectStarted = false;

      try{
        const sb = await dcAuth.getSupabaseClient();
        const { data, error } = await sb.auth.signInWithPassword({
          email: fd.get('email'),
          password: fd.get('password')
        });
        if(error) throw error;
        await routeSignedInUser(data.user);
        redirectStarted = true;
      }catch(err){
        setMessage(err.message || 'Could not log in.', 'error');
      }finally{
        if (!redirectStarted) setPending(false);
      }
    });
  }
})();
