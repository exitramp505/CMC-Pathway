(async function(){
  const shell = document.getElementById('publicReferenceShell');
  const intro = document.getElementById('publicReferenceIntro');
  const token = new URLSearchParams(window.location.search).get('token') || '';
  try {
    const response = await fetch(`/.netlify/functions/pastoral-reference-public?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'This reference link is unavailable.');
    renderForm(data.reference);
  } catch (error) {
    intro.textContent = 'The secure link could not be opened.';
    shell.innerHTML = `<div class="cmcReferenceStatus warning"><span>!</span><div><h2>Reference link unavailable.</h2><p>${escapeHtml(error.message)}</p></div></div>`;
  }

  function renderForm(reference) {
    intro.textContent = `${reference.participant_name} named you as a pastoral reference. Your answers are confidential and visible only to authorized CMC leaders.`;
    shell.innerHTML = `<form id="publicReferenceForm" class="cmcPublicReferenceForm">
      <div class="cmcReferenceIntro"><p class="cmcEyebrow">REFERENCE FOR</p><h2>${escapeHtml(reference.participant_name)}</h2><p>Please answer candidly based on your direct experience. The participant will only see that the reference was received.</p></div>
      <fieldset><legend>About you</legend><div class="cmcFormGrid">
        <label>Role or title<input name="pastor_title" maxlength="140"></label><label>Church or ministry<input name="church_ministry" maxlength="180"></label>
        <label>Phone (optional)<input name="phone" type="tel" maxlength="80"></label><label>How long have you known the participant?<input name="known_for" required maxlength="100" placeholder="For example: 4 years"></label>
        <label class="wide">How do you know and work with the participant?<textarea name="relationship" required maxlength="220"></textarea></label>
      </div></fieldset>
      <fieldset><legend>Ministry readiness</legend><p class="cmcFieldHelp">Rate each area from 1 (serious concern) to 5 (clear strength).</p><div class="cmcReferenceRatingGrid">
        ${rating('spiritual_maturity','Spiritual maturity')}${rating('character_integrity','Character and integrity')}${rating('teachability','Teachability')}${rating('relational_health','Relational health')}${rating('leadership','Leadership')}${rating('ministry_readiness','Overall ministry readiness')}
      </div></fieldset>
      <fieldset><legend>Your recommendation</legend><div class="cmcFormGrid">
        <label class="wide">Ministry strengths<textarea name="strengths" required maxlength="4000"></textarea></label><label class="wide">Areas for continued growth<textarea name="growth_areas" required maxlength="4000"></textarea></label>
        <label class="wide">Concerns a CMC leader should explore (optional)<textarea name="concerns" maxlength="4000"></textarea></label>
        <label class="wide">Recommendation<select name="recommendation" required><option value="">Choose one</option><option value="recommend">Recommend</option><option value="recommend_with_reservations">Recommend with reservations</option><option value="do_not_recommend">Do not recommend at this time</option></select></label>
      </div><label class="cmcReferenceCheck"><input name="may_contact" type="checkbox"><span>CMC leaders may contact me to discuss this reference.</span></label><label class="cmcReferenceCheck"><input name="attested" type="checkbox" required><span>I confirm that these answers are truthful and based on my direct knowledge.</span></label></fieldset>
      <div class="cmcReferenceActions"><p id="publicReferenceMessage" class="cmcAdminMessage"></p><button type="submit">Submit confidential reference →</button></div>
    </form>`;
    document.getElementById('publicReferenceForm').addEventListener('submit', submit);
  }

  function rating(name, label) { return `<label>${escapeHtml(label)}<select name="${name}" required><option value="">Choose</option><option value="1">1 · Serious concern</option><option value="2">2</option><option value="3">3 · Developing</option><option value="4">4</option><option value="5">5 · Clear strength</option><option value="unable">Unable to assess</option></select></label>`; }
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); const message = document.getElementById('publicReferenceMessage');
    button.disabled = true; button.textContent = 'Submitting…'; message.textContent = 'Securely submitting your reference…';
    const values = Object.fromEntries(new FormData(form).entries()); values.token = token; values.may_contact = form.elements.may_contact.checked;
    try {
      const response = await fetch('/.netlify/functions/pastoral-reference-public', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(values) });
      const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(data.error || 'Could not submit the reference.');
      intro.textContent = 'Your confidential reference has been received.';
      shell.innerHTML = `<div class="cmcReferenceStatus complete"><span>✓</span><div><p class="cmcEyebrow">REFERENCE RECEIVED</p><h2>Thank you.</h2><p>Your response was securely recorded. You may now close this page.</p></div></div>`;
      window.history.replaceState({}, '', 'pastoral-reference.html?submitted=1');
    } catch (error) { message.textContent = error.message || 'Could not submit the reference.'; message.classList.add('error'); button.disabled = false; button.textContent = 'Submit confidential reference →'; }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }
})();

