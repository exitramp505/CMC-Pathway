(function () {
  'use strict';

  const form = document.getElementById('forgotPasswordForm');
  const message = document.getElementById('forgotPasswordMessage');
  const submitButton = document.getElementById('sendResetLinkBtn');
  if (!form || !message || !submitButton) return;

  let sending = false;

  function setMessage(value, type) {
    message.textContent = value || '';
    message.classList.remove('success', 'error');
    if (type) message.classList.add(type);
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;

    const email = String(new FormData(form).get('email') || '').trim();
    if (!email) return;

    sending = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending reset link…';
    setMessage('Requesting your secure reset link…');

    try {
      const sb = await dcAuth.getSupabaseClient();
      const redirectTo = new URL('reset-password.html', window.location.href).href;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      // Always use a generic confirmation to avoid disclosing account existence.
      setMessage(
        'If an account uses that email address, you’ll receive a password reset link. Check your inbox and spam folder.',
        'success'
      );
    } catch (error) {
      const rateLimited = /rate limit|too many|wait .*seconds|security purposes/i.test(error?.message || '');
      setMessage(
        rateLimited
          ? 'Please wait a little while before requesting another link.'
          : 'We couldn’t request a reset link right now. Please try again in a few minutes.',
        'error'
      );
    } finally {
      sending = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Send reset link';
    }
  });
})();
