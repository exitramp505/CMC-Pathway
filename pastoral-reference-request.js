(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;
  const shell = document.getElementById('referenceRequestShell');
  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  dcAuth.renderRoleNavigation(profile, 'pathway');

  async function load() {
    try {
      const response = await fetch('/.netlify/functions/pastoral-reference-request', { headers:{ Authorization:`Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load the pastoral reference.');
      render(data.reference || { status:'not_requested' });
    } catch (error) {
      shell.innerHTML = errorState(error.message);
    }
  }

  function render(reference) {
    if (reference.status === 'received') {
      shell.innerHTML = `<div class="cmcReferenceStatus complete"><span aria-hidden="true">✓</span><div><p class="cmcEyebrow">REFERENCE RECEIVED</p><h2>Pastoral reference complete.</h2><p>Your CMC leaders can review the confidential reference. You will not see the pastor’s answers.</p><a class="buttonLink" href="dashboard.html">Return to My Pathway →</a></div></div>`;
      return;
    }
    const waiting = reference.status === 'waiting';
    const failed = reference.status === 'send_failed';
    shell.innerHTML = `${waiting || failed ? `<div class="cmcReferenceStatus ${failed ? 'warning' : 'waiting'}"><span aria-hidden="true">${failed ? '!' : '→'}</span><div><p class="cmcEyebrow">${failed ? 'EMAIL NEEDS ATTENTION' : 'WAITING FOR A RESPONSE'}</p><h2>${failed ? 'The email was not delivered.' : `Request sent to ${escapeHtml(reference.pastor_name)}.`}</h2><p>${failed ? 'Check the address below and send a new secure link.' : `Sent to ${escapeHtml(reference.pastor_email)} on ${escapeHtml(formatDate(reference.email_sent_at || reference.requested_at))}.`}</p></div></div>` : ''}
      <div class="cmcReferenceIntro"><h2>${waiting || failed ? 'Send a new link' : 'Pastor information'}</h2><p>The reference is confidential. You will see when it is complete, but only authorized CMC leaders can read the answers.</p></div>
      <form id="referenceRequestForm" class="cmcFormGrid">
        <label>Pastor or ministry leader name<input name="pastor_name" autocomplete="name" required maxlength="140" value="${escapeHtml(reference.pastor_name || '')}"></label>
        <label>Email address<input name="pastor_email" type="email" autocomplete="email" required maxlength="254" value="${escapeHtml(reference.pastor_email || '')}"></label>
        <div class="wide cmcReferenceActions"><p id="referenceRequestMessage" class="cmcAdminMessage"></p><button type="submit">${waiting || failed ? 'Send a new secure link' : 'Send reference request'} →</button></div>
      </form>`;
    document.getElementById('referenceRequestForm').addEventListener('submit', submit);
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = document.getElementById('referenceRequestMessage');
    button.disabled = true;
    button.textContent = 'Sending…';
    message.textContent = 'Creating a secure link and sending the email…';
    try {
      const response = await fetch('/.netlify/functions/pastoral-reference-request', {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not send the reference request.');
      render(data.reference);
    } catch (error) {
      message.textContent = error.message || 'Could not send the reference request.';
      message.classList.add('error');
      button.disabled = false;
      button.textContent = 'Send reference request →';
    }
  }

  function errorState(message) { return `<div class="cmcReferenceStatus warning"><span>!</span><div><h2>Unable to open this assignment.</h2><p>${escapeHtml(message)}</p><a class="buttonLink" href="dashboard.html">Return to My Pathway →</a></div></div>`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'the recorded date' : date.toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' }); }
  load();
})();

