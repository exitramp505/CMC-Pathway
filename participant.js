(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const participantId = new URLSearchParams(window.location.search).get('id') || '';
  const loading = document.getElementById('participantDetailLoading');
  const content = document.getElementById('participantDetailContent');
  const profileForm = document.getElementById('participantProfileForm');
  let token = '';
  let viewer = null;
  let participant = null;
  let participantAssignments = [];
  let managementPathwayItems = [];
  let managementCourses = [];
  let managementEvents = [];
  let participantEvents = [];
  let managementOptions = [];
  let initialPathwayKeys = new Set();
  let initialCourseIds = new Set();
  let initialEventIds = new Set();
  let pendingManagementChange = null;
  let managementDirty = false;
  let activeManagementStage = 'discover';
  const pathwayStages = [
    { key:'discover', number:'01', title:'Discover', description:'Shared foundation and first steps.' },
    { key:'discern', number:'02', title:'Discern', description:'Calling, character, context, and readiness.' },
    { key:'develop', number:'03', title:'Develop', description:'Preparation, formation, and practical skills.' },
    { key:'deploy', number:'04', title:'Deploy', description:'Movement into mission with accountable support.' }
  ];

  setupTabs();
  dcAuth.fillStateSelect(document.getElementById('participantStateSelect'));

  if (!participantId) {
    showError('No participant was selected.');
    return;
  }

  try {
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    token = session.data?.session?.access_token || '';
    const response = await fetch(
      `/.netlify/functions/participant-detail?participant_id=${encodeURIComponent(participantId)}`,
      { headers:{ Authorization:`Bearer ${token}` } }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Could not load this participant.');
    }

    dcAuth.renderRoleNavigation(data.viewer, 'people');
    render(data);
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    await loadManagement();
  } catch (error) {
    showError(error.message || 'Could not load this participant.');
  }

  document.getElementById('editParticipantButton').addEventListener('click', () => {
    fillProfileForm(participant);
    document.getElementById('participantProfileDetails').classList.add('hidden');
    profileForm.classList.remove('hidden');
    document.getElementById('editParticipantButton').classList.add('hidden');
  });
  document.getElementById('cancelParticipantEdit').addEventListener('click', closeProfileForm);
  document.getElementById('archiveParticipantButton').addEventListener('click', toggleParticipantArchive);
  profileForm.addEventListener('submit', saveProfile);
  document.getElementById('saveParticipantManagement').addEventListener('click', saveManagement);
  document.getElementById('confirmParticipantChanges').addEventListener('click', confirmManagement);
  document.getElementById('participantManagementContent').addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"][name^="managed_"]')) updateManagementDirtyState();
  });
  window.addEventListener('beforeunload', event => {
    if (!managementDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function render(data) {
    viewer = data.viewer || viewer;
    participant = data.participant || {};
    const assignments = data.assignments || [];
    participantAssignments = assignments;
    const reports = data.reports || [];
    const reflections = data.reflections || [];
    const application = data.application || null;
    const activity = data.activity || [];
    participantEvents = data.events || [];
    const stage = participant.current_stage || inferredStage(assignments);
    const completedCount = assignments.filter(item => item.completed).length;
    const upcomingEvents = participantEvents.filter(invitation => {
      const event = invitation.event || {};
      const end = new Date(event.ends_at || event.starts_at || 0).getTime();
      return event.status === 'published' && end >= Date.now();
    });
    const pendingEventResponses = upcomingEvents.filter(invitation =>
      !invitation.rsvp_status || invitation.rsvp_status === 'pending'
    ).length;

    document.title = `${participant.full_name || 'Participant'} | CMC Pathway`;
    setText('participantAvatar', initials(participant.full_name));
    setText('participantName', participant.full_name || participant.email || 'Participant');
    setText(
      'participantContext',
      [participant.ministry_role, participant.church_name, participant.region ? `Open Bible ${participant.region} Region` : '']
        .filter(Boolean)
        .join(' · ')
    );
    setText('participantStagePill', titleCase(stage));
    setText('currentStageStat', titleCase(stage));
    setText('currentStageCaption', stageCaption(stage));
    setText('assignedCountStat', assignments.length);
    setText('completedCountStat', completedCount);
    setText('completedCaption', completedCount === 1 ? 'Item finished' : 'Items finished');
    setText('upcomingEventCountStat', upcomingEvents.length);
    setText(
      'upcomingEventCaption',
      pendingEventResponses
        ? `${pendingEventResponses} ${pendingEventResponses === 1 ? 'response' : 'responses'} needed`
        : upcomingEvents.length
          ? 'All invitations answered'
          : 'No upcoming invitations'
    );
    renderArchiveState();

    const emailLink = document.getElementById('emailParticipantLink');
    emailLink.href = participant.email ? `mailto:${participant.email}` : '#';
    if (!participant.email) emailLink.classList.add('hidden');
    renderProfile(participant);
    renderActivity(activity);
    renderWork(assignments, reports, application);
    renderEventHistory(participantEvents);
    renderRecords(reports, application, reflections);
  }

  function renderArchiveState() {
    const archived = Boolean(participant.archived_at);
    const archiveStatus = document.getElementById('participantArchiveStatus');
    const archiveButton = document.getElementById('archiveParticipantButton');
    archiveStatus.classList.toggle('hidden', !archived);
    document.getElementById('participantDetailContent').classList.toggle('cmcParticipantArchived', archived);
    const canArchive = participant.account_role === 'participant';
    archiveButton.classList.toggle('hidden', !canArchive);
    archiveButton.classList.toggle('restore', archived);
    archiveButton.textContent = archived ? 'Restore person' : 'Archive person';
  }

  async function toggleParticipantArchive() {
    const button = document.getElementById('archiveParticipantButton');
    const archived = Boolean(participant.archived_at);
    const verb = archived ? 'restore' : 'archive';
    const name = participant.full_name || participant.email || 'this person';
    if (!window.confirm(
      archived
        ? `Restore ${name} to the active People directory?`
        : `Archive ${name}? Their records will be preserved and they can be restored later.`
    )) return;
    button.disabled = true;
    button.textContent = archived ? 'Restoring…' : 'Archiving…';
    try {
      const response = await fetch('/.netlify/functions/participant-manage', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          action:'set_archive',
          participant_id:participantId,
          archived:!archived
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Could not ${verb} this person.`);
      }
      participant = { ...participant, ...data.participant };
      renderArchiveState();
    } catch (error) {
      window.alert(error.message || `Could not ${verb} this person.`);
      renderArchiveState();
    } finally {
      button.disabled = false;
    }
  }

  function renderProfile(person) {
    const details = [
      ['Email', person.email],
      ['Phone', person.phone],
      ['State', stateName(person.state)],
      ['Open Bible region', person.region],
      ['Church or ministry', person.church_name],
      ['Current role', person.ministry_role],
      ['Primary interest', titleCase(person.pathway_interest)],
      ['Joined CMC Pathway', formatDate(person.created_at)]
    ].filter(([,value]) => value);

    document.getElementById('participantProfileDetails').innerHTML = details.length
      ? details.map(([label,value]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
        ).join('')
      : '<p class="cmcDetailEmpty">No profile details have been added yet.</p>';
  }

  function renderActivity(activity) {
    const list = document.getElementById('participantActivityList');
    if (!activity.length) {
      list.innerHTML = '<p class="cmcDetailEmpty">No participant activity has been recorded yet.</p>';
      return;
    }
    list.innerHTML = activity.slice(0, 8).map(item => `<article>
      <span class="cmcActivityMarker ${escapeHtml(item.type || '')}"></span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail || '')}</p>
      </div>
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
    </article>`).join('');
  }

  function renderWork(assignments, reports, application) {
    const reportByKey = new Map(reports.map(report => [assessmentKey(report.assessment_type), report]));
    const rows = assignments
      .filter(item => item.item_key !== 'candidate_record')
      .sort((a,b) => {
        const stageDifference = stageOrder(a.stage_key) - stageOrder(b.stage_key);
        if (stageDifference) return stageDifference;
        return String(a.assigned_at || '').localeCompare(String(b.assigned_at || ''));
      });

    const workList = document.getElementById('participantWorkList');
    if (!rows.length) {
      workList.innerHTML = '<div class="cmcDetailEmpty">No work has been assigned yet.</div>';
      return;
    }

    workList.innerHTML = rows.map(item => {
      const label = item.course?.title || itemLabel(item.item_key);
      const description = item.course?.subtitle || itemDescription(item.item_key);
      const report = reportByKey.get(item.item_key);
      const complete = item.completed
        || Boolean(report)
        || (item.item_key === 'discernment_application' && application?.status === 'submitted');
      const progress = complete
        ? 100
        : Math.max(0, Math.min(100, Number(item.progress || applicationProgress(item, application))));
      const status = complete
        ? 'Complete'
        : progress > 0
          ? 'In progress'
          : item.assignment_source === 'automatic'
            ? 'Available'
            : 'Assigned';
      const action = workAction(item, report, application);

      return `<article class="cmcParticipantWorkItem">
        <span class="cmcWorkStage">${escapeHtml(titleCase(item.stage_key || 'discern'))}</span>
        <div class="cmcWorkItemCopy">
          <h3>${escapeHtml(label)}</h3>
          <p>${escapeHtml(description)}</p>
          <div class="cmcWorkProgress" aria-label="${progress}% complete"><i style="width:${progress}%"></i></div>
        </div>
        <div class="cmcWorkItemStatus">
          <span class="${complete ? 'complete' : progress ? 'progress' : ''}">${escapeHtml(status)}</span>
          <small>${progress}%</small>
          ${action}
        </div>
      </article>`;
    }).join('');
  }

  function workAction(item, report, application) {
    if (report) {
      return `<a href="${recordUrl('assessment', report.id)}">View report →</a>`;
    }
    if (item.item_key === 'discernment_application' && application) {
      return `<a href="${recordUrl('application')}">View application →</a>`;
    }
    if (item.course?.slug) {
      return `<a href="course.html?slug=${encodeURIComponent(item.course.slug)}">View course →</a>`;
    }
    return '<a href="#work" data-open-participant-tab="work">Manage →</a>';
  }

  async function loadManagement() {
    const loadingBox = document.getElementById('participantManagementLoading');
    const managementContent = document.getElementById('participantManagementContent');
    try {
      const [pathwayResponse, courseResponse, eventResponse] = await Promise.all([
        fetch(`/.netlify/functions/participant-manage?participant_id=${encodeURIComponent(participantId)}`, {
          headers:{ Authorization:`Bearer ${token}` }
        }),
        fetch(`/.netlify/functions/leader-course-assignments?participant_id=${encodeURIComponent(participantId)}`, {
          headers:{ Authorization:`Bearer ${token}` }
        }),
        fetch(`/.netlify/functions/events-admin?participant_id=${encodeURIComponent(participantId)}`, {
          headers:{ Authorization:`Bearer ${token}` }
        })
      ]);
      const pathwayData = await pathwayResponse.json().catch(() => ({}));
      const courseData = await courseResponse.json().catch(() => ({}));
      const eventData = await eventResponse.json().catch(() => ({}));
      if (!pathwayResponse.ok || !pathwayData.ok) {
        throw new Error(pathwayData.error || 'Could not load pathway assignments.');
      }
      if (!courseResponse.ok || !courseData.ok) {
        throw new Error(courseData.error || 'Could not load course assignments.');
      }
      if (!eventResponse.ok || !eventData.ok) {
        throw new Error(eventData.error || 'Could not load event invitations.');
      }
      participant = { ...participant, ...pathwayData.participant };
      managementPathwayItems = pathwayData.pathway_items || [];
      managementCourses = courseData.courses || [];
      managementEvents = eventData.events || [];
      initialPathwayKeys = new Set(managementPathwayItems.filter(item => item.assigned && !item.automatic).map(item => item.key));
      initialCourseIds = new Set(managementCourses.filter(item => item.assigned).map(item => item.id));
      initialEventIds = new Set(managementEvents.filter(item => item.invitation).map(item => item.id));
      renderManagement();
      updateManagementDirtyState();
      loadingBox.classList.add('hidden');
      managementContent.classList.remove('hidden');
    } catch (error) {
      loadingBox.textContent = error.message || 'Could not load available assignments.';
      loadingBox.classList.add('error');
    }
  }

  function renderManagement() {
    const managedKeys = new Set([
      ...managementPathwayItems.map(item => item.key),
      ...managementCourses.map(course => course.id)
    ]);
    const automaticAssignments = participantAssignments
      .filter(item => item.assignment_source === 'automatic')
      .filter(item => !managedKeys.has(item.item_key) && !managedKeys.has(item.course?.id))
      .map(item => ({
        key:item.item_key,
        title:item.course?.title || itemLabel(item.item_key),
        description:item.course?.subtitle || itemDescription(item.item_key),
        kind:'automatic',
        type:item.item_type,
        stage_key:item.stage_key,
        assigned:true,
        automatic:true,
        completed:item.completed,
        progress:item.progress
      }));
    managementOptions = [
      ...automaticAssignments,
      ...managementPathwayItems.map(item => ({ ...item, kind:'pathway' })),
      ...managementCourses.map(course => ({
        ...course,
        key:course.id,
        kind:'course',
        description:course.subtitle || course.description || 'Course',
        automatic:false
      })),
      ...managementEvents.map(event => ({
        ...event,
        key:event.id,
        kind:'event',
        type:'event',
        title:event.title,
        description:[
          formatEventDateTime(event.starts_at),
          event.location_name
        ].filter(Boolean).join(' · '),
        assigned:Boolean(event.invitation),
        automatic:false,
        completed:false,
        progress:0
      }))
    ].sort((a,b) => {
      const stageDifference = stageOrder(a.stage_key) - stageOrder(b.stage_key);
      return stageDifference || String(a.title || '').localeCompare(String(b.title || ''));
    });
    activeManagementStage = participant.current_stage || 'discover';
    renderManagementStagePanels();
    activateManagementStage(activeManagementStage);
  }

  function renderManagementStageTabs() {
    const currentStage = participant.current_stage || 'discover';
    document.getElementById('managementStageTabs').innerHTML = pathwayStages.map(stage => {
      const assignedCount = managementOptions.filter(item =>
        item.stage_key === stage.key && item.assigned
      ).length;
      const active = stage.key === activeManagementStage;
      const current = stage.key === currentStage;
      return `<div class="cmcStageAssignmentTab${active ? ' active' : ''}${current ? ' current' : ''}" data-management-stage-tile="${stage.key}">
        <button class="cmcStageTabSelect" type="button" data-management-stage="${stage.key}" aria-selected="${active ? 'true' : 'false'}">
          <span>${stage.number}</span>
          <strong>${stage.title}</strong>
          <p>${escapeHtml(stage.description)}</p>
        </button>
        <div class="cmcStageTabMeta">
          <small>${assignedCount} assigned</small>
          ${current
            ? '<em>Current stage</em>'
            : active
              ? `<button type="button" data-set-current-stage="${stage.key}">Set current stage</button>`
              : ''}
        </div>
      </div>`;
    }).join('');
    document.querySelectorAll('[data-management-stage-tile]').forEach(tile => {
      tile.addEventListener('click', event => {
        if (event.target.closest('[data-set-current-stage]')) return;
        activateManagementStage(tile.dataset.managementStageTile);
      });
    });
    document.querySelectorAll('[data-set-current-stage]').forEach(button => {
      button.addEventListener('click', () => setCurrentStage(button.dataset.setCurrentStage));
    });
  }

  function renderManagementStagePanels() {
    document.getElementById('managementStagePanels').innerHTML = pathwayStages.map(stage => {
      const stageOptions = managementOptions.filter(item => item.stage_key === stage.key);
      const assigned = stageOptions.filter(item => item.assigned);
      const available = stageOptions.filter(item => !item.assigned);
      return `<div class="cmcManagementStagePane" data-management-stage-panel="${stage.key}">
        <div class="cmcAssignmentManagerColumns">
          <section>
            <div class="cmcAssignmentManagerHeading">
              <p class="cmcEyebrow">ASSIGNED WORK</p>
              <h3>Assigned</h3>
            </div>
            <div class="cmcInlineAssignmentList">
              ${assigned.length
                ? assigned.map(assignmentOption).join('')
                : '<p class="cmcDetailEmpty">Nothing has been assigned in this stage yet.</p>'}
            </div>
          </section>
          <section>
            <div class="cmcAssignmentManagerHeading">
              <p class="cmcEyebrow">AVAILABLE WORK</p>
              <h3>Available</h3>
            </div>
            <div class="cmcInlineAssignmentList">
              ${available.length
                ? available.map(assignmentOption).join('')
                : '<p class="cmcDetailEmpty">No additional work is available in this stage.</p>'}
            </div>
          </section>
        </div>
      </div>`;
    }).join('');
  }

  function activateManagementStage(stageKey) {
    const stage = pathwayStages.find(item => item.key === stageKey) || pathwayStages[0];
    activeManagementStage = stage.key;
    renderManagementStageTabs();
    document.querySelectorAll('[data-management-stage-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.managementStagePanel === stage.key);
    });
  }

  async function setCurrentStage(stageKey) {
    const button = document.querySelector(`[data-set-current-stage="${stageKey}"]`);
    const message = document.getElementById('participantManagementMessage');
    const stage = pathwayStages.find(item => item.key === stageKey);
    if (!stage || !button) return;
    button.disabled = true;
    message.textContent = `Updating current stage to ${stage.title}…`;
    message.classList.remove('error');
    try {
      const response = await fetch('/.netlify/functions/participant-manage', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          action:'update_stage',
          participant_id:participantId,
          current_stage:stage.key
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not update the pathway stage.');
      }
      participant.current_stage = stage.key;
      participant.stage_updated_at = data.participant?.stage_updated_at || new Date().toISOString();
      setText('participantStagePill', stage.title);
      setText('currentStageStat', stage.title);
      setText('currentStageCaption', stageCaption(stage.key));
      activateManagementStage(stage.key);
      message.textContent = `${stage.title} is now the participant’s current stage.`;
    } catch (error) {
      message.textContent = error.message || 'Could not update the pathway stage.';
      message.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }

  function assignmentOption(item) {
    const inputName = item.kind === 'course'
      ? 'managed_course'
      : item.kind === 'event'
        ? 'managed_event'
        : 'managed_pathway_item';
    const value = ['course', 'event'].includes(item.kind) ? item.id : item.key;
    const status = item.automatic
      ? 'Always available'
      : item.completed
        ? 'Completed'
        : item.assigned
          ? item.progress
            ? `${Number(item.progress)}% complete`
            : 'Assigned'
          : `${titleCase(item.stage_key)} stage`;
    return `<label class="cmcAssignmentOption">
      <input type="checkbox" name="${inputName}" value="${escapeHtml(value)}"${item.assigned ? ' checked' : ''}${item.automatic ? ' disabled' : ''}>
      <span class="cmcAssignmentOptionCheck">✓</span>
      <span class="cmcAssignmentOptionCopy">
        <small>${escapeHtml(titleCase(item.stage_key))} · ${escapeHtml(item.kind === 'course' ? 'Course' : item.kind === 'event' ? 'Event' : titleCase(item.type))}</small>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.description || '')}</p>
        <em>${escapeHtml(status)}</em>
      </span>
    </label>`;
  }

  function saveManagement() {
    const { itemKeys, courseIds, eventIds } = managementSelections();
    const changes = buildManagementChanges(itemKeys, courseIds, eventIds);
    if (!changes.added.length && !changes.removed.length) {
      const message = document.getElementById('participantManagementMessage');
      message.textContent = 'There are no assignment changes to save.';
      message.classList.remove('error');
      return;
    }
    pendingManagementChange = { itemKeys, courseIds, eventIds, ...changes };
    const list = document.getElementById('assignmentReviewList');
    list.innerHTML = [
      ...changes.added.map(item => reviewRow(item, 'add')),
      ...changes.removed.map(item => reviewRow(item, 'remove'))
    ].join('');
    const notifyChoice = document.getElementById('assignmentNotifyChoice');
    const notifyCheckbox = document.getElementById('notifyParticipant');
    notifyCheckbox.checked = changes.added.length > 0;
    notifyCheckbox.disabled = !changes.added.length || !participant.email;
    notifyChoice.classList.toggle('disabled', notifyCheckbox.disabled);
    document.getElementById('confirmParticipantChanges').textContent = changes.added.length
      ? 'Assign and notify'
      : 'Save changes';
    document.getElementById('assignmentReviewMessage').textContent = '';
    document.getElementById('assignmentReviewDialog').showModal();
  }

  async function confirmManagement() {
    if (!pendingManagementChange) return;
    const { itemKeys, courseIds, eventIds, added } = pendingManagementChange;
    const button = document.getElementById('confirmParticipantChanges');
    const message = document.getElementById('assignmentReviewMessage');
    button.disabled = true;
    message.textContent = 'Saving assignments…';
    message.classList.remove('error');
    try {
      const [itemResponse, courseResponse, eventResponse] = await Promise.all([
        fetch('/.netlify/functions/participant-manage', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({
            action:'update_assignments',
            participant_id:participantId,
            item_keys:itemKeys
          })
        }),
        fetch('/.netlify/functions/leader-course-assignments', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({ participant_id:participantId, course_ids:courseIds })
        }),
        fetch('/.netlify/functions/events-admin', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({
            action:'set_participant_invitations',
            participant_id:participantId,
            event_ids:eventIds,
            notify:false
          })
        })
      ]);
      const itemData = await itemResponse.json().catch(() => ({}));
      const courseData = await courseResponse.json().catch(() => ({}));
      const eventData = await eventResponse.json().catch(() => ({}));
      if (!itemResponse.ok || !itemData.ok) throw new Error(itemData.error || 'Could not save forms and assessments.');
      if (!courseResponse.ok || !courseData.ok) throw new Error(courseData.error || 'Could not save courses.');
      if (!eventResponse.ok || !eventData.ok) throw new Error(eventData.error || 'Could not save event invitations.');

      const shouldNotify = document.getElementById('notifyParticipant').checked && added.length;
      if (shouldNotify) {
        message.textContent = 'Assignments saved. Sending one summary email…';
        const notificationResponse = await fetch('/.netlify/functions/assignment-notification', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({
            participant_id:participantId,
            items:added.map(notificationItem)
          })
        });
        const notificationData = await notificationResponse.json().catch(() => ({}));
        if (!notificationResponse.ok || !notificationData.ok) {
          throw new Error(notificationData.error || 'Assignments were saved, but the email could not be sent.');
        }
        if (!notificationData.sent) {
          message.textContent = `Assignments saved. ${notificationData.reason || 'Email was not sent.'}`;
          message.classList.add('warning');
          window.setTimeout(() => window.location.reload(), 1400);
          return;
        }
      }
      message.textContent = shouldNotify
        ? 'Assignments saved and one summary email was sent.'
        : 'Assignments saved.';
      pendingManagementChange = null;
      managementDirty = false;
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      message.textContent = error.message || 'Could not save the pathway.';
      message.classList.add('error');
      button.disabled = false;
    }
  }

  function buildManagementChanges(itemKeys, courseIds, eventIds) {
    const desired = {
      pathway:new Set(itemKeys),
      course:new Set(courseIds),
      event:new Set(eventIds)
    };
    const initial = {
      pathway:initialPathwayKeys,
      course:initialCourseIds,
      event:initialEventIds
    };
    const added = managementOptions.filter(item => {
      const type = item.kind === 'course' ? 'course' : item.kind === 'event' ? 'event' : 'pathway';
      const key = item.kind === 'pathway' ? item.key : item.id;
      return !item.automatic && desired[type].has(key) && !initial[type].has(key);
    });
    const removed = managementOptions.filter(item => {
      const type = item.kind === 'course' ? 'course' : item.kind === 'event' ? 'event' : 'pathway';
      const key = item.kind === 'pathway' ? item.key : item.id;
      return !item.automatic && initial[type].has(key) && !desired[type].has(key);
    });
    return { added, removed };
  }

  function reviewRow(item, action) {
    const type = item.kind === 'event' ? 'Event' : item.kind === 'course' ? 'Course' : titleCase(item.type || 'Assignment');
    return `<article class="cmcReviewItem ${action}">
      <span>${action === 'add' ? '+' : '−'}</span>
      <div><small>${escapeHtml(action === 'add' ? 'Add' : 'Remove')} · ${escapeHtml(type)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description || '')}</p></div>
    </article>`;
  }

  function notificationItem(item) {
    return {
      key:item.kind === 'event' ? `event:${item.id}` : item.kind === 'course' ? `course:${item.id}` : item.key,
      source:item.kind === 'event' ? 'event' : item.kind,
      type:item.kind === 'event' ? 'Event invitation' : item.kind === 'course' ? 'Course' : titleCase(item.type || 'Assignment'),
      title:item.title,
      stage:titleCase(item.stage_key),
      detail:item.description || ''
    };
  }

  function renderRecords(reports, application, reflections = []) {
    const records = [];
    if (application) {
      records.push({
        title:'Discernment Application',
        type:'Application',
        status:application.status === 'submitted'
          ? 'Submitted'
          : `${Number(application.completion || 0)}% complete`,
        date:application.submitted_at || application.updated_at,
        complete:application.status === 'submitted',
        href:recordUrl('application')
      });
    }
    for (const report of reports) {
      records.push({
        title:report.title,
        type:'Assessment',
        status:report.overall_label || (report.overall != null ? `Overall: ${report.overall}` : 'Completed'),
        date:report.created_at,
        complete:true,
        href:recordUrl('assessment', report.id)
      });
    }
    for (const reflection of reflections) {
      records.push({
        title:reflection.lesson_title,
        type:'Course reflection',
        status:reflection.course_title,
        date:reflection.updated_at,
        complete:true,
        href:recordUrl('course_reflection', reflection.id)
      });
    }

    document.getElementById('participantRecordList').innerHTML = records.length
      ? records.map(record => `<article>
          <span class="cmcRecordIcon ${record.complete ? 'complete' : ''}">${record.complete ? '✓' : '•'}</span>
          <div>
            <small>${escapeHtml(record.type)}</small>
            <strong>${escapeHtml(record.title)}</strong>
            <p>${escapeHtml(record.status)} · ${escapeHtml(formatDate(record.date))}</p>
          </div>
          <a class="cmcRecordAction" href="${record.href}">Open →</a>
        </article>`).join('')
      : '<p class="cmcDetailEmpty">No applications, reports, or course reflections have been recorded.</p>';
  }

  function renderEventHistory(events) {
    const container = document.getElementById('participantEventHistory');
    if (!events.length) {
      container.innerHTML = '<p class="cmcDetailEmpty">This participant has not been invited to an event.</p>';
      return;
    }
    const now = Date.now();
    const rows = [...events].sort((a, b) => (
      new Date(b.event?.starts_at || 0) - new Date(a.event?.starts_at || 0)
    ));
    container.innerHTML = rows.map(invitation => {
      const event = invitation.event || {};
      const ended = new Date(event.ends_at || event.starts_at).getTime() < now;
      const rsvp = {
        pending:'No response',
        going:'Going',
        declined:'Can’t attend'
      }[invitation.rsvp_status] || titleCase(invitation.rsvp_status);
      return `<article class="cmcParticipantEventRow${ended ? ' past' : ''}">
        <span class="cmcParticipantEventDate"><small>${escapeHtml(formatMonth(event.starts_at))}</small><strong>${escapeHtml(formatDay(event.starts_at))}</strong></span>
        <div class="cmcParticipantEventCopy">
          <small>${ended ? 'Past event' : 'Upcoming event'} · ${escapeHtml(titleCase(event.stage_key || 'discern'))}</small>
          <h3>${escapeHtml(event.title || 'CMC Event')}</h3>
          <p>${escapeHtml(formatEventDateTime(event.starts_at))}${event.location_name ? ` · ${escapeHtml(event.location_name)}` : ''}</p>
          <span>RSVP: <strong>${escapeHtml(rsvp)}</strong></span>
        </div>
        <label class="cmcAttendanceControl">
          <span>Attendance</span>
          <select data-attendance-id="${escapeHtml(invitation.id)}">
            <option value="pending"${invitation.attendance_status === 'pending' ? ' selected' : ''}>Not recorded</option>
            <option value="attended"${invitation.attendance_status === 'attended' ? ' selected' : ''}>Attended</option>
            <option value="did_not_attend"${invitation.attendance_status === 'did_not_attend' ? ' selected' : ''}>Did not attend</option>
            <option value="excused"${invitation.attendance_status === 'excused' ? ' selected' : ''}>Excused</option>
          </select>
        </label>
      </article>`;
    }).join('');
    container.querySelectorAll('[data-attendance-id]').forEach(select => {
      select.addEventListener('change', () => saveAttendance(select));
    });
  }

  async function saveAttendance(select) {
    const current = select.value;
    select.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/events-admin', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          action:'update_attendance',
          invitation_id:select.dataset.attendanceId,
          attendance_status:current
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save attendance.');
      const invitation = participantEvents.find(item => item.id === select.dataset.attendanceId);
      if (invitation) invitation.attendance_status = current;
    } catch (error) {
      window.alert(error.message || 'Could not save attendance.');
      window.location.reload();
    } finally {
      select.disabled = false;
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    const message = document.getElementById('participantProfileMessage');
    const values = Object.fromEntries(new FormData(profileForm).entries());
    delete values.email;
    button.disabled = true;
    message.textContent = 'Saving changes…';
    message.classList.remove('error');
    try {
      const response = await fetch('/.netlify/functions/participant-manage', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          action:'update_profile',
          participant_id:participantId,
          profile:values
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save profile changes.');
      participant = { ...participant, ...data.participant };
      renderProfile(participant);
      setText('participantName', participant.full_name || participant.email || 'Participant');
      setText('participantAvatar', initials(participant.full_name));
      setText(
        'participantContext',
        [participant.ministry_role, participant.church_name, participant.region ? `Open Bible ${participant.region} Region` : '']
          .filter(Boolean)
          .join(' · ')
      );
      closeProfileForm();
    } catch (error) {
      message.textContent = error.message || 'Could not save profile changes.';
      message.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }

  function fillProfileForm(person) {
    for (const [key, value] of Object.entries(person || {})) {
      if (profileForm.elements[key]) profileForm.elements[key].value = value || '';
    }
  }

  function closeProfileForm() {
    profileForm.classList.add('hidden');
    document.getElementById('participantProfileDetails').classList.remove('hidden');
    document.getElementById('editParticipantButton').classList.remove('hidden');
    document.getElementById('participantProfileMessage').textContent = '';
  }

  function setupTabs() {
    const buttons = [...document.querySelectorAll('[data-participant-tab]')];
    const panels = [...document.querySelectorAll('[data-participant-panel]')];
    const requested = window.location.hash.replace('#', '');
    activateTab(['overview', 'work', 'events', 'records'].includes(requested) ? requested : 'overview', false);
    buttons.forEach(button => button.addEventListener('click', () => {
      requestTab(button.dataset.participantTab);
    }));
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-open-participant-tab]');
      if (!trigger) return;
      event.preventDefault();
      requestTab(trigger.dataset.openParticipantTab);
      document.querySelector('.cmcParticipantTabs')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });

    function requestTab(key) {
      const workActive = document.querySelector('[data-participant-tab="work"]')?.classList.contains('active');
      if (workActive && key !== 'work' && managementDirty) {
        saveManagement();
        document.getElementById('participantManagementMessage').textContent = 'Review and save these assignment changes before leaving Assignments.';
        return;
      }
      activateTab(key, true);
    }

    function activateTab(key, updateHash) {
      buttons.forEach(button => {
        const active = button.dataset.participantTab === key;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(panel => panel.classList.toggle('active', panel.dataset.participantPanel === key));
      if (updateHash) history.replaceState(null, '', `#${key}`);
    }
  }

  function managementSelections() {
    return {
      itemKeys:[...document.querySelectorAll('input[name="managed_pathway_item"]:checked')].map(input => input.value),
      courseIds:[...document.querySelectorAll('input[name="managed_course"]:checked')].map(input => input.value),
      eventIds:[...document.querySelectorAll('input[name="managed_event"]:checked')].map(input => input.value)
    };
  }

  function updateManagementDirtyState() {
    const { itemKeys, courseIds, eventIds } = managementSelections();
    const changes = buildManagementChanges(itemKeys, courseIds, eventIds);
    const count = changes.added.length + changes.removed.length;
    managementDirty = count > 0;
    const button = document.getElementById('saveParticipantManagement');
    if (!button) return;
    button.classList.toggle('hasChanges', managementDirty);
    button.textContent = managementDirty ? `Review ${count} change${count === 1 ? '' : 's'}` : 'Review changes';
  }

  function recordUrl(type, recordId) {
    const params = new URLSearchParams({ participant:participantId, type });
    if (recordId) params.set('record', recordId);
    return `participant-record.html?${params.toString()}`;
  }

  function inferredStage(items) {
    if (items.some(item => item.stage_key === 'deploy')) return 'deploy';
    if (items.some(item => item.stage_key === 'develop')) return 'develop';
    if (items.some(item => item.stage_key === 'discern')) return 'discern';
    return 'discover';
  }

  function stageCaption(stage) {
    return {
      discover:'Building a shared foundation',
      discern:'Clarifying calling and readiness',
      develop:'Preparing for healthy ministry',
      deploy:'Moving into mission'
    }[stage] || 'Beginning the pathway';
  }

  function latestActivity(person, assignments, reports, application) {
    const dates = [
      person.updated_at,
      person.created_at,
      application?.updated_at,
      application?.submitted_at,
      ...assignments.map(item => item.updated_at || item.completed_at || item.assigned_at),
      ...reports.map(item => item.created_at)
    ].filter(Boolean).map(value => new Date(value)).filter(date => !Number.isNaN(date.getTime()));
    return dates.sort((a,b) => b - a)[0] || null;
  }

  function applicationProgress(item, application) {
    return item.item_key === 'discernment_application' ? Number(application?.completion || 0) : 0;
  }

  function assessmentKey(type) {
    if (type === 'isa_readiness') return 'ministry_readiness';
    if (type === 'ministry_style') return 'ministry_style';
    return 'character_qualities';
  }

  function itemLabel(key) {
    return {
      discover_course:'Discover: Church Multiplication 101',
      discernment_application:'Discernment Application',
      ministry_readiness:'Ministry Readiness Inventory',
      ministry_style:'Ministry Style Inventory',
      character_qualities:'Character Qualities Assessment',
      pastoral_reference:'Pastoral Reference Form'
    }[key] || titleCase(key);
  }

  function itemDescription(key) {
    return {
      discover_course:'A biblical introduction to church multiplication.',
      discernment_application:'Their story, calling, and ministry context.',
      ministry_readiness:'A reflection on current ministry readiness.',
      ministry_style:'An inventory of leadership and ministry patterns.',
      character_qualities:'Character qualities that support healthy ministry.',
      pastoral_reference:'Feedback from a pastor or ministry leader.'
    }[key] || 'Pathway assignment';
  }

  function stageOrder(stage) {
    return {discover:1, discern:2, develop:3, deploy:4}[stage] || 9;
  }

  function stateName(code) {
    return dcAuth.STATES?.[code] || code || '';
  }

  function formatDate(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' });
  }

  function formatShortDate(value) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString([], { month:'short', day:'numeric' });
  }

  function formatEventDateTime(value) {
    if (!value) return 'Date to be announced';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date to be announced';
    return date.toLocaleString([], {
      weekday:'short',
      month:'short',
      day:'numeric',
      year:'numeric',
      hour:'numeric',
      minute:'2-digit'
    });
  }

  function formatMonth(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleDateString([], { month:'short' }).toUpperCase();
  }

  function formatDay(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString([], { day:'numeric' });
  }

  function initials(value) {
    return String(value || '?').trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  }

  function titleCase(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function showError(message) {
    loading.innerHTML = `<div class="cmcParticipantDetailError">
      <strong>Unable to open this participant.</strong>
      <p>${escapeHtml(message)}</p>
      <a href="leader.html">Return to People →</a>
    </div>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    })[character]);
  }
})();
