(async function taskPlanPage() {
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  dcAuth.renderRoleNavigation(profile, 'pathway');
  const sb = await dcAuth.getSupabaseClient();
  const token = (await sb.auth.getSession()).data?.session?.access_token || '';
  const params = new URLSearchParams(location.search);
  const planId = params.get('id');
  const participantId = params.get('participant_id');
  const leaderMode = Boolean(participantId && ['regional_leader', 'cmc_admin'].includes(profile?.account_role));
  const app = document.getElementById('taskPlanApp');
  const ui = window.cmcTaskPlanUI;
  if (!planId) { location.href = 'dashboard.html'; return; }

  let plan;
  let tasks = [];
  let sections = [];
  let templateDiff = null;
  let view = 'list';
  let selected = null;
  let selectedPhaseKey = '';
  let sidebarCollapsed = localStorage.getItem('cmcTaskPlanSidebarCollapsed') === 'true';
  if (window.matchMedia('(max-width: 720px)').matches && !localStorage.getItem('cmcTaskPlanSidebarCollapsed')) sidebarCollapsed = true;

  document.getElementById('completeTaskButton').addEventListener('click', saveSelectedTask);
  document.getElementById('saveCustomPlanTask').addEventListener('click', saveCustomTask);

  try {
    await loadPlan();
    chooseInitialPhase();
    render();
  } catch (error) {
    app.innerHTML = empty('Unable to open this task plan.', error.message);
  }

  async function loadPlan() {
    const query = leaderMode
      ? `?participant_id=${encodeURIComponent(participantId)}&plan_id=${encodeURIComponent(planId)}`
      : `?plan_id=${encodeURIComponent(planId)}`;
    const response = await fetch(`/.netlify/functions/task-plan-assignments${query}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load this task plan.');
    plan = data.plan;
    tasks = data.tasks || [];
    sections = ui.sectionsFromAssigned(tasks);
    templateDiff = data.template_diff || null;
  }

  function chooseInitialPhase() {
    const next = ui.nextTask(tasks);
    const nextSection = ui.sectionContaining(sections, next?.id);
    const firstIncomplete = sections.find(section => ui.stats(section.tasks).remaining > 0);
    const choice = nextSection || firstIncomplete || sections[0];
    selectedPhaseKey = choice ? ui.sectionKey(choice, sections.indexOf(choice)) : '';
  }

  function render() {
    document.title = `${plan.title} | CMC Pathway`;
    const overall = ui.stats(tasks);
    const next = ui.nextTask(tasks);
    app.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    app.innerHTML = `
      <aside class="cmcPlanSidebar" aria-label="Task plan navigation">
        <div class="cmcPlanSidebarRail">
          <button class="cmcPlanSidebarToggle" type="button" aria-label="${sidebarCollapsed ? 'Open task plan navigation' : 'Collapse task plan navigation'}" aria-expanded="${!sidebarCollapsed}">${sidebarIcon()}</button>
          <div class="cmcPlanRailStatus"><strong>${overall.percent}%</strong><span>complete</span></div>
        </div>
        <div class="cmcPlanSidebarContent">
          <a class="cmcBackToPathway" href="${leaderMode ? `participant.html?id=${encodeURIComponent(participantId)}` : 'dashboard.html'}">← ${leaderMode ? 'Participant dashboard' : 'My Pathway'}</a>
          <p class="cmcEyebrow">DEPLOY · TASK PLAN</p>
          <h1>${escapeHtml(plan.title)}</h1>
          <p>${escapeHtml(plan.description || 'Your launch work, dates, and progress in one place.')}</p>
          <div class="cmcPlanSidebarProgress"><div><i style="width:${overall.percent}%"></i></div><strong>${overall.percent}% complete</strong><span>${overall.completed} of ${overall.total} tasks</span></div>
          <nav class="cmcPlanOutline" aria-label="Plan phases">${ui.outlineHtml(sections, selectedPhaseKey)}</nav>
        </div>
      </aside>
      <section class="cmcTaskPlanWorkspace">
        <div class="cmcTaskPlanWorkspaceInner">
          ${leaderMode ? leaderToolsHtml() : ''}
          ${focusHtml(next, overall)}
          <nav class="cmcTaskPlanViewTabs" aria-label="Task plan views">
            <button class="${view === 'list' ? 'active' : ''}" data-plan-view="list" type="button">Current phase</button>
            <button class="${view === 'timeline' ? 'active' : ''}" data-plan-view="timeline" type="button">Timeline</button>
            <button class="${view === 'completed' ? 'active' : ''}" data-plan-view="completed" type="button">Completed</button>
          </nav>
          <section id="taskPlanContent" class="cmcTaskPlanContent">${contentHtml()}</section>
        </div>
      </section>`;
    bindShell();
  }

  function leaderToolsHtml() {
    const diffCount = (templateDiff?.added?.length || 0) + (templateDiff?.removed?.length || 0) + (templateDiff?.changed?.length || 0);
    const summary = templateDiff?.available
      ? `A newer master template is available with ${diffCount} proposed change${diffCount === 1 ? '' : 's'}. Completed work will be preserved.`
      : 'This participant is using the current template version.';
    return `<section class="cmcTaskPlanLeaderTools"><div><p class="cmcEyebrow">LEADER TOOLS</p><strong>Adjust this participant’s plan</strong><span id="taskPlanUpdateSummary">${escapeHtml(summary)}</span></div><div><button id="addCustomPlanTask" class="cmcSecondaryButton" type="button">Add custom task</button>${templateDiff?.available ? '<button id="applyTaskPlanUpdate" class="cmcPrimaryButton" type="button">Review template update</button>' : ''}</div></section>`;
  }

  function focusHtml(next, overall) {
    if (!overall.remaining) {
      return `<section class="cmcTaskPlanFocus complete"><div><p class="cmcEyebrow">PLAN COMPLETE</p><h2>Every task is complete.</h2><p>Your finished work stays organized by phase and remains available in the Completed view.</p></div><div class="cmcTaskPlanFocusStatus"><span>✓</span><strong>${overall.completed} completed</strong></div></section>`;
    }
    if (!next) {
      return `<section class="cmcTaskPlanFocus"><div><p class="cmcEyebrow">UP NEXT</p><h2>Your leader is reviewing the next step.</h2><p>Work awaiting approval is still in progress and does not need another action from you right now.</p></div></section>`;
    }
    const phase = ui.sectionContaining(sections, next.id);
    return `<section class="cmcTaskPlanFocus"><div><p class="cmcEyebrow">UP NEXT · ${escapeHtml(phase?.title || next.section_title || 'TASK PLAN')}</p><h2>${escapeHtml(next.title)}</h2><p>${escapeHtml(short(next.description || 'Open this task to review the details and next action.', 185))}</p></div><button class="cmcPrimaryButton" type="button" data-open-task="${escapeHtml(next.id)}">${leaderMode ? 'Manage task' : 'Open task'} →</button></section>`;
  }

  function contentHtml() {
    if (view === 'timeline') return timelineHtml();
    if (view === 'completed') return completedHtml();
    return selectedPhaseHtml();
  }

  function selectedPhaseHtml() {
    const section = sections.find((item, index) => ui.sectionKey(item, index) === selectedPhaseKey) || sections[0];
    if (!section) return empty('Nothing here yet.', 'Your leader can add work to this plan.');
    const summary = ui.stats(section.tasks);
    const index = sections.indexOf(section);
    const overall = ui.stats(tasks);
    return `<section class="cmcTaskPlanPhase cmcTaskPlanPhaseFocused"><div class="cmcPlanWorkspaceProgress"><div><span>Overall plan progress</span><strong>${overall.percent}% complete</strong></div><div><i style="width:${overall.percent}%"></i></div><small>${overall.completed} of ${overall.total} tasks complete</small></div><header><div><p class="cmcEyebrow">PHASE ${String(index + 1).padStart(2, '0')}</p><h2>${escapeHtml(section.title)}</h2>${section.description ? `<p>${escapeHtml(section.description)}</p>` : ''}</div><span>${summary.completed} of ${summary.total} complete</span></header><div class="cmcTaskPlanHierarchy">${renderHierarchy(section.tasks, ui.nextTask(section.tasks)) || empty('No tasks in this phase.', 'A leader can add work when it is needed.')}</div>${phasePagerHtml(index)}</section>`;
  }

  function renderHierarchy(items, next) {
    return (items || []).filter(item => item.status !== 'not_applicable').map(item => {
      if (item.task_type !== 'group') return taskRow(item);
      const summary = ui.stats(item.tasks);
      const containsNext = next && ui.flatten(item.tasks).some(child => String(child.id) === String(next.id));
      return `<details class="cmcPlanTaskGroup" ${containsNext ? 'open' : ''}><summary><span class="cmcPlanGroupChevron" aria-hidden="true"></span><div><p>GROUP</p><h3>${escapeHtml(item.title)}</h3>${item.description ? `<span>${escapeHtml(short(item.description, 125))}</span>` : ''}</div><strong>${summary.completed}/${summary.total}</strong></summary><div class="cmcPlanTaskGroupBody">${renderHierarchy(item.tasks, next) || '<p class="cmcTaskPreviewEmptyGroup">No tasks in this group yet.</p>'}</div></details>`;
    }).join('');
  }

  function taskRow(task) {
    const complete = task.status === 'completed';
    const pending = task.status === 'pending_review';
    const blocked = task.blocked_by_dependency && !complete;
    const milestone = task.task_type === 'milestone';
    const status = complete ? 'Complete' : pending ? 'Awaiting approval' : blocked ? 'Waiting' : task.status === 'in_progress' ? 'In progress' : 'Not started';
    return `<button class="cmcPlanTaskRow ${milestone ? 'milestone' : ''} ${complete ? 'complete' : ''} ${blocked ? 'blocked' : ''}" type="button" data-open-task="${escapeHtml(task.id)}"><span class="cmcPlanTaskCheck">${milestone ? '◆' : complete ? '✓' : pending ? '…' : blocked ? '⌛' : ''}</span><span class="cmcPlanTaskRowCopy"><small>${milestone ? 'MILESTONE' : 'TASK'}${Number(task.priority || 3) < 3 ? ` · PRIORITY ${task.priority}` : ''}</small><strong>${escapeHtml(task.title)}</strong>${task.description ? `<span>${escapeHtml(short(task.description, 145))}</span>` : ''}</span><span class="cmcPlanTaskRowAside"><b>${escapeHtml(status)}</b>${task.due_date ? `<time>Due ${formatDate(task.due_date)}</time>` : ''}<span class="cmcPlanExpandCue open" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m8 5 5 5-5 5"></path></svg></span></span></button>`;
  }

  function timelineHtml() {
    const dated = tasks.filter(task => task.task_type !== 'group' && task.status !== 'not_applicable' && (task.due_date || task.start_date))
      .sort((a, b) => String(a.due_date || a.start_date).localeCompare(String(b.due_date || b.start_date)));
    if (!dated.length) return empty('No dated tasks yet.', 'A leader can add dates to shape the launch timeline.');
    return `<section class="cmcTaskPlanPhase cmcTaskPlanTimelinePanel"><header><div><p class="cmcEyebrow">FULL PLAN</p><h2>Timeline</h2><p>Milestones and dated work across every phase, in chronological order.</p></div><span>${dated.length} dated ${dated.length === 1 ? 'item' : 'items'}</span></header><div class="cmcTaskTimeline">${dated.map(task => `<button type="button" data-open-task="${escapeHtml(task.id)}" class="${task.task_type === 'milestone' ? 'milestone' : ''} ${task.status === 'completed' ? 'complete' : ''}"><time>${formatDate(task.due_date || task.start_date)}</time><span></span><div><small>${escapeHtml(task.section_title || 'Task plan')}</small><strong>${escapeHtml(task.title)}</strong><p>${task.status === 'completed' ? 'Completed' : task.due_date ? 'Due date' : 'Start date'}</p></div></button>`).join('')}</div></section>`;
  }

  function completedHtml() {
    const completeSections = sections.map(section => ({ ...section, tasks: filterHierarchy(section.tasks, task => task.status === 'completed') }))
      .filter(section => ui.stats(section.tasks).completed > 0);
    if (!completeSections.length) return empty('No completed tasks yet.', 'Finished work will stay available here so progress remains visible.');
    return `<section class="cmcTaskPlanPhase cmcTaskPlanCompletedPanel"><header><div><p class="cmcEyebrow">ACCOMPLISHMENTS</p><h2>Completed work</h2><p>Everything finished so far, organized by phase.</p></div><span>${ui.stats(tasks).completed} complete</span></header><div class="cmcCompletedPhaseList">${completeSections.map((section, index) => `<details ${index === 0 ? 'open' : ''}><summary><strong>${escapeHtml(section.title)}</strong><span>${ui.stats(section.tasks).completed} complete</span></summary><div class="cmcTaskPlanHierarchy">${renderHierarchy(section.tasks, null)}</div></details>`).join('')}</div></section>`;
  }

  function filterHierarchy(items, predicate) {
    return (items || []).map(item => {
      if (item.task_type === 'group') {
        const children = filterHierarchy(item.tasks, predicate);
        return children.length ? { ...item, tasks: children } : null;
      }
      return predicate(item) ? item : null;
    }).filter(Boolean);
  }

  function bindShell() {
    document.querySelector('.cmcPlanSidebarToggle')?.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      localStorage.setItem('cmcTaskPlanSidebarCollapsed', String(sidebarCollapsed));
      render();
    });
    document.querySelectorAll('[data-plan-phase]').forEach(button => button.addEventListener('click', () => {
      selectedPhaseKey = button.dataset.planPhase;
      view = 'list';
      render();
      if (window.matchMedia('(max-width: 720px)').matches) document.getElementById('taskPlanContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    document.querySelectorAll('[data-phase-target]').forEach(button => button.addEventListener('click', () => {
      selectedPhaseKey = button.dataset.phaseTarget;
      view = 'list';
      render();
      document.getElementById('taskPlanContent')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }));
    document.querySelectorAll('[data-plan-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.planView; render(); }));
    document.querySelectorAll('[data-open-task]').forEach(button => button.addEventListener('click', () => openTask(button.dataset.openTask)));
    document.getElementById('addCustomPlanTask')?.addEventListener('click', () => {
      document.getElementById('customTaskMessage').textContent = '';
      document.getElementById('customTaskDialog').showModal();
    });
    document.getElementById('applyTaskPlanUpdate')?.addEventListener('click', applyTemplateUpdate);
  }

  function phasePagerHtml(index) {
    const previous = sections[index - 1];
    const next = sections[index + 1];
    if (!previous && !next) return '';
    return `<nav class="cmcPlanPhasePager" aria-label="Other phases"><button type="button" ${previous ? `data-phase-target="${escapeHtml(ui.sectionKey(previous, index - 1))}"` : 'disabled'}><span>← Previous phase</span><strong>${previous ? escapeHtml(previous.title) : 'Beginning of plan'}</strong></button><div class="cmcPlanPhaseDots" aria-label="Plan phases">${sections.map((phase, phaseIndex) => `<button type="button" class="${phaseIndex === index ? 'active' : ''}" data-phase-target="${escapeHtml(ui.sectionKey(phase, phaseIndex))}" aria-label="Open phase ${phaseIndex + 1}: ${escapeHtml(phase.title)}" ${phaseIndex === index ? 'aria-current="step"' : ''}></button>`).join('')}</div><button type="button" ${next ? `data-phase-target="${escapeHtml(ui.sectionKey(next, index + 1))}"` : 'disabled'}><span>Next phase →</span><strong>${next ? escapeHtml(next.title) : 'End of plan'}</strong></button></nav>`;
  }

  function openTask(id) {
    selected = tasks.find(task => String(task.id) === String(id));
    if (!selected) return;
    setText('taskDialogPhase', selected.section_title);
    setText('taskDialogTitle', selected.title);
    document.getElementById('taskDialogDescription').innerHTML = selected.description ? escapeHtml(selected.description).replace(/\n/g, '<br>') : '<p>No additional instructions were added.</p>';
    document.getElementById('taskDialogDates').innerHTML = `${selected.start_date ? `<span>Starts <strong>${formatDate(selected.start_date)}</strong></span>` : ''}${selected.due_date ? `<span>Due <strong>${formatDate(selected.due_date)}</strong></span>` : ''}`;
    const resource = document.getElementById('taskDialogResource');
    resource.classList.toggle('hidden', !selected.resource_url);
    resource.href = selected.resource_url || '#';
    document.getElementById('leaderTaskFields').classList.toggle('hidden', !leaderMode);
    const button = document.getElementById('completeTaskButton');
    if (leaderMode) {
      document.getElementById('leaderTaskTitle').value = selected.title;
      document.getElementById('leaderTaskDescription').value = selected.description || '';
      document.getElementById('leaderTaskStart').value = selected.start_date || '';
      document.getElementById('leaderTaskDue').value = selected.due_date || '';
      document.getElementById('leaderTaskPriority').value = selected.priority || 3;
      document.getElementById('leaderTaskStatus').value = selected.status;
      button.textContent = 'Save task changes';
      button.disabled = false;
    } else {
      button.textContent = selected.status === 'completed' ? 'Mark not started' : selected.status === 'pending_review' ? 'Awaiting leader approval' : !selected.participant_editable ? 'Managed by your CMC leader' : selected.blocked_by_dependency ? 'Waiting on earlier work' : selected.requires_approval ? 'Submit for approval' : 'Mark complete';
      button.disabled = selected.status === 'pending_review' || !selected.participant_editable || (selected.blocked_by_dependency && selected.status !== 'completed');
    }
    document.getElementById('taskDialogMessage').textContent = '';
    document.getElementById('taskPlanTaskDialog').showModal();
  }

  async function saveSelectedTask() {
    if (!selected) return;
    const button = document.getElementById('completeTaskButton');
    const message = document.getElementById('taskDialogMessage');
    button.disabled = true;
    try {
      const response = leaderMode
        ? await fetch('/.netlify/functions/task-plan-assignments', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_task', participant_id: participantId, plan_id: plan.id, task_id: selected.id, task: { title: document.getElementById('leaderTaskTitle').value, description: document.getElementById('leaderTaskDescription').value, start_date: document.getElementById('leaderTaskStart').value, due_date: document.getElementById('leaderTaskDue').value, priority: Number(document.getElementById('leaderTaskPriority').value), status: document.getElementById('leaderTaskStatus').value } }) })
        : await fetch('/.netlify/functions/task-plan-progress', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: selected.id, status: selected.status === 'completed' ? 'not_started' : 'completed' }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save this task.');
      Object.assign(selected, data.task);
      sections = ui.sectionsFromAssigned(tasks);
      document.getElementById('taskPlanTaskDialog').close();
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
    } finally { button.disabled = false; }
  }

  async function saveCustomTask() {
    const button = document.getElementById('saveCustomPlanTask');
    const message = document.getElementById('customTaskMessage');
    button.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/task-plan-assignments', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_task', participant_id: participantId, plan_id: plan.id, task: { title: document.getElementById('customTaskTitle').value, description: document.getElementById('customTaskDescription').value, section_title: document.getElementById('customTaskSection').value, due_date: document.getElementById('customTaskDue').value, priority: Number(document.getElementById('customTaskPriority').value) } }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not add this task.');
      tasks.push(data.task);
      sections = ui.sectionsFromAssigned(tasks);
      document.getElementById('customTaskDialog').close();
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
    } finally { button.disabled = false; }
  }

  async function applyTemplateUpdate() {
    const changes = [`${templateDiff.added.length} added`, `${templateDiff.changed.length} updated`, `${templateDiff.removed.length} removed`].join(', ');
    if (!confirm(`Apply the newer master template?\n\n${changes}\n\nCompleted work will not be overwritten.`)) return;
    const button = document.getElementById('applyTaskPlanUpdate');
    button.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/task-plan-assignments', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply_template_update', participant_id: participantId, plan_id: plan.id }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update this plan.');
      await loadPlan();
      chooseInitialPhase();
      render();
    } catch (error) {
      document.getElementById('taskPlanUpdateSummary').textContent = error.message;
      document.getElementById('taskPlanUpdateSummary').classList.add('error');
      button.disabled = false;
    }
  }

  function sidebarIcon() {
    return sidebarCollapsed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M13 9l3 3-3 3"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M16 9l-3 3 3 3"></path></svg>';
  }
  function setText(id, value) { document.getElementById(id).textContent = value; }
  function short(value, max) { return String(value).length > max ? `${String(value).slice(0, max).trim()}…` : String(value); }
  function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }
  function empty(title, copy) { return `<div class="cmcTaskPlanEmpty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`; }
  function escapeHtml(value) { return ui.escapeHtml(value); }
})();
