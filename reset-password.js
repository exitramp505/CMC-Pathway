(async function () {
  'use strict';

  const form = document.getElementById('resetPasswordForm');
  const status = document.getElementById('resetPasswordMessage');
  const complete = document.getElementById('resetPasswordComplete');
  const submitButton = document.getElementById('updatePasswordBtn');
  if (!form || !status || !complete || !submitButton) return;

  // Supabase's default email flow returns an implicit-flow recovery session
  // in the URL hash. Snapshot it before the auth client consumes the URL.
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hasRecoveryLink = search.get('type') === 'recovery' || hash.get('type') === 'recovery';
  const linkHasError = Boolean(search.get('error') || hash.get('error'));
  let recoveryReady = false;
  let saving = false;
  let sb;

  function setMessage(value, type) {
    status.textContent = value || '';
    status.classList.remove('success', 'error');
    if (type) status.classList.add(type);
  }

  function showRecoveryForm() {
    if (recoveryReady) return;
    recoveryReady = true;
    form.hidden = false;
    setMessage('Reset link verified. Choose your new password.', 'success');
    // Avoid leaving recovery tokens or errors in the address bar/history.
    window.history.replaceState(null, '', window.location.pathname);
  }

  function showInvalidLink() {
    if (recoveryReady) return;
    form.hidden = true;
    setMessage(
      'This reset link is invalid or has expired. Request a new password reset link below.',
      'error'
    );
  }

  try {
    if (linkHasError) {
      showInvalidLink();
      return;
    }

    sb = await dcAuth.getSupabaseClient();
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.access_token) showRecoveryForm();
    });

    // Catch recovery sessions processed before our subscription was attached.
    // A regular signed-in session alone must never unlock this form.
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!recoveryReady && hasRecoveryLink && data.session?.access_token) {
      const { data: verified, error: userError } = await sb.auth.getUser();
      if (!userError && verified?.user) showRecoveryForm();
    }
    if (!recoveryReady) showInvalidLink();
  } catch (_) {
    showInvalidLink();
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!recoveryReady || saving || !form.reportValidity()) return;

    const password = form.elements.password.value;
    const confirm = form.elements.confirmPassword.value;
    if (password.length < 8) {
      setMessage('Please choose a password with at least eight characters.', 'error');
      return;
    }
    if (password !== confirm) {
      setMessage('The passwords do not match. Please try again.', 'error');
      return;
    }

    saving = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Updating password…';
    setMessage('Saving your new password…');

    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;

      recoveryReady = false;
      form.hidden = true;
      form.reset();
      complete.hidden = false;
      setMessage('Your password was updated successfully.', 'success');

      // Finish the recovery session. The user will sign in with the new password.
      const { error: signOutError } = await sb.auth.signOut();
      if (signOutError) {
        setMessage(
          'Your password was updated, but we could not sign you out automatically. Please close this tab before signing in again.',
          'success'
        );
      }
    } catch (error) {
      setMessage(
        error?.message || 'We couldn’t update your password. Please try again or request a new link.',
        'error'
      );
    } finally {
      saving = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Update password';
    }
  });
})();
