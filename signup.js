(async function(){
  const form = document.getElementById('signupForm');
  const msg = document.getElementById('authMessage');
  const googleBtn = document.getElementById('googleSignupBtn');
  const submitBtn = form?.querySelector('button[type="submit"]');
  let pending = false;
  let accountCreated = false;
  const initialGoogleText = googleBtn?.innerHTML || '';
  const inviteEmail = new URLSearchParams(window.location.search).get('email');

  if(form && inviteEmail){
    form.elements.email.value = inviteEmail;
  }

  function setMessage(text, type){
    if(!msg) return;
    msg.textContent = text || '';
    msg.classList.remove('success','error');
    if(type) msg.classList.add(type);
  }

  function redirectTo(){
    return `${window.location.origin}/dashboard.html`;
  }

  async function routeSignedInUser(user){
    const profile = await dcAuth.getProfile(user.id).catch(() => null);
    if(['regional_leader','cmc_admin'].includes(profile?.account_role)){
      window.location.href = 'leader.html';
      return;
    }

    const profileComplete = Boolean(profile?.full_name && profile?.phone && profile?.state);
    window.location.href = profileComplete
      ? 'dashboard.html'
      : 'profile.html?next=dashboard';
  }

  function setPending(value) {
    pending = value;
    if (submitBtn) {
      submitBtn.disabled = value || accountCreated;
      submitBtn.textContent = accountCreated ? 'Check your email' : value ? 'Creating account…' : 'Create Account';
    }
    if (googleBtn) {
      googleBtn.disabled = value || accountCreated;
      googleBtn.setAttribute('aria-busy', String(value));
    }
    if (form) form.setAttribute('aria-busy', String(value));
  }

  async function signUpWithGoogle(){
    if (pending || accountCreated) return;
    setPending(true);
    setMessage('Redirecting to Google...');
    try{
      const sb = await dcAuth.getSupabaseClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() }
      });
      if(error) throw error;
    }catch(err){
      setMessage(err.message || 'Could not continue with Google.', 'error');
    }finally{
      setPending(false);
    }
  }

  if(googleBtn) googleBtn.addEventListener('click', signUpWithGoogle);

  try{
    const session = await dcAuth.getCurrentSession();
    if(session?.user){
      await routeSignedInUser(session.user);
      return;
    }
  }catch(err){
    // Keep signup available when session lookup is temporarily unavailable.
  }

  if(form){
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (pending || accountCreated || !form.reportValidity()) return;
      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim();
      setPending(true);
      setMessage('Creating account...');

      try{
        const sb = await dcAuth.getSupabaseClient();
        const { data, error } = await sb.auth.signUp({
          email,
          password: fd.get('password'),
          options: {
            data: {},
            emailRedirectTo: redirectTo()
          }
        });
        if(error) throw error;

        if(data.session){
          await routeSignedInUser(data.user);
          return;
        }

        accountCreated = true;
        setMessage('Account created. Check your email to confirm your account, then complete your CMC profile.', 'success');
      }catch(err){
        setMessage(err.message || 'Could not create account.', 'error');
      }finally{
        setPending(false);
      }
    });
  }
})();
