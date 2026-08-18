(async function taskPlanPreview() {
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (profile?.account_role !== 'cmc_admin') { window.location.replace('dashboard.html'); return; }
  dcAuth.renderRoleNavigation(profile, 'plans');

  const id = new URLSearchParams(location.search).get('id');
  const app = document.getElementById('taskPlanPreviewApp');
  const ui = window.cmcTaskPlanUI;
  let template;
  let sections = [];
  let selectedPhaseKey = '';
  let sidebarCollapsed = localStorage.getItem('cmcTaskPlanPreviewSidebarCollapsed') === 'true';
  if (window.matchMedia('(max-width: 720px)').matches && !localStorage.getItem('cmcTaskPlanPreviewSidebarCollapsed')) sidebarCollapsed = true;
  if (!id) { showError('Choose a task plan from the library to preview it.'); return; }

  try {
    const sb = await dcAuth.getSupabaseClient();
    const token = (await sb.auth.getSession()).data?.session?.access_token || '';
    const response = await fetch(`/.netlify/functions/task-plan-admin?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load this task plan.');
    template = data.template;
    sections = data.sections || [];
    selectedPhaseKey = sections[0] ? ui.sectionKey(sections[0], 0) : '';
    document.title = `${template.title} Preview | CMC Pathway`;
    render();
  } catch (error) { showError(error.message); }

  function render() {
    const allTasks = ui.flatten(sections.flatMap(section => section.tasks || []));
    const summary = ui.stats(allTasks);
    app.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    app.innerHTML = `
      <aside class="cmcPlanSidebar" aria-label="Task plan preview navigation">
        <div class="cmcPlanSidebarRail">
          <button class="cmcPlanSidebarToggle" type="button" aria-label="${sidebarCollapsed ? 'Open task plan navigation' : 'Collapse task plan navigation'}" aria-expanded="${!sidebarCollapsed}">${sidebarIcon()}</button>
          <div class="cmcPlanRailStatus"><strong>${summary.total}</strong><span>items</span></div>
        </div>
        <div class="cmcPlanSidebarContent">
          <a class="cmcBackToPathway" href="task-plans.html">← Task plan library</a>
          <p class="cmcEyebrow">${escapeHtml(template.stage_key)} · TEMPLATE</p>
          <h1>${escapeHtml(template.title)}</h1>
          <p>${escapeHtml(template.description || 'No description has been added yet.')}</p>
          <div class="cmcPlanSidebarProgress preview"><strong>${summary.total} items</strong><span>Across ${sections.length} ${sections.length === 1 ? 'phase' : 'phases'}</span><small>${escapeHtml(statusLabel(template.status))} · version ${Number(template.version || 1)}</small></div>
          <nav class="cmcPlanOutline" aria-label="Template phases">${ui.outlineHtml(sections, selectedPhaseKey, { preview: true })}</nav>
        </div>
      </aside>
      <section class="cmcTaskPlanWorkspace">
        <div class="cmcTaskPlanWorkspaceInner">
          <div class="cmcTaskPlanPreviewToolbar"><a class="cmcBackLink" href="task-plans.html">← Task plan library</a><a class="cmcPrimaryButton" href="task-plan-builder.html?id=${encodeURIComponent(id)}">Edit plan</a></div>
          <section class="cmcTaskPlanPreviewNotice"><span class="cmcInfoBadge" aria-hidden="true">i</span><div><strong>Master template preview</strong><p>Choose a phase in the outline. Groups can be opened as needed, and task details are available without crowding the page. Assigned plans use this same layout with completion controls added.</p></div></section>
          <section id="taskPlanPreviewContent" class="cmcTaskPlanContent">${phaseHtml()}</section>
        </div>
      </section>`;
    bind();
  }

  function phaseHtml() {
    const section = sections.find((item, index) => ui.sectionKey(item, index) === selectedPhaseKey) || sections[0];
    if (!section) return empty('No phases yet.', 'Add a phase in the editor to begin building this plan.');
    const index = sections.indexOf(section);
    const summary = ui.stats(section.tasks);
    const titles = new Map(ui.flatten(sections.flatMap(item => item.tasks || [])).map(task => [String(task.id), task.title]));
    return `<section class="cmcTaskPlanPhase cmcTaskPlanPhaseFocused"><header><div><p class="cmcEyebrow">PHASE ${String(index + 1).padStart(2, '0')}</p><h2>${escapeHtml(section.title)}</h2>${section.description ? `<p>${escapeHtml(section.description)}</p>` : ''}</div><span>${summary.total} ${summary.total === 1 ? 'item' : 'items'}</span></header><div class="cmcTaskPlanHierarchy">${renderHierarchy(section.tasks || [], titles, true) || empty('No tasks in this phase.', 'Add groups, tasks, or milestones in the editor.')}</div></section>`;
  }

  function renderHierarchy(items, titleById, firstGroup) {
    return (items || []).map((task, index) => {
      if (task.task_type === 'group') {
        const summary = ui.stats(task.tasks);
        return `<details class="cmcPlanTaskGroup" ${firstGroup && index === 0 ? 'open' : ''}><summary><span class="cmcPlanGroupChevron" aria-hidden="true"></span><div><p>GROUP</p><h3>${escapeHtml(task.title)}</h3>${task.description ? `<span>${escapeHtml(short(task.description, 125))}</span>` : ''}</div><strong>${summary.total} ${summary.total === 1 ? 'item' : 'items'}</strong></summary><div class="cmcPlanTaskGroupBody">${renderHierarchy(task.tasks || [], titleById, false) || '<p class="cmcTaskPreviewEmptyGroup">No tasks in this group yet.</p>'}</div></details>`;
      }
      const dependencies = (task.dependency_client_ids || []).map(value => titleById.get(String(value))).filter(Boolean);
      const milestone = task.task_type === 'milestone';
      return `<details class="cmcPlanTaskPreviewDetail ${milestone ? 'milestone' : ''}"><summary class="cmcPlanTaskRow ${milestone ? 'milestone' : ''}"><span class="cmcPlanTaskCheck">${milestone ? '◆' : ''}</span><span class="cmcPlanTaskRowCopy"><small>${milestone ? 'MILESTONE' : 'TASK'}${Number(task.default_priority || 3) < 3 ? ` · PRIORITY ${task.default_priority}` : ''}</small><strong>${escapeHtml(task.title)}</strong>${task.description ? `<span>${escapeHtml(short(task.description, 145))}</span>` : ''}</span><span class="cmcPlanTaskRowAside"><b>${task.is_required === false ? 'Optional' : 'Required'}</b>${offsetText(task.relative_due_days, 'Due')}<i>Details</i></span></summary><div class="cmcPlanTaskPreviewBody">${task.description ? `<p>${escapeHtml(task.description).replace(/\n/g, '<br>')}</p>` : '<p>No additional instructions have been added.</p>'}<div class="cmcTaskPreviewMeta">${offsetLabel(task.relative_start_days, 'Starts')}${offsetLabel(task.relative_due_days, 'Due')}<span>Priority ${Number(task.default_priority || 3)}</span>${task.requires_approval ? '<span>Leader approval</span>' : ''}</div>${dependencies.length ? `<div class="cmcTaskPreviewDependencies"><span class="cmcInfoBadge" aria-hidden="true">i</span><span><strong>Available after:</strong> ${dependencies.map(escapeHtml).join(', ')}</span></div>` : ''}${task.resource_url ? `<a class="cmcTaskPreviewResource" href="${escapeHtml(task.resource_url)}" target="_blank" rel="noopener">Open resource ↗</a>` : ''}</div></details>`;
    }).join('');
  }

  function bind() {
    document.querySelector('.cmcPlanSidebarToggle')?.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      localStorage.setItem('cmcTaskPlanPreviewSidebarCollapsed', String(sidebarCollapsed));
      render();
    });
    document.querySelectorAll('[data-plan-phase]').forEach(button => button.addEventListener('click', () => {
      selectedPhaseKey = button.dataset.planPhase;
      render();
      if (window.matchMedia('(max-width: 720px)').matches) document.getElementById('taskPlanPreviewContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function offsetLabel(value, label) {
    if (value === null || value === undefined || value === '') return '';
    const days = Number(value);
    return `<span>${label} ${days === 0 ? 'on assignment' : `day ${days}`}</span>`;
  }
  function offsetText(value, label) {
    if (value === null || value === undefined || value === '') return '';
    const days = Number(value);
    return `<time>${label} ${days === 0 ? 'on assignment' : `day ${days}`}</time>`;
  }
  function sidebarIcon() {
    return sidebarCollapsed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M13 9l3 3-3 3"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M16 9l-3 3 3 3"></path></svg>';
  }
  function showError(text) { app.innerHTML = empty('Unable to preview this task plan.', text); }
  function statusLabel(value) { return value === 'published' ? 'Published' : value === 'archived' ? 'Archived' : 'Draft'; }
  function short(value, max) { return String(value).length > max ? `${String(value).slice(0, max).trim()}…` : String(value); }
  function empty(title, copy) { return `<div class="cmcTaskPlanEmpty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`; }
  function escapeHtml(value) { return ui.escapeHtml(value); }
})();
