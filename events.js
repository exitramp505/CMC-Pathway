(async function(){
  const localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get('preview') === '1';
  let profile = { id:'preview-admin', full_name:'George Williams', email:'george@openbibleeast.org', region:'East', account_role:'cmc_admin' };
  let token = '';
  if (!localPreview) {
    const user = await dcAuth.requireUser();
    if (!user) return;
    profile = await dcAuth.getProfile(user.id).catch(() => null);
    if (!['regional_leader', 'cmc_admin'].includes(profile?.account_role)) {
      window.location.replace('dashboard.html');
      return;
    }
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    token = session.data?.session?.access_token || '';
  }
  dcAuth.renderRoleNavigation(profile, 'events');
  const editor = document.getElementById('eventEditorDialog');
  const editorForm = document.getElementById('eventEditorForm');
  const inviteDialog = document.getElementById('eventInviteDialog');
  const inviteForm = document.getElementById('eventInviteForm');
  let events = [];
  let participants = [];
  let invitations = [];
  let currentFilter = 'upcoming';
  let activeInviteEvent = null;

  document.getElementById('createEventButton').addEventListener('click', () => openEditor());
  document.querySelectorAll('[data-close-event-editor]').forEach(button => button.addEventListener('click', () => editor.close()));
  document.querySelectorAll('[data-close-event-invites]').forEach(button => button.addEventListener('click', () => inviteDialog.close()));
  document.querySelectorAll('[data-event-filter]').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.eventFilter;
    document.querySelectorAll('[data-event-filter]').forEach(item => item.classList.toggle('active', item === button));
    renderEvents();
  }));
  editorForm.addEventListener('submit', saveEvent);
  inviteForm.addEventListener('submit', saveInvites);
  document.getElementById('eventInviteSearch').addEventListener('input', renderInvitees);
  document.getElementById('selectAllInvitees').addEventListener('click', selectVisibleInvitees);
  document.getElementById('eventList').addEventListener('click', handleEventAction);
  if (profile.account_role === 'regional_leader') {
    document.getElementById('eventRegionField').classList.add('hidden');
  }

  await load();

  async function load() {
    setPageMessage('Loading events…');
    try {
      if (localPreview) {
        loadPreviewData();
        renderStats();
        renderEvents();
        setPageMessage('Local preview · No changes are sent or published.');
        return;
      }
      const response = await fetch('/.netlify/functions/events-admin', {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load events.');
      events = data.events || [];
      participants = data.participants || [];
      invitations = data.invitations || [];
      renderStats();
      renderEvents();
      setPageMessage('');
    } catch (error) {
      setPageMessage(error.message || 'Could not load events.', true);
    }
  }

  function renderStats() {
    const now = Date.now();
    const upcoming = events.filter(item => item.status === 'published' && endTime(item) >= now);
    const pastIds = new Set(events.filter(item => endTime(item) < now).map(item => item.id));
    const drafts = events.filter(item => item.status === 'draft');
    setText('upcomingEventCount', upcoming.length);
    setText('eventResponseCount', invitations.filter(item => item.rsvp_status === 'pending' && !pastIds.has(item.event_id)).length);
    setText('pastEventCount', events.filter(item => endTime(item) < now).length);
    setText('upcomingFilterCount', upcoming.length);
    setText('pastFilterCount', pastIds.size);
    setText('draftFilterCount', drafts.length);
  }

  function renderEvents() {
    const now = Date.now();
    const filtered = events.filter(item => {
      if (currentFilter === 'draft') return item.status === 'draft';
      if (currentFilter === 'past') return item.status !== 'draft' && endTime(item) < now;
      return item.status === 'published' && endTime(item) >= now;
    });
    const list = document.getElementById('eventList');
    if (!filtered.length) {
      list.innerHTML = `<div class="cmcEventEmpty"><strong>No ${currentFilter} events.</strong><p>Create an event when you are ready to invite people.</p></div>`;
      return;
    }
    list.innerHTML = filtered.map(event => {
      const eventInvites = invitations.filter(item => item.event_id === event.id);
      const pending = eventInvites.filter(item => item.rsvp_status === 'pending').length;
      const going = eventInvites.filter(item => item.rsvp_status === 'going').length;
      const attended = eventInvites.filter(item => item.attendance_status === 'attended').length;
      const past = endTime(event) < now;
      return `<article class="cmcEventCard${past ? ' past' : ''}">
        <span class="cmcEventCardDate"><small>${escapeHtml(month(event.starts_at))}</small><strong>${escapeHtml(day(event.starts_at))}</strong></span>
        <div class="cmcEventCardCopy">
          <div class="cmcEventCardMeta"><span>${escapeHtml(titleCase(event.stage_key))}</span>${event.region ? `<span>Open Bible ${escapeHtml(event.region)} Region</span>` : '<span>All regions</span>'}<em>${escapeHtml(event.status)}</em>${event.public_listing ? '<em>Public website</em>' : ''}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.summary || event.description || 'No event summary added.')}</p>
          <small>${escapeHtml(formatDateTime(event.starts_at))}${event.location_name ? ` · ${escapeHtml(event.location_name)}` : ''}</small>
        </div>
        <div class="cmcEventCardResponses">
          <span><strong>${eventInvites.length}</strong> invited</span>
          <span><strong>${going}</strong> going</span>
          <span><strong>${past ? attended : pending}</strong> ${past ? 'attended' : 'need reply'}</span>
        </div>
        <div class="cmcEventCardActions">
          ${event.status === 'draft'
            ? `<button class="primary" type="button" data-event-edit="${event.id}">Finish event</button>`
            : `<button class="primary" type="button" data-event-invite="${event.id}">${past ? 'View people' : eventInvites.length ? 'Manage invitations' : 'Invite people'}</button>`}
          ${event.status !== 'draft' ? `<button type="button" data-event-edit="${event.id}">Edit</button>` : ''}
          ${event.status !== 'cancelled' && !past
            ? `<details class="cmcEventActionMenu">
                <summary aria-label="More actions" title="More actions">•••</summary>
                <div><button class="danger" type="button" data-event-cancel="${event.id}">Cancel event</button></div>
              </details>`
            : ''}
        </div>
      </article>`;
    }).join('');
  }

  function handleEventAction(event) {
    const inviteButton = event.target.closest('[data-event-invite]');
    const editButton = event.target.closest('[data-event-edit]');
    const cancelButton = event.target.closest('[data-event-cancel]');
    if (inviteButton) openInviteDialog(inviteButton.dataset.eventInvite);
    if (editButton) openEditor(events.find(item => item.id === editButton.dataset.eventEdit));
    if (cancelButton) cancelEvent(cancelButton.dataset.eventCancel);
  }

  function openEditor(event = null) {
    editorForm.reset();
    document.getElementById('eventEditorTitle').textContent = event ? 'Edit event' : 'Create an event';
    if (event) {
      for (const [key, value] of Object.entries(event)) {
        if (!editorForm.elements[key]) continue;
        if (editorForm.elements[key].type === 'checkbox') {
          editorForm.elements[key].checked = Boolean(value);
          continue;
        }
        editorForm.elements[key].value = ['starts_at', 'ends_at', 'rsvp_deadline'].includes(key)
          ? localInputDate(value)
          : value ?? '';
      }
    } else {
      editorForm.elements.stage_key.value = 'discern';
      editorForm.elements.status.value = 'draft';
      editorForm.elements.public_listing.checked = false;
    }
    setEditorMessage('');
    editor.showModal();
  }

  async function saveEvent(event) {
    event.preventDefault();
    const button = document.getElementById('saveEventButton');
    const values = Object.fromEntries(new FormData(editorForm).entries());
    values.public_listing = editorForm.elements.public_listing.checked;
    button.disabled = true;
    setEditorMessage('Saving event…');
    try {
      if (localPreview) {
        const index = events.findIndex(item => item.id === values.id);
        const saved = {
          ...values,
          id:values.id || `00000000-0000-4000-8000-${String(events.length + 1).padStart(12, '0')}`,
          starts_at:new Date(values.starts_at).toISOString(),
          ends_at:values.ends_at ? new Date(values.ends_at).toISOString() : null,
          rsvp_deadline:values.rsvp_deadline ? new Date(values.rsvp_deadline).toISOString() : null
        };
        if (index >= 0) events[index] = saved;
        else events.push(saved);
        renderStats();
        renderEvents();
        setEditorMessage('Event saved in this local preview.');
        window.setTimeout(() => editor.close(), 300);
        return;
      }
      const response = await fetch('/.netlify/functions/events-admin', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ action:'save_event', event:values })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save the event.');
      setEditorMessage('Event saved.');
      window.setTimeout(() => {
        editor.close();
        load();
      }, 350);
    } catch (error) {
      setEditorMessage(error.message || 'Could not save the event.', true);
    } finally {
      button.disabled = false;
    }
  }

  function openInviteDialog(eventId) {
    activeInviteEvent = events.find(item => item.id === eventId);
    if (!activeInviteEvent) return;
    const readOnly = endTime(activeInviteEvent) < Date.now();
    inviteForm.dataset.readonly = readOnly ? 'true' : 'false';
    setText('eventInviteTitle', activeInviteEvent.title);
    document.getElementById('inviteEventId').value = activeInviteEvent.id;
    document.getElementById('eventInviteSearch').value = '';
    setInviteMessage('');
    document.getElementById('selectAllInvitees').classList.toggle('hidden', readOnly);
    document.getElementById('notifyEventInvitees').closest('label').classList.toggle('hidden', readOnly);
    document.getElementById('saveEventInvites').classList.toggle('hidden', readOnly);
    if (readOnly) setInviteMessage('Invitation history is locked. Attendance can be updated from each participant’s Events tab.');
    renderInvitees();
    inviteDialog.showModal();
  }

  function renderInvitees() {
    if (!activeInviteEvent) return;
    const query = document.getElementById('eventInviteSearch').value.trim().toLowerCase();
    const invited = new Set(invitations.filter(item => item.event_id === activeInviteEvent.id).map(item => item.user_id));
    const visible = participants.filter(person => {
      if (activeInviteEvent.region && person.region !== activeInviteEvent.region) return false;
      return !query || [person.full_name, person.email, person.church_name, person.region].join(' ').toLowerCase().includes(query);
    });
    document.getElementById('eventInviteeList').innerHTML = visible.length
      ? visible.map(person => {
          const record = invitations.find(item => item.event_id === activeInviteEvent.id && item.user_id === person.id);
          return `<label class="cmcEventInvitee">
            <input type="checkbox" value="${escapeHtml(person.id)}"${invited.has(person.id) ? ' checked' : ''}${inviteForm.dataset.readonly === 'true' ? ' disabled' : ''}>
            <span class="cmcAssignmentOptionCheck">✓</span>
            <span><strong>${escapeHtml(person.full_name || person.email)}</strong><small>${escapeHtml([person.church_name, person.region && `Open Bible ${person.region} Region`].filter(Boolean).join(' · '))}</small></span>
            ${record ? `<em>${escapeHtml(rsvpLabel(record.rsvp_status))}</em>` : ''}
          </label>`;
        }).join('')
      : '<p class="cmcDetailEmpty">No participants match this search.</p>';
  }

  function selectVisibleInvitees() {
    document.querySelectorAll('#eventInviteeList input[type="checkbox"]').forEach(input => {
      input.checked = true;
    });
  }

  async function saveInvites(event) {
    event.preventDefault();
    const button = document.getElementById('saveEventInvites');
    const participantIds = [...document.querySelectorAll('#eventInviteeList input:checked')].map(input => input.value);
    button.disabled = true;
    setInviteMessage('Saving invitations…');
    try {
      if (localPreview) {
        invitations = invitations.filter(item => item.event_id !== activeInviteEvent.id);
        invitations.push(...participantIds.map((userId, index) => ({
          id:`preview-${activeInviteEvent.id}-${userId}`,
          event_id:activeInviteEvent.id,
          user_id:userId,
          rsvp_status:index ? 'pending' : 'going',
          attendance_status:'pending'
        })));
        setInviteMessage(`${participantIds.length} invited in this local preview.`);
        renderStats();
        renderEvents();
        window.setTimeout(() => inviteDialog.close(), 400);
        return;
      }
      const response = await fetch('/.netlify/functions/events-admin', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          action:'set_invitees',
          event_id:activeInviteEvent.id,
          participant_ids:participantIds,
          notify:document.getElementById('notifyEventInvitees').checked
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save invitations.');
      const sent = (data.notifications || []).filter(item => item.sent).length;
      setInviteMessage(`${data.invited} invited${sent ? ` · ${sent} email${sent === 1 ? '' : 's'} sent` : ''}.`);
      window.setTimeout(() => {
        inviteDialog.close();
        load();
      }, 600);
    } catch (error) {
      setInviteMessage(error.message || 'Could not save invitations.', true);
    } finally {
      button.disabled = false;
    }
  }

  async function cancelEvent(eventId) {
    const event = events.find(item => item.id === eventId);
    if (!event || !window.confirm(`Cancel “${event.title}”? It will stop appearing in participant pathways, but its history will be retained.`)) return;
    try {
      if (localPreview) {
        event.status = 'cancelled';
        renderStats();
        renderEvents();
        return;
      }
      const response = await fetch('/.netlify/functions/events-admin', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ action:'cancel_event', event_id:eventId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not cancel the event.');
      await load();
    } catch (error) {
      setPageMessage(error.message || 'Could not cancel the event.', true);
    }
  }

  function setPageMessage(value, error){const el=document.getElementById('eventPageMessage');el.textContent=value||'';el.classList.toggle('error',Boolean(error))}
  function setEditorMessage(value, error){const el=document.getElementById('eventEditorMessage');el.textContent=value||'';el.classList.toggle('error',Boolean(error))}
  function setInviteMessage(value, error){const el=document.getElementById('eventInviteMessage');el.textContent=value||'';el.classList.toggle('error',Boolean(error))}
  function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
  function endTime(event){return new Date(event.ends_at || event.starts_at).getTime()}
  function month(value){const date=new Date(value);return Number.isNaN(date.getTime())?'TBD':date.toLocaleDateString([],{month:'short'}).toUpperCase()}
  function day(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString([],{day:'numeric'})}
  function formatDateTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Date to be announced':date.toLocaleString([],{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
  function localInputDate(value){if(!value)return'';const date=new Date(value);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)}
  function rsvpLabel(value){return {pending:'No response',going:'Going',declined:'Can’t attend'}[value]||titleCase(value)}
  function titleCase(value){return String(value||'').replace(/_/g,' ').replace(/\b\w/g,character=>character.toUpperCase())}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]))}

  function loadPreviewData() {
    if (events.length) return;
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 28);
    nextMonth.setHours(10, 0, 0, 0);
    const following = new Date(nextMonth);
    following.setDate(following.getDate() + 34);
    const past = new Date();
    past.setDate(past.getDate() - 24);
    events = [
      {
        id:'10000000-0000-4000-8000-000000000001',
        title:'CMC Discernment Gathering',
        summary:'A regional gathering for pioneers and pastors exploring their next step.',
        description:'Meet CMC leaders, ask questions, and take part in guided discernment conversations.',
        starts_at:nextMonth.toISOString(),
        ends_at:new Date(nextMonth.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        location_name:'Open Bible East Regional Office',
        address:'Columbus, Ohio',
        rsvp_deadline:new Date(nextMonth.getTime() - 7 * 86400000).toISOString(),
        stage_key:'discern',
        region:'East',
        status:'published'
      },
      {
        id:'10000000-0000-4000-8000-000000000002',
        title:'Pioneer Cohort Lunch',
        summary:'An informal lunch for pioneers currently working through Discover.',
        starts_at:following.toISOString(),
        ends_at:new Date(following.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        location_name:'River City Open Bible',
        address:'Dayton, Ohio',
        stage_key:'discover',
        region:'East',
        status:'published'
      },
      {
        id:'10000000-0000-4000-8000-000000000003',
        title:'Spring Multiplication Forum',
        summary:'A completed regional event retained for attendance history.',
        starts_at:past.toISOString(),
        ends_at:new Date(past.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        location_name:'Online',
        stage_key:'develop',
        region:'East',
        status:'published'
      },
      {
        id:'10000000-0000-4000-8000-000000000004',
        title:'Sending Church Roundtable',
        summary:'Draft roundtable for pastors developing a sending culture.',
        starts_at:following.toISOString(),
        ends_at:null,
        location_name:'',
        stage_key:'develop',
        region:'East',
        status:'draft'
      }
    ];
    participants = [
      { id:'20000000-0000-4000-8000-000000000001', full_name:'Honor Quaint', email:'honor@example.org', church_name:'Riverview Open Bible', region:'East' },
      { id:'20000000-0000-4000-8000-000000000002', full_name:'Bill Jones', email:'bill@example.org', church_name:'Dayton Open Bible', region:'East' },
      { id:'20000000-0000-4000-8000-000000000003', full_name:'Alex Morgan', email:'alex@example.org', church_name:'New Hope Church', region:'East' }
    ];
    invitations = [
      { id:'preview-1', event_id:events[0].id, user_id:participants[0].id, rsvp_status:'going', attendance_status:'pending' },
      { id:'preview-2', event_id:events[0].id, user_id:participants[1].id, rsvp_status:'pending', attendance_status:'pending' },
      { id:'preview-3', event_id:events[2].id, user_id:participants[0].id, rsvp_status:'going', attendance_status:'attended' },
      { id:'preview-4', event_id:events[2].id, user_id:participants[1].id, rsvp_status:'declined', attendance_status:'excused' }
    ];
  }
})();
