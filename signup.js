(async function(){
  const form = document.getElementById('signupForm');
  const msg = document.getElementById('authMessage');
  const googleBtn = document.getElementById('googleSignupBtn');
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
    return `${window.location.origin}/profile.html?next=dashboard`;
  }

  async function signUpWithGoogle(){
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
    }
  }

  if(googleBtn) googleBtn.addEventListener('click', signUpWithGoogle);

  if(form){
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setMessage('Creating account...');
      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim();

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
          window.location.href = 'profile.html?next=dashboard';
          return;
        }

        setMessage('Account created. Check your email to confirm your account, then complete your candidate profile.', 'success');
      }catch(err){
        setMessage(err.message || 'Could not create account.', 'error');
      }
    });
  }
})();
