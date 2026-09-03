(async function () {
  const user = await dcAuth.requireUser();
  if (!user) return;

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (!['regional_leader', 'cmc_admin'].includes(profile?.account_role)) {
    location.replace(profile?.is_coach ? 'coach.html' : 'dashboard.html');
    return;
  }

  dcAuth.renderRoleNavigation(profile, 'team');
  const sb = await dcAuth.getSupabaseClient();
  const token = (await sb.auth.getSession()).data?.session?.access_token || '';
  const message = document.getElementById('coachingMessage');
  const actionPanel = document.getElementById('coachingActionPanel');
  const confirmDialog = document.getElementById('coachingConfirmDialog');
  let pendingMutation = null;
  let currentView = 'coaches';
  let state = { profiles: [], coaches: [], participants: [], assignments: [], regions: [], viewer: profile };

  document.getElementById('addCoachForm').addEventListener('submit', event => save(event, 'add_coach'));
  document.getElementById('assignCoachForm').addEventListener('submit', event => save(event, 'assign'));
  document.getElementById('coachRegion').addEventListener('change', renderCoachOptions);
  document.getElementById('assignmentRegion').addEventListener('change', renderAssignOptions);
  document.getElementById('coachRegionFilter').addEventListener('change', renderList);
  document.getElementById('coachSearch').addEventListener('input', renderList);
  document.querySelectorAll('[data-open-coaching-panel]').forEach(button => {
    button.addEventListener('click', () => setPanel(button.dataset.openCoachingPanel));
  });
  document.querySelectorAll('[data-close-coaching-panel]').forEach(button => {
    button.addEventListener('click', closePanel);
  });
  document.querySelectorAll('[data-coaching-view]').forEach(button => {
    button.addEventListener('click', () => {
      currentView = button.dataset.coachingView;
      document.querySelectorAll('[data-coaching-view]').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderList();
    });
  });
  document.getElementById('coachList').addEventListener('click', handleListAction);
  confirmDialog.addEventListener('close', () => {
    if (confirmDialog.returnValue === 'confirm' && pendingMutation) {
      const { body, successMessage } = pendingMutation;
      pendingMutation = null;
      mutate(body, successMessage);
    } else {
      pendingMutation = null;
    }
  });

  await load();

  async function load() {
    setBusy(true);
    setMessage('Loading coaching relationships…');
    try {
      const response = await fetch('/.netlify/functions/coaching-admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load coaching.');
      state = data;
      render();
      setMessage('');
    } catch (error) {
      setMessage(error.message, true);
      document.getElementById('coachList').innerHTML = emptyState('Coaching could not load', 'Refresh the page to try again.');
    } finally {
      setBusy(false);
    }
  }

  function render() {
    const admin = state.viewer.account_role === 'cmc_admin';
    setText('coachingScope', admin ? 'All Open Bible regions' : state.viewer.region);
    setText('coachingScopeCopy', admin ? 'Manage coaches and matches nationwide.' : 'Manage coaches and matches in your region.');
    const unassigned = getUnassignedParticipants();
    setText('coachCount', state.coaches.length);
    setText('unassignedCount', unassigned.length);
    renderRegionOptions();
    renderCoachOptions();
    renderAssignOptions();
    renderList();
  }

  function renderRegionOptions() {
    const regionOptions = state.regions.map(region => `<option value="${esc(region)}">${esc(region)}</option>`).join('');
    const coachRegion = document.getElementById('coachRegion');
    const assignmentRegion = document.getElementById('assignmentRegion');
    const regionFilter = document.getElementById('coachRegionFilter');
    const coachValue = coachRegion.value;
    const assignmentValue = assignmentRegion.value;
    const filterValue = regionFilter.value || 'all';
    coachRegion.innerHTML = `<option value="">Choose a region</option>${regionOptions}`;
    assignmentRegion.innerHTML = `<option value="">Choose a region</option>${regionOptions}`;
    regionFilter.innerHTML = `<option value="all">All regions</option>${regionOptions}`;
    coachRegion.value = state.regions.includes(coachValue) ? coachValue : (state.regions[0] || '');
    assignmentRegion.value = state.regions.includes(assignmentValue) ? assignmentValue : (state.regions[0] || '');
    regionFilter.value = filterValue === 'all' || state.regions.includes(filterValue) ? filterValue : 'all';
  }

  function renderCoachOptions() {
    const region = document.getElementById('coachRegion').value;
    const select = document.getElementById('coachAccount');
    const previous = select.value;
    const currentMembership = new Map(state.coaches.map(coach => [coach.id, coach.regions]));
    const available = state.profiles.filter(item => {
      if (item.id === state.viewer.id) return false;
      return !region || !(currentMembership.get(item.id) || []).includes(region);
    });
    select.innerHTML = available.length
      ? `<option value="">Choose an existing account</option>${available.map(personOption).join('')}`
      : '<option value="">Everyone is already approved for this region</option>';
    if ([...select.options].some(item => item.value === previous)) select.value = previous;
  }

  function renderAssignOptions() {
    const region = document.getElementById('assignmentRegion').value;
    const participantSelect = document.getElementById('coachParticipant');
    const coachSelect = document.getElementById('assignmentCoach');
    const previousParticipant = participantSelect.value;
    const previousCoach = coachSelect.value;
    const participants = state.participants.filter(item => item.region === region);
    const coaches = state.coaches.filter(item => item.regions.includes(region));
    const assignmentsByParticipant = new Map(state.assignments.map(item => [item.participant_id, item]));

    participantSelect.innerHTML = participants.length
      ? `<option value="">Choose a participant</option>${participants.map(item => {
          const assignment = assignmentsByParticipant.get(item.id);
          const suffix = assignment?.coach ? ` — currently with ${assignment.coach.full_name || assignment.coach.email}` : '';
          return `<option value="${esc(item.id)}">${esc(item.full_name || item.email)}${esc(suffix)}</option>`;
        }).join('')}`
      : '<option value="">No participants in this region</option>';
    coachSelect.innerHTML = coaches.length
      ? `<option value="">Choose an approved coach</option>${coaches.map(personOption).join('')}`
      : '<option value="">Add a coach for this region first</option>';

    if ([...participantSelect.options].some(item => item.value === previousParticipant)) participantSelect.value = previousParticipant;
    if ([...coachSelect.options].some(item => item.value === previousCoach)) coachSelect.value = previousCoach;
  }

  function renderList() {
    const query = document.getElementById('coachSearch').value.trim().toLowerCase();
    const region = document.getElementById('coachRegionFilter').value || 'all';
    const list = document.getElementById('coachList');
    list.classList.toggle('unassigned-view', currentView === 'unassigned');

    if (currentView === 'unassigned') {
      const people = getUnassignedParticipants().filter(person => {
        const matchesRegion = region === 'all' || person.region === region;
        const matchesQuery = [person.full_name, person.email, person.region].join(' ').toLowerCase().includes(query);
        return matchesRegion && matchesQuery;
      });
      list.innerHTML = people.length ? people.map(unassignedCard).join('') : emptyState(
        query || region !== 'all' ? 'No pioneers match these filters' : 'Everyone has a coach',
        query || region !== 'all' ? 'Try another search or region.' : 'There are no unassigned pioneers in your scope.'
      );
      return;
    }

    const coaches = state.coaches.filter(coach => {
      const matchesRegion = region === 'all' || coach.regions.includes(region);
      const searchable = [coach.full_name, coach.email, ...coach.regions, ...coach.assignments.flatMap(item => [item.participant?.full_name, item.participant?.email])].join(' ').toLowerCase();
      return matchesRegion && searchable.includes(query);
    });
    list.innerHTML = coaches.length ? coaches.map(coachCard).join('') : emptyState(
      query || region !== 'all' ? 'No coaches match these filters' : 'No coaches yet',
      query || region !== 'all' ? 'Try another search or region.' : 'Add the first approved coach to begin making assignments.',
      query || region !== 'all' ? '' : '<button type="button" data-empty-action="add">Add a coach</button>'
    );
  }

  function coachCard(coach) {
    const assignedCount = coach.assignments.length;
    return `<article class="cmcCoachCard">
      <header>
        <span class="cmcAvatar">${initials(coach.full_name || coach.email)}</span>
        <div class="cmcCoachIdentity"><strong>${esc(coach.full_name || coach.email)}</strong><small>${esc(coach.email)}</small></div>
        <div class="cmcCoachCardActions"><span class="cmcCoachLoad">${assignedCount} ${assignedCount === 1 ? 'pioneer' : 'pioneers'}</span><button type="button" data-assign-coach="${esc(coach.id)}">Assign</button></div>
      </header>
      <div class="cmcCoachRegions" aria-label="Approved regions">${coach.regions.map(region => {
        const hasActiveAssignment = coach.assignments.some(item => item.region === region);
        const disabled = hasActiveAssignment ? ' disabled title="End active assignments in this region before removing access"' : '';
        return `<span>${esc(region)}<button type="button" data-remove-region="${esc(region)}" data-coach="${esc(coach.id)}" aria-label="Remove ${esc(region)} region"${disabled}>×</button></span>`;
      }).join('')}</div>
      <div class="cmcCoachRoster">
        <div class="cmcCoachRosterLabel"><span>Assigned pioneers</span></div>
        ${assignedCount ? coach.assignments.map(assignmentRow).join('') : '<p>No pioneers are assigned to this coach yet.</p>'}
      </div>
    </article>`;
  }

  function assignmentRow(item) {
    const person = item.participant;
    return `<div class="cmcCoachRosterRow">
      <span class="cmcAvatar small">${initials(person.full_name || person.email)}</span>
      <div><strong>${esc(person.full_name || person.email)}</strong><small>${esc(person.region)} · ${esc(person.email)}</small></div>
      <a href="participant.html?id=${esc(person.id)}">View pathway</a>
      <button type="button" data-end="${esc(item.id)}" data-participant-name="${esc(person.full_name || person.email)}">End coaching</button>
    </div>`;
  }

  function unassignedCard(person) {
    return `<article class="cmcUnassignedCoachCard">
      <span class="cmcAvatar">${initials(person.full_name || person.email)}</span>
      <div><strong>${esc(person.full_name || person.email)}</strong><small>${esc(person.region)} · ${esc(person.email)}</small></div>
      <button type="button" data-assign-participant="${esc(person.id)}">Assign coach</button>
    </article>`;
  }

  function getUnassignedParticipants() {
    const assigned = new Set(state.assignments.map(item => item.participant_id));
    return state.participants.filter(person => !assigned.has(person.id));
  }

  function handleListAction(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.emptyAction === 'add') return setPanel('add');
    if (button.dataset.assignParticipant) return openAssignmentForParticipant(button.dataset.assignParticipant);
    if (button.dataset.assignCoach) return openAssignmentForCoach(button.dataset.assignCoach);
    if (button.dataset.end) {
      return confirmMutation(
        'End this coaching relationship?',
        `${button.dataset.participantName} will return to the “Needs a coach” list.`,
        'End coaching',
        { action: 'end_assignment', assignment_id: button.dataset.end },
        'Coaching relationship ended.'
      );
    }
    if (button.dataset.removeRegion) {
      const coach = state.coaches.find(item => item.id === button.dataset.coach);
      return confirmMutation(
        'Remove this coaching region?',
        `${coach?.full_name || coach?.email || 'This coach'} will no longer be available for ${button.dataset.removeRegion}.`,
        'Remove region',
        { action: 'remove_coach_region', coach_id: button.dataset.coach, region: button.dataset.removeRegion },
        'Coaching region removed.'
      );
    }
  }

  function openAssignmentForParticipant(participantId) {
    const participant = state.participants.find(item => item.id === participantId);
    if (!participant) return;
    setPanel('assign');
    document.getElementById('assignmentRegion').value = participant.region;
    renderAssignOptions();
    document.getElementById('coachParticipant').value = participant.id;
    document.getElementById('assignmentCoach').focus();
  }

  function openAssignmentForCoach(coachId) {
    const coach = state.coaches.find(item => item.id === coachId);
    if (!coach) return;
    setPanel('assign');
    const filteredRegion = document.getElementById('coachRegionFilter').value;
    const region = coach.regions.includes(filteredRegion) ? filteredRegion : coach.regions[0];
    document.getElementById('assignmentRegion').value = region;
    renderAssignOptions();
    document.getElementById('assignmentCoach').value = coach.id;
    document.getElementById('coachParticipant').focus();
  }

  function setPanel(name) {
    const opening = actionPanel.dataset.panel !== name || actionPanel.classList.contains('hidden');
    actionPanel.classList.toggle('hidden', !opening);
    actionPanel.dataset.panel = opening ? name : '';
    document.getElementById('addCoachForm').classList.toggle('hidden', !opening || name !== 'add');
    document.getElementById('assignCoachForm').classList.toggle('hidden', !opening || name !== 'assign');
    document.querySelectorAll('[data-open-coaching-panel]').forEach(button => {
      button.setAttribute('aria-expanded', String(opening && button.dataset.openCoachingPanel === name));
    });
    if (opening) {
      const firstSelect = actionPanel.querySelector('form:not(.hidden) select');
      requestAnimationFrame(() => firstSelect?.focus());
    }
  }

  function closePanel() {
    actionPanel.classList.add('hidden');
    actionPanel.dataset.panel = '';
    actionPanel.querySelectorAll('form').forEach(form => form.classList.add('hidden'));
    document.querySelectorAll('[data-open-coaching-panel]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }

  async function save(event, action) {
    event.preventDefault();
    const body = action === 'add_coach'
      ? { action, coach_id: document.getElementById('coachAccount').value, region: document.getElementById('coachRegion').value }
      : { action, participant_id: document.getElementById('coachParticipant').value, coach_id: document.getElementById('assignmentCoach').value, region: document.getElementById('assignmentRegion').value };
    await mutate(body, action === 'add_coach' ? 'Coach added.' : 'Coach assigned.');
  }

  async function mutate(body, successMessage = 'Coaching updated.') {
    setBusy(true);
    setMessage('Saving changes…');
    try {
      const response = await fetch('/.netlify/functions/coaching-admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save coaching.');
      state = data;
      closePanel();
      render();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function confirmMutation(title, copy, label, body, successMessage) {
    pendingMutation = { body, successMessage };
    setText('coachingConfirmTitle', title);
    setText('coachingConfirmMessage', copy);
    setText('coachingConfirmButton', label);
    confirmDialog.returnValue = '';
    confirmDialog.showModal();
  }

  function setBusy(busy) {
    document.querySelector('.cmcCoachingWorkspace').classList.toggle('is-busy', busy);
    document.querySelectorAll('.cmcCoachingWorkspace button[type="submit"]').forEach(button => { button.disabled = busy; });
  }

  function personOption(item) {
    return `<option value="${esc(item.id)}">${esc(item.full_name || item.email)} · ${esc(item.email)}</option>`;
  }

  function emptyState(title, copy, action = '') {
    return `<div class="cmcCoachingEmpty"><span aria-hidden="true">○</span><strong>${esc(title)}</strong><p>${esc(copy)}</p>${action}</div>`;
  }

  function setMessage(value, error = false) {
    message.textContent = value;
    message.classList.toggle('error', error);
    message.classList.toggle('visible', Boolean(value));
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function initials(value) {
    return String(value || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }
})();
