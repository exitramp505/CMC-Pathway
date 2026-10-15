/* Accessible show/hide buttons for CMC Pathway password inputs. */
(function () {
  'use strict';
  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    const target = document.getElementById(button.getAttribute('aria-controls'));
    if (!target || target.type !== 'password') return;

    button.addEventListener('click', function () {
      const showing = target.type === 'password';
      target.type = showing ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(showing));
      button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
      button.setAttribute('title', showing ? 'Hide password' : 'Show password');
      const text = button.querySelector('[data-password-toggle-text]');
      if (text) text.textContent = showing ? 'Hide' : 'Show';
      target.focus({ preventScroll:true });
    });
  });
})();
