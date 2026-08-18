(async function taskPlanPreview() {
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (profile?.account_role !== 'cmc_admin') {
    window.location.replace('dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'plans');

  const id = new URLSearchParams(location.search).get('id');
  const message = document.getElementById('taskPlanPreviewMessage');
  const content = document.getElementById('taskPlanPreviewContent');
  const hero = document.getElementById('taskPlanPreviewHero');
  if (!id) {
    showError('Choose a task plan from the library to preview it.');
    return;
  }

  try {
    const sb = await dcAuth.getSupabaseClient();
    const token = (await sb.auth.getSession()).data?.session?.access_token || '';
    const response = await fetch(`/.netlify/functions/task-plan-admin?id=${encodeURIComponent(id)}`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load this task plan.');
    document.title = `${data.template.title} Preview | CMC Pathway`;
    document.getElementById('editTaskPlan').href = `task-plan-builder.html?id=${encodeURIComponent(id)}`;
    renderHero(data.template, data.sections);
    renderPlan(data.sections || []);
  } catch (error) {
    showError(error.message);
  }

  function renderHero(template, sections) {
    const tasks = flatten(sections.flatMap(section => section.tasks || []));
    hero.removeAttribute('aria-busy');
    hero.innerHTML = `<div><p class="cmcEyebrow">${escapeHtml(template.stage_key)} · TEMPLATE PREVIEW</p><h1>${escapeHtml(template.title)}</h1><p>${escapeHtml(template.description || 'No description has been added yet.')}</p></div><div class="cmcTaskPlanProgress cmcTemplatePreviewStats"><strong>${tasks.filter(task => task.task_type !== 'group').length}</strong><span>items across ${sections.length} ${sections.length === 1 ? 'phase' : 'phases'}</span><small>${escapeHtml(statusLabel(template.status))} · version ${Number(template.version || 1)}</small></div>`;
  }

  function renderPlan(sections) {
    if (!sections.length) {
      content.innerHTML = '<div class="cmcTaskPlanEmpty"><strong>No phases yet.</strong><p>Add a phase in the editor to begin building this plan.</p></div>';
      return;
    }
    const allTasks = flatten(sections.flatMap(section => section.tasks || []));
    const titleById = new Map(allTasks.map(task => [task.id, task.title]));
    content.innerHTML = sections.map((section, index) => {
      const topLevel = section.tasks || [];
      const itemCount = flatten(topLevel).filter(task => task.task_type !== 'group').length;
      return `<section class="cmcTaskPlanPreviewPhase"><header><div><p class="cmcEyebrow">PHASE ${String(index + 1).padStart(2, '0')}</p><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.description || '')}</p></div><span>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span></header><div class="cmcTaskPlanPreviewItems">${topLevel.map(task => renderItem(task, titleById)).join('')}</div></section>`;
    }).join('');
  }

  function renderItem(task, titleById) {
    if (task.task_type === 'group') {
      return `<section class="cmcTaskPreviewGroup"><header><span class="cmcTaskTypeMark">GROUP</span><div><h3>${escapeHtml(task.title)}</h3>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}</div></header><div class="cmcTaskPreviewGroupItems">${(task.tasks || []).map(child => renderItem(child, titleById)).join('') || '<p class="cmcTaskPreviewEmptyGroup">No items in this group yet.</p>'}</div></section>`;
    }
    const dependencies = (task.dependency_client_ids || []).map(value => titleById.get(value)).filter(Boolean);
    const type = task.task_type === 'milestone' ? 'milestone' : 'task';
    return `<article class="cmcTaskPreviewItem ${type}"><div class="cmcTaskPreviewItemHeading"><span class="cmcTaskTypeMark">${type === 'milestone' ? '◆ MILESTONE' : 'TASK'}</span><h3>${escapeHtml(task.title)}</h3></div>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}<div class="cmcTaskPreviewMeta">${offsetLabel(task.relative_start_days, 'Starts')} ${offsetLabel(task.relative_due_days, 'Due')}<span>Priority ${Number(task.default_priority || 3)}</span>${task.is_required !== false ? '<span>Required</span>' : '<span>Optional</span>'}${task.requires_approval ? '<span>Leader approval</span>' : ''}</div>${dependencies.length ? `<div class="cmcTaskPreviewDependencies"><span class="cmcInfoBadge" aria-hidden="true">i</span><span><strong>Available after:</strong> ${dependencies.map(escapeHtml).join(', ')}</span></div>` : ''}${task.resource_url ? `<a class="cmcTaskPreviewResource" href="${escapeAttribute(task.resource_url)}" target="_blank" rel="noopener">Open resource ↗</a>` : ''}</article>`;
  }

  function offsetLabel(value, label) {
    if (value === null || value === undefined || value === '') return '';
    const days = Number(value);
    return `<span>${label} ${days === 0 ? 'on assignment' : `day ${days}`}</span>`;
  }
  function showError(text) { hero.removeAttribute('aria-busy'); message.textContent = text; message.classList.add('error'); }
  function flatten(tasks, output = []) { tasks.forEach(task => { output.push(task); flatten(task.tasks || [], output); }); return output; }
  function statusLabel(value) { return value === 'published' ? 'Published' : value === 'archived' ? 'Archived' : 'Draft'; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }
  function escapeAttribute(value) { return escapeHtml(value); }
})();
