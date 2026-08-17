(async function(){
  const DISCOVER_COURSE_URL = 'course.html?slug=discover';
  const STAGES = [
    {number:'01',key:'discover',title:'Discover',summary:'Shared foundation'},
    {number:'02',key:'discern',title:'Discern',summary:'Calling and readiness'},
    {number:'03',key:'develop',title:'Develop',summary:'Preparation and formation'},
    {number:'04',key:'deploy',title:'Deploy',summary:'Movement into mission'}
  ];
  const ASSIGNMENT_INFO = {
    discernment_application:['Discernment Application','application.html','Clarify your story and sense of calling.'],
    ministry_readiness:['Ministry Readiness Inventory','isa-assessment.html','Reflect on your current readiness for ministry.'],
    ministry_style:['Ministry Style Inventory','ministry-style.html','Understand the ways you tend to lead and serve.'],
    character_qualities:['Character Qualities Assessment','assessment.html','Review the character qualities that support healthy ministry.'],
    pastoral_reference:['Pastoral Reference Form','pastoral-reference-request.html','Invite a pastor or ministry leader to provide a confidential reference.']
  };
  let activeWorkStage = 'discover';
  const localPreview = ['127.0.0.1','localhost'].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get('preview') === '1';

  if (localPreview) {
    renderLocalPreview();
    return;
  }

  dcAuth.setupLogout();
  const session = await dcAuth.getCurrentSession().catch(() => null);
  if (!session?.user) {
    window.location.href = 'login.html';
    return;
  }
  const user = session.user;
  const accessToken = session.access_token || '';
  const dashboardPayload = await getDashboardPayload(accessToken);
  const legacyPayload = dashboardPayload ? null : await getLegacyDashboardPayload(user, accessToken);
  const profile = dashboardPayload?.profile || legacyPayload?.profile || null;
  const assignments = dashboardPayload?.assignments || legacyPayload?.assignments || [];
  const reports = dashboardPayload?.reports || legacyPayload?.reports || [];
  const isLeader = ['regional_leader','cmc_admin'].includes(profile?.account_role);
  const participantView = new URLSearchParams(window.location.search).get('view') === 'participant';
  if (isLeader && !participantView) {
    window.location.replace('leader.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'pathway');
  const profileComplete = Boolean(profile?.full_name && profile?.phone && profile?.state);
  if (!profileComplete) {
    window.location.href = 'profile.html?next=dashboard';
    return;
  }

  setText('welcomeTitle', `Welcome${profile.full_name ? `, ${firstName(profile.full_name)}.` : '.'}`);
  const region = profile.region || dcAuth.regionForState(profile.state);
  setText('regionName', `Open Bible ${region} Region`);
  setText('heroRegionName', `Open Bible ${region} Region`);
  setText('regionInitial', region ? region.slice(0, 1).toUpperCase() : '—');
  const currentStage = STAGES.some(stage => stage.key === profile.current_stage)
    ? profile.current_stage
    : 'discover';
  setText('currentStageName', titleCase(currentStage));

  const completedKeys = new Set();
  for (const report of reports || []) {
    const type = report.scores?.assessmentType || '';
    if (type === 'isa_readiness') completedKeys.add('ministry_readiness');
    else if (type === 'ministry_style') completedKeys.add('ministry_style');
    else completedKeys.add('character_qualities');
  }

  const workItems = assignments
    .map(item => ({
      item,
      details:assignmentDetails(item),
      done:assignmentDone(item, completedKeys)
    }))
    .sort((a,b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const priorityDifference = priorityRank(a.item) - priorityRank(b.item);
      if (priorityDifference) return priorityDifference;
      const stageDifference = stageOrder(a.item.stage_key) - stageOrder(b.item.stage_key);
      if (stageDifference) return stageDifference;
      return String(a.details[0]).localeCompare(String(b.details[0]));
    });

  const nextWork = findNextWork(workItems, currentStage);
  renderNextStep(nextWork);
  renderStageWorkspace(workItems, currentStage, nextWork?.item.stage_key || currentStage);
  renderEventSummary(workItems);

  async function getDashboardPayload(token) {
    if (!token) return null;
    try {
      const response = await fetch('/.netlify/functions/participant-dashboard', {
        headers: { Authorization:`Bearer ${token}` }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.ok ? data : null;
    } catch (_) {
      return null;
    }
  }

  async function getLegacyDashboardPayload(account, token) {
    const profilePromise = dcAuth.getProfile(account.id).catch(() => null);
    const sb = await dcAuth.getSupabaseClient();
    const reportsPromise = sb
      .from('assessment_results')
      .select('id,created_at,scores,overall,overall_label')
      .eq('user_id', account.id)
      .order('created_at', { ascending:false });
    await ensureDiscoverAssignment(token);
    const [profile, assignments, reportResult] = await Promise.all([
      profilePromise,
      getAssignments(token),
      reportsPromise
    ]);
    return { profile, assignments, reports:reportResult.data || [] };
  }

  async function ensureDiscoverAssignment(token) {
    if (!token) return;
    try {
      await fetch('/.netlify/functions/candidate-default-assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_) {}
  }

  async function getAssignments(token) {
    if (!token) return [];
    try {
      const response = await fetch('/.netlify/functions/candidate-assignments-get', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return data.ok && Array.isArray(data.assignments) ? data.assignments : [];
    } catch (_) {
      return [];
    }
  }

  function renderNextStep(work) {
    const container = document.getElementById('nextStep');
    if (!work) {
      container.classList.add('complete');
      container.innerHTML = `
        <div class="cmcNextStepCopy">
          <p class="cmcEyebrow">UP TO DATE</p>
          <h2>You have no unfinished work.</h2>
          <p>Your completed work remains available below. Your CMC leader can add another course, assessment, or form when you are ready.</p>
        </div>
        <div class="cmcNextStepState"><span aria-hidden="true">✓</span><strong>All assigned work complete</strong></div>`;
      return;
    }

    const progress = normalizedProgress(work.item);
    const stageName = titleCase(work.item.stage_key || 'discover');
    const isCourse = Boolean(work.item.course) || work.item.item_key === 'discover_course';
    const isEvent = work.item.item_type === 'event';
    const actionText = isEvent
      ? 'Respond to invitation'
      : `${progress > 0 ? 'Continue' : 'Begin'} ${isCourse ? 'course' : 'assignment'}`;
    container.innerHTML = `
      <div class="cmcNextStepCopy">
        <p class="cmcEyebrow">UP NEXT · ${escapeHtml(stageName)}</p>
        <h2>${escapeHtml(work.details[0])}</h2>
        <p>${escapeHtml(work.details[2])}</p>
        <div class="cmcNextStepProgress" aria-label="${progress}% complete">
          <div><i style="width:${progress}%"></i></div>
          <span>${progress ? `${progress}% complete` : 'Not started'}</span>
        </div>
      </div>
      <div class="cmcNextStepAction">
        <small>NEXT ACTION</small>
        <a href="${work.details[1]}">${actionText} <span aria-hidden="true">→</span></a>
      </div>`;
  }

  function renderStageWorkspace(workItems, currentStage, initialStage) {
    activeWorkStage = STAGES.some(stage => stage.key === initialStage) ? initialStage : currentStage;
    renderStageTabs(workItems, currentStage);
    renderStagePanel(workItems);
  }

  function renderStageTabs(workItems, currentStage) {
    const tabList = document.getElementById('pathwayStageTabs');
    tabList.innerHTML = STAGES.map(stage => {
      const stageItems = workItems.filter(work => (work.item.stage_key || 'discover') === stage.key);
      const toDo = stageItems.filter(work => !work.done).length;
      const complete = stageItems.filter(work => work.done).length;
      const selected = stage.key === activeWorkStage;
      const current = stage.key === currentStage;
      return `<button class="cmcPathwayWorkTab${selected ? ' active' : ''}${current ? ' current' : ''}" type="button"
          role="tab" aria-selected="${selected ? 'true' : 'false'}" data-work-stage="${stage.key}">
        <span>${stage.number}</span>
        <strong>${stage.title}</strong>
        <small>${toDo ? `${toDo} to do` : 'No active work'}${complete ? ` · ${complete} complete` : ''}</small>
        ${current ? '<em>Current stage</em>' : ''}
      </button>`;
    }).join('');

    tabList.querySelectorAll('[data-work-stage]').forEach(button => {
      button.addEventListener('click', () => {
        activeWorkStage = button.dataset.workStage;
        renderStageTabs(workItems, currentStage);
        renderStagePanel(workItems);
      });
    });
  }

  function renderStagePanel(workItems) {
    const stage = STAGES.find(item => item.key === activeWorkStage) || STAGES[0];
    const stageItems = workItems.filter(work => (work.item.stage_key || 'discover') === stage.key);
    const toDo = stageItems.filter(work => !work.done);
    const complete = stageItems.filter(work => work.done);
    const panel = document.getElementById('pathwayStagePanel');
    panel.setAttribute('aria-label', `${stage.title} work`);
    panel.innerHTML = `
      <div class="cmcStageWorkHeading">
        <div><p class="cmcEyebrow">${stage.number} · ${stage.title.toUpperCase()}</p><h3>${escapeHtml(stage.summary)}</h3></div>
        <span>${toDo.length} to do · ${complete.length} complete</span>
      </div>
      <section class="cmcStageWorkGroup">
        <div class="cmcStageWorkGroupTitle"><h4>To do</h4><span>${toDo.length}</span></div>
        <div class="cmcStageWorkList">${toDo.length
          ? toDo.map(workCard).join('')
          : '<div class="cmcStageWorkEmpty"><strong>Nothing needs attention in this stage.</strong></div>'}</div>
      </section>
      <section class="cmcStageWorkGroup complete">
        <div class="cmcStageWorkGroupTitle"><h4>Completed</h4><span>${complete.length}</span></div>
        <div class="cmcStageWorkList">${complete.length
          ? complete.map(workCard).join('')
          : '<div class="cmcStageWorkEmpty"><strong>No completed work in this stage yet.</strong></div>'}</div>
      </section>`;
    attachEventControls(workItems);
  }

  function workCard(work) {
    const progress = normalizedProgress(work.item);
    const priority = Number.isFinite(Number(work.item.priority_rank)) && Number(work.item.priority_rank) > 0
      ? Number(work.item.priority_rank)
      : null;
    const eventResponse = work.item.rsvp_status
      ? rsvpLabel(work.item.rsvp_status)
      : '';
    const type = work.item.item_type === 'event'
      ? 'Event'
      : work.item.item_type === 'task_plan'
        ? 'Task plan'
      : work.item.course || work.item.item_type === 'course'
        ? 'Course'
        : titleCase(work.item.item_type || 'assignment');
    const status = work.done
      ? eventResponse || 'Complete'
      : progress
        ? `${progress}% complete`
        : work.item.rsvp_status === 'pending'
          ? 'Response needed'
          : 'Assigned';
    const isEvent = work.item.item_type === 'event';
    const eventDate = isEvent ? formatEventDate(work.item.event?.starts_at) : null;
    const icon = isEvent
      ? `<span class="cmcStageWorkIcon cmcEventWorkDate" aria-hidden="true"><small>${escapeHtml(eventDate.month)}</small><b>${escapeHtml(eventDate.day)}</b></span>`
      : `<span class="cmcStageWorkIcon" aria-hidden="true">${work.done ? '✓' : '•'}</span>`;
    const action = isEvent
      ? `<div class="cmcEventWorkActions">
          <button class="cmcEventDetails" type="button" data-event-details-toggle aria-expanded="false">View details</button>
          ${work.item.rsvp_status === 'pending'
            ? '<div class="cmcEventResponseActions"><button type="button" data-event-rsvp="going">Going</button><button class="cmcDeclineEvent" type="button" data-event-rsvp="declined"><span aria-hidden="true">×</span> Can’t attend</button></div>'
            : ''}
        </div>`
      : `<a href="${work.details[1]}">${work.done ? 'Review' : progress ? 'Continue' : 'Begin'} <span aria-hidden="true">→</span></a>`;
    const eventDetails = isEvent ? inlineEventDetails(work.item.event) : '';
    return `<article class="cmcStageWorkCard${work.done ? ' complete' : ''}" data-work-item="${escapeHtml(work.item.item_key)}">
      ${icon}
      <div class="cmcStageWorkCopy">
        <div class="cmcStageWorkMeta"><span>${escapeHtml(type)}</span>${priority && !work.done ? `<b>Priority ${priority}</b>` : ''}</div>
        <h5>${escapeHtml(work.details[0])}</h5>
        <p>${work.done ? eventResponse || 'Completed and available for review.' : escapeHtml(work.details[2])}</p>
        ${progress > 0 && !work.done ? `<div class="cmcAssignmentProgress"><i style="width:${progress}%"></i></div>` : ''}
      </div>
      <span class="cmcWorkStatus ${work.done ? 'done' : ''}">${escapeHtml(status)}</span>
      ${action}
      ${eventDetails}
    </article>`;
  }

  function renderEventSummary(workItems) {
    const events = workItems.filter(work => (
      work.item.item_type === 'event'
      && work.item.event
      && work.item.rsvp_status !== 'declined'
      && new Date(work.item.event.ends_at || work.item.event.starts_at).getTime() >= Date.now()
    )).sort((a, b) => (
      new Date(a.item.event.starts_at).getTime() - new Date(b.item.event.starts_at).getTime()
    ));
    const pending = events.filter(work => !work.item.rsvp_status || work.item.rsvp_status === 'pending').length;
    const summary = document.querySelector('.cmcDashboardEventSummary');
    const dates = document.getElementById('eventSummaryDates');
    setText('eventSummaryCount', `${events.length} upcoming`);
    if (dates) {
      const visibleDates = events.slice(0, 3).map(work => {
        const date = formatEventDate(work.item.event.starts_at);
        const needsResponse = !work.item.rsvp_status || work.item.rsvp_status === 'pending';
        return `<span class="cmcDashboardEventRow" aria-label="${escapeHtml(`${date.month} ${date.day}, ${work.item.event.title}`)}">
          <span class="cmcDashboardEventDate"><b>${escapeHtml(date.month)}</b>${escapeHtml(date.day)}</span>
          <span class="cmcDashboardEventName">
            <strong>${escapeHtml(work.item.event.title)}</strong>
            ${needsResponse ? '<small>Response needed</small>' : ''}
          </span>
        </span>`;
      });
      if (events.length > 3) visibleDates.push(`<span class="cmcDashboardMoreEvents" aria-label="${events.length - 3} more events">+${events.length - 3} more</span>`);
      dates.innerHTML = visibleDates.join('');
    }
    setText('eventSummaryDetail', pending
      ? `${pending} response${pending === 1 ? '' : 's'} needed`
      : events.length
        ? 'All responses complete'
        : 'No invitations awaiting you');
    summary?.classList.toggle('attention', pending > 0);
  }

  function inlineEventDetails(event) {
    if (!event) return '';
    const date = formatEventDate(event.starts_at);
    return `<div class="cmcEventInlineDetails" data-event-details hidden>
      <div><span>When</span><strong>${escapeHtml(date.time)}</strong></div>
      <div><span>Where</span><strong>${escapeHtml(event.location_name || 'Location to be announced')}</strong></div>
      ${event.address ? `<div><span>Address</span><strong>${escapeHtml(event.address)}</strong></div>` : ''}
      ${event.rsvp_deadline ? `<div><span>Respond by</span><strong>${escapeHtml(formatEventDate(event.rsvp_deadline).time)}</strong></div>` : ''}
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}
    </div>`;
  }

  function assignmentDetails(item) {
    if (item.item_type === 'task_plan' && item.task_plan) {
      const next = item.task_plan.next_task;
      return [
        item.task_plan.title || 'Task plan',
        `task-plan.html?id=${encodeURIComponent(item.task_plan.id)}`,
        next ? `Next: ${next.title}` : 'Review the completed plan and its timeline.'
      ];
    }
    if (item.item_type === 'event' && item.event) {
      return [
        item.event.title || 'CMC event',
        '#assigned-work',
        item.event.description || 'Review the event details and respond to the invitation.'
      ];
    }
    if (item.course) {
      return [
        item.course.title,
        `course.html?slug=${encodeURIComponent(item.course.slug)}`,
        item.course.subtitle || `${titleCase(item.course.stage_key || item.stage_key)} course`
      ];
    }
    if (item.item_key === 'discover_course') {
      return [
        'Discover: Church Multiplication 101',
        DISCOVER_COURSE_URL,
        'Learn the biblical foundation, shared language, and models of church multiplication.'
      ];
    }
    return ASSIGNMENT_INFO[item.item_key] || [titleCase(item.item_key), '#', 'Ready when you are.'];
  }

  function normalizedProgress(item) {
    if (item.item_type === 'event' && item.rsvp_status && item.rsvp_status !== 'pending') return 100;
    if (item.external_status === 'completed') return 100;
    return Math.max(0, Math.min(100, Math.round(Number(item.progress || 0))));
  }

  function findNextWork(workItems, currentStage) {
    const unfinished = workItems.filter(work => !work.done);
    const prioritized = unfinished
      .filter(work => priorityRank(work.item) < Number.MAX_SAFE_INTEGER)
      .sort((a,b) => priorityRank(a.item) - priorityRank(b.item));
    if (prioritized.length) return prioritized[0];
    return unfinished.find(work => (work.item.stage_key || 'discover') === currentStage) || unfinished[0] || null;
  }

  function priorityRank(item) {
    const rank = Number(item?.priority_rank);
    return Number.isFinite(rank) && rank > 0 ? rank : Number.MAX_SAFE_INTEGER;
  }

  function rsvpLabel(status) {
    return {
      pending:'Response needed',
      going:'Going',
      declined:'Declined',
      maybe:'Maybe'
    }[status] || titleCase(status || 'pending');
  }

  function formatEventDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {month:'TBD',day:'—',time:'Time to be announced'};
    return {
      month:new Intl.DateTimeFormat('en-US',{month:'short'}).format(date).toUpperCase(),
      day:new Intl.DateTimeFormat('en-US',{day:'numeric'}).format(date),
      time:new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date)
    };
  }

  function attachEventControls(workItems) {
    const panel = document.getElementById('pathwayStagePanel');
    panel.onclick = event => {
      if (!(event.target instanceof Element)) return;
      const detailsButton = event.target.closest('[data-event-details-toggle]');
      if (detailsButton) {
        const details = detailsButton.closest('.cmcStageWorkCard')?.querySelector('[data-event-details]');
        if (!details) return;
        const expanded = detailsButton.getAttribute('aria-expanded') === 'true';
        detailsButton.setAttribute('aria-expanded', String(!expanded));
        detailsButton.textContent = expanded ? 'View details' : 'Hide details';
        details.hidden = expanded;
        return;
      }

      const responseButton = event.target.closest('[data-event-rsvp]');
      if (!responseButton) return;
      const card = responseButton.closest('.cmcStageWorkCard');
      const itemKey = card?.dataset.workItem;
      const work = workItems.find(item => item.item.item_type === 'event' && item.item.item_key === itemKey);
      if (!work) return;
      const rsvpStatus = responseButton.dataset.eventRsvp;
      responseButton.disabled = true;
      if (localPreview) {
        applyRsvp(workItems, work, rsvpStatus);
        return;
      }
      fetch('/.netlify/functions/event-rsvp', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${accessToken}` },
        body:JSON.stringify({
          event_id:work.item.event.id,
          rsvp_status:rsvpStatus
        })
      }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save your response.');
        applyRsvp(workItems, work, data.invitation?.rsvp_status || rsvpStatus);
      }).catch(error => {
        responseButton.disabled = false;
        window.alert(error.message || 'Could not save your response.');
      });
    };
  }

  function applyRsvp(workItems, work, rsvpStatus) {
    work.item.rsvp_status = rsvpStatus;
    work.done = true;
    const currentStage = document.getElementById('currentStageName')?.textContent?.toLowerCase() || 'discover';
    const source = rsvpStatus === 'declined'
      ? workItems.filter(item => item !== work)
      : workItems;
    const nextWork = findNextWork(source, currentStage);
    renderNextStep(nextWork);
    renderStageWorkspace(source, currentStage, activeWorkStage);
    renderEventSummary(source);
  }


  function stageOrder(value) {
    const index = STAGES.findIndex(stage => stage.key === value);
    return index < 0 ? STAGES.length : index;
  }

  function renderLocalPreview() {
    const currentStage = 'discern';
    const workItems = [
      {
        item:{
          item_key:'discover_course',
          stage_key:'discover',
          progress:100,
          external_status:'completed',
          assignment_source:'automatic',
          course:{
            title:'Discover: Church Multiplication 101',
            slug:'discover',
            subtitle:'A biblical introduction to church multiplication',
            stage_key:'discover'
          }
        },
        details:['Discover: Church Multiplication 101',DISCOVER_COURSE_URL,'A biblical introduction to church multiplication.'],
        done:true
      },
      {
        item:{
          item_key:'ministry_readiness',
          stage_key:'discern',
          progress:0,
          priority_rank:1,
          assignment_source:'leader'
        },
        details:ASSIGNMENT_INFO.ministry_readiness,
        done:false
      },
      {
        item:{
          item_key:'event_discernment_gathering',
          item_type:'event',
          stage_key:'discern',
          progress:0,
          priority_rank:2,
          rsvp_status:'pending',
          assignment_source:'leader',
          event:{
            title:'CMC Discernment Gathering',
            description:'Meet regional leaders, ask questions, and learn what the discernment process includes.',
            starts_at:'2026-09-12T09:00:00-04:00',
            ends_at:'2026-09-12T15:00:00-04:00',
            location_name:'Open Bible East Regional Office'
          }
        },
        details:['CMC Discernment Gathering','#eventsSection','Meet regional leaders, ask questions, and learn what the discernment process includes.'],
        done:false
      },
      {
        item:{
          item_key:'discernment_application',
          stage_key:'discern',
          progress:35,
          priority_rank:3,
          assignment_source:'leader'
        },
        details:ASSIGNMENT_INFO.discernment_application,
        done:false
      },
      {
        item:{
          item_key:'character_qualities',
          stage_key:'discern',
          progress:100,
          external_status:'completed',
          assignment_source:'leader'
        },
        details:ASSIGNMENT_INFO.character_qualities,
        done:true
      },
      {
        item:{
          item_key:'event_pioneer_lunch',
          item_type:'event',
          stage_key:'discern',
          progress:100,
          rsvp_status:'going',
          assignment_source:'leader',
          event:{
            title:'Regional Pioneer Lunch',
            description:'A lunch for pioneers and regional CMC leaders.',
            starts_at:'2026-08-18T12:00:00-04:00',
            ends_at:'2026-08-18T13:30:00-04:00',
            location_name:'Riverview Open Bible'
          }
        },
        details:['Regional Pioneer Lunch','#eventsSection','A lunch for pioneers and regional CMC leaders.'],
        done:true
      },
      {
        item:{
          item_key:'multiplication_plan',
          item_type:'course',
          stage_key:'develop',
          progress:0,
          assignment_source:'leader',
          course:{
            title:'Building a Multiplication Plan',
            slug:'multiplication-plan',
            subtitle:'Turn calling and context into a practical ministry plan.',
            stage_key:'develop'
          }
        },
        details:['Building a Multiplication Plan','course.html?slug=multiplication-plan','Turn calling and context into a practical ministry plan.'],
        done:false
      }
    ];
    dcAuth.renderRoleNavigation({ account_role:'cmc_admin' }, 'pathway');
    setText('welcomeTitle','Welcome, George.');
    setText('currentStageName','Discern');
    setText('heroRegionName','Open Bible East Region');
    setText('regionName','Open Bible East Region');
    setText('regionInitial','E');
    const nextWork = findNextWork(workItems, currentStage);
    renderNextStep(nextWork);
    renderStageWorkspace(workItems, currentStage, nextWork?.item.stage_key || currentStage);
    renderEventSummary(workItems);
  }

  function assignmentDone(item, completed) {
    return completed.has(item.item_key)
      || Number(item.progress) >= 100
      || item.external_status === 'completed'
      || (item.item_type === 'event' && item.rsvp_status && item.rsvp_status !== 'pending');
  }
  function setText(id,value){ const el=document.getElementById(id); if(el) el.textContent=value; }
  function firstName(value){ return String(value || '').trim().split(/\s+/)[0] || ''; }
  function titleCase(value){ return String(value || '').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
  function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
})();
