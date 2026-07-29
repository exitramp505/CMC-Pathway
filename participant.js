(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const participantId = new URLSearchParams(window.location.search).get('id') || '';
  const loading = document.getElementById('participantDetailLoading');
  const content = document.getElementById('participantDetailContent');

  if (!participantId) {
    showError('No participant was selected.');
    return;
  }

  try {
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    const token = session.data?.session?.access_token || '';
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
  } catch (error) {
    showError(error.message || 'Could not load this participant.');
  }

  function render(data) {
    const person = data.participant || {};
    const assignments = data.assignments || [];
    const reports = data.reports || [];
    const application = data.application || null;
    const stage = currentStage(assignments);
    const completedCount = assignments.filter(item => item.completed).length;
    const latest = latestActivity(person, assignments, reports, application);

    document.title = `${person.full_name || 'Participant'} | CMC Pathway`;
    setText('participantAvatar', initials(person.full_name));
    setText('participantName', person.full_name || person.email || 'Participant');
    setText(
      'participantContext',
      [person.ministry_role, person.church_name, person.region ? `Open Bible ${person.region} Region` : '']
        .filter(Boolean)
        .join(' · ')
    );
    setText('participantStagePill', titleCase(stage));
    setText('currentStageStat', titleCase(stage));
    setText('currentStageCaption', stageCaption(stage));
    setText('assignedCountStat', assignments.length);
    setText('completedCountStat', completedCount);
    setText('completedCaption', completedCount === 1 ? 'Item finished' : 'Items finished');
    setText('latestActivityStat', formatShortDate(latest));

    const emailLink = document.getElementById('emailParticipantLink');
    emailLink.href = person.email ? `mailto:${encodeURIComponent(person.email)}` : '#';
    if (!person.email) emailLink.classList.add('hidden');
    document.getElementById('manageCoursesLink').href =
      `assign-courses.html?participant=${encodeURIComponent(person.id)}`;

    renderProfile(person);
    renderWork(assignments, reports, application);
    renderRecords(reports, application);
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

  function renderWork(assignments, reports, application) {
    const reportKeys = new Set(reports.map(report => assessmentKey(report.assessment_type)));
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
      const complete = item.completed
        || reportKeys.has(item.item_key)
        || (item.item_key === 'discernment_application' && application?.status === 'submitted');
      const progress = complete ? 100 : Math.max(0, Math.min(100, Number(item.progress || applicationProgress(item, application))));
      const status = complete ? 'Complete' : progress > 0 ? 'In progress' : item.assignment_source === 'automatic' ? 'Available' : 'Assigned';

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
        </div>
      </article>`;
    }).join('');
  }

  function renderRecords(reports, application) {
    const records = [];
    if (application) {
      records.push({
        title:'Discernment Application',
        status:application.status === 'submitted' ? 'Submitted' : `${Number(application.completion || 0)}% complete`,
        date:application.submitted_at || application.updated_at,
        complete:application.status === 'submitted'
      });
    }
    for (const report of reports) {
      records.push({
        title:report.title,
        status:report.overall_label || (report.overall != null ? `Overall: ${report.overall}` : 'Completed'),
        date:report.created_at,
        complete:true
      });
    }

    document.getElementById('participantRecordList').innerHTML = records.length
      ? records.map(record => `<article>
          <span class="cmcRecordIcon ${record.complete ? 'complete' : ''}">${record.complete ? '✓' : '•'}</span>
          <div>
            <strong>${escapeHtml(record.title)}</strong>
            <p>${escapeHtml(record.status)}</p>
            <small>${escapeHtml(formatDate(record.date))}</small>
          </div>
        </article>`).join('')
      : '<p class="cmcDetailEmpty">No applications or assessment reports have been recorded.</p>';
  }

  function currentStage(items) {
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
    return {discover:1,discern:2,develop:3,deploy:4}[stage] || 9;
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
  function initials(value) {
    return String(value || '?').trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  }
  function titleCase(value) {
    return String(value || '').replace(/_/g,' ').replace(/\b\w/g, character => character.toUpperCase());
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
