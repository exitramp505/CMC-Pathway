(async function(){
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('authMessage');
  const googleBtn = document.getElementById('googleLoginBtn');

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
    setMessage('Redirecting to Google...');
    try{
      const sb = await dcAuth.getSupabaseClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: loginRedirectTo() }
      });
      if(error) throw error;
    }catch(err){
      setMessage(err.message || 'Could not continue with Google.', 'error');
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
      setMessage('Logging in...');
      const fd = new FormData(form);

      try{
        const sb = await dcAuth.getSupabaseClient();
        const { data, error } = await sb.auth.signInWithPassword({
          email: fd.get('email'),
          password: fd.get('password')
        });
        if(error) throw error;
        await routeSignedInUser(data.user);
      }catch(err){
        setMessage(err.message || 'Could not log in.', 'error');
      }
    });
  }
})();
