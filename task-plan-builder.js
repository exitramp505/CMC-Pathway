(async function taskPlanBuilder() {
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (profile?.account_role !== 'cmc_admin') {
    window.location.replace('dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'plans');

  const sb = await dcAuth.getSupabaseClient();
  const token = (await sb.auth.getSession()).data?.session?.access_token || '';
  const templateId = new URLSearchParams(location.search).get('id');
  const sectionsEl = document.getElementById('taskPlanSections');
  const sectionTemplate = document.getElementById('taskPlanSectionTemplate');
  const taskTemplate = document.getElementById('taskPlanTaskTemplate');
  const statusEl = document.getElementById('taskPlanSaveStatus');
  let current = null;
  let saveTimer = null;
  let saving = false;
  let queued = false;

  if (templateId) {
    try {
      const data = await api(`?id=${encodeURIComponent(templateId)}`);
      current = data.template;
      fillDetails(current);
      data.sections.forEach(addSection);
      refreshAllOptions();
      document.getElementById('builderPageTitle').textContent = current.title;
    } catch (error) {
      status(error.message, true);
    }
  } else {
    addSection({ title:'Phase 1 · Getting Started', tasks:[] });
  }

  document.querySelectorAll('#taskPlanTitle,#taskPlanSlug,#taskPlanDescription,#taskPlanStage')
    .forEach(input => input.addEventListener('input', scheduleSave));
  document.getElementById('addTaskPlanSection').addEventListener('click', () => {
    addSection();
    scheduleSave();
  });
  document.getElementById('collapseTaskPlan').addEventListener('click', () => {
    const collapse = [...sectionsEl.children].some(section => !section.classList.contains('collapsed'));
    [...sectionsEl.children].forEach(section => section.classList.toggle('collapsed', collapse));
    document.getElementById('collapseTaskPlan').textContent = collapse ? 'Expand all' : 'Collapse all';
  });
  document.getElementById('publishTaskPlan').addEventListener('click', async () => {
    await saveNow();
    if (!current?.id) return;
    try {
      status('Publishing…');
      const data = await api('', { ...serialize(), action:'publish' });
      current = data.template;
      status(`Published · version ${current.version}`);
    } catch (error) {
      status(error.message, true);
    }
  });
  document.getElementById('previewTaskPlan').addEventListener('click', async () => {
    await saveNow();
    if (!current?.id) {
      status('Add a task plan title before previewing.', true);
      return;
    }
    window.open(`task-plan-preview.html?id=${encodeURIComponent(current.id)}`, '_blank', 'noopener');
  });

  function fillDetails(template) {
    document.getElementById('taskPlanTitle').value = template.title || '';
    document.getElementById('taskPlanSlug').value = template.slug || '';
    document.getElementById('taskPlanDescription').value = template.description || '';
    document.getElementById('taskPlanStage').value = template.stage_key || 'deploy';
  }

  function addSection(section = {}) {
    const node = sectionTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.clientId = section.client_id || section.id || uid();
    node.querySelector('[data-section-title]').value = section.title || '';
    node.querySelector('[data-section-description]').value = section.description || '';
    node.querySelector('[data-section-summary]').textContent = section.title || 'Untitled phase';
    wireSection(node);
    sectionsEl.append(node);
    flatten(section.tasks || []).forEach(task => addTask(node, task));
    refreshAllOptions();
  }

  function wireSection(node) {
    node.querySelector('.cmcEditorToggle').addEventListener('click', () => node.classList.toggle('collapsed'));
    node.querySelector('[data-section-title]').addEventListener('input', event => {
      node.querySelector('[data-section-summary]').textContent = event.target.value || 'Untitled phase';
      scheduleSave();
    });
    node.querySelector('[data-section-description]').addEventListener('input', scheduleSave);
    node.querySelector('[data-add-task]').addEventListener('click', () => {
      addTask(node);
      refreshAllOptions();
      scheduleSave();
    });
    node.querySelector('[data-remove-section]').addEventListener('click', () => {
      if (confirm('Remove this phase and its tasks?')) {
        node.remove();
        refreshAllOptions();
        scheduleSave();
      }
    });
    wireMove(node, sectionsEl);
  }

  function addTask(section, task = {}) {
    const node = taskTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.clientId = task.client_id || task.id || uid();
    node.dataset.parentId = task.parent_client_id || task.parent_task_id || '';
    node.dataset.dependencyIds = JSON.stringify(task.dependency_client_ids || []);
    node.querySelector('[data-task-title]').value = task.title || '';
    node.querySelector('[data-task-type]').value = task.task_type || 'task';
    node.querySelector('[data-task-description]').value = task.description || '';
    node.querySelector('[data-task-start]').value = task.relative_start_days ?? '';
    node.querySelector('[data-task-due]').value = task.relative_due_days ?? '';
    node.querySelector('[data-task-priority]').value = task.default_priority || 3;
    node.querySelector('[data-task-url]').value = task.resource_url || '';
    node.querySelector('[data-task-required]').checked = task.is_required !== false;
    node.querySelector('[data-task-approval]').checked = Boolean(task.requires_approval);
    node.querySelector('[data-task-editable]').checked = task.participant_editable !== false;
    node.querySelector('[data-task-summary]').textContent = task.title || 'Untitled task';
    node.querySelector('[data-task-kind]').textContent = titleCase(task.task_type || 'task');
    applyTaskType(node);
    wireTask(node, section);
    section.querySelector('[data-task-list]').append(node);
  }

  function wireTask(node, section) {
    node.querySelector('.cmcEditorToggle').addEventListener('click', () => node.classList.toggle('collapsed'));
    node.querySelectorAll('input,textarea,select').forEach(input => input.addEventListener('input', () => {
      node.dataset.parentId = node.querySelector('[data-task-parent]').value;
      node.dataset.dependencyIds = JSON.stringify(selectedValues(node.querySelector('[data-task-dependencies]')));
      node.querySelector('[data-task-summary]').textContent = node.querySelector('[data-task-title]').value || 'Untitled task';
      node.querySelector('[data-task-kind]').textContent = titleCase(node.querySelector('[data-task-type]').value);
      applyTaskType(node);
      refreshAllOptions();
      scheduleSave();
    }));
    node.querySelector('[data-remove-task]').addEventListener('click', () => {
      if (confirm('Remove this task?')) {
        node.remove();
        refreshAllOptions();
        scheduleSave();
      }
    });
    wireMove(node, section.querySelector('[data-task-list]'));
  }

  function applyTaskType(node) {
    node.dataset.taskTypeStyle = node.querySelector('[data-task-type]').value || 'task';
  }

  function wireMove(node, container) {
    node.querySelector('[data-move="up"]').addEventListener('click', () => {
      if (node.previousElementSibling) container.insertBefore(node, node.previousElementSibling);
      refreshAllOptions();
      scheduleSave();
    });
    node.querySelector('[data-move="down"]').addEventListener('click', () => {
      if (node.nextElementSibling) container.insertBefore(node.nextElementSibling, node);
      refreshAllOptions();
      scheduleSave();
    });
  }

  function refreshAllOptions() {
    const allTasks = [...sectionsEl.querySelectorAll('.cmcTaskPlanTask')];
    [...sectionsEl.querySelectorAll('.cmcTaskPlanSection')].forEach(section => {
      const sectionTasks = [...section.querySelectorAll('.cmcTaskPlanTask')];
      const groups = sectionTasks.filter(node => node.querySelector('[data-task-type]').value === 'group');
      sectionTasks.forEach(node => {
        const parentSelect = node.querySelector('[data-task-parent]');
        const parentValue = node.dataset.parentId || parentSelect.value;
        parentSelect.innerHTML = '<option value="">No parent group</option>' + groups
          .filter(group => group !== node)
          .map(group => `<option value="${group.dataset.clientId}">${escapeHtml(group.querySelector('[data-task-title]').value || 'Untitled group')}</option>`)
          .join('');
        parentSelect.value = groups.some(group => group.dataset.clientId === parentValue) ? parentValue : '';
        node.dataset.parentId = parentSelect.value;

        const dependencySelect = node.querySelector('[data-task-dependencies]');
        const dependencyValues = new Set(JSON.parse(node.dataset.dependencyIds || '[]'));
        dependencySelect.innerHTML = allTasks
          .filter(candidate => candidate !== node && candidate.querySelector('[data-task-type]').value !== 'group')
          .map(candidate => `<option value="${candidate.dataset.clientId}">${escapeHtml(candidate.querySelector('[data-task-title]').value || 'Untitled task')}</option>`)
          .join('');
        [...dependencySelect.options].forEach(option => { option.selected = dependencyValues.has(option.value); });
      });
    });
  }

  function serialize() {
    return {
      template:{
        id:current?.id || null,
        title:document.getElementById('taskPlanTitle').value,
        slug:document.getElementById('taskPlanSlug').value,
        description:document.getElementById('taskPlanDescription').value,
        stage_key:document.getElementById('taskPlanStage').value,
        status:current?.status || 'draft'
      },
      sections:[...sectionsEl.children].map(section => {
        const taskNodes = [...section.querySelectorAll('.cmcTaskPlanTask')];
        const byParent = new Map([['', []]]);
        taskNodes.forEach(node => {
          const parent = node.querySelector('[data-task-parent]').value || '';
          if (!byParent.has(parent)) byParent.set(parent, []);
          byParent.get(parent).push(readTask(node));
        });
        const nest = list => list.map(task => ({ ...task, tasks:nest(byParent.get(task.client_id) || []) }));
        return {
          client_id:section.dataset.clientId,
          title:section.querySelector('[data-section-title]').value,
          description:section.querySelector('[data-section-description]').value,
          tasks:nest(byParent.get('') || [])
        };
      })
    };
  }

  function readTask(node) {
    return {
      client_id:node.dataset.clientId,
      title:node.querySelector('[data-task-title]').value,
      description:node.querySelector('[data-task-description]').value,
      task_type:node.querySelector('[data-task-type]').value,
      relative_start_days:numberValue(node, '[data-task-start]'),
      relative_due_days:numberValue(node, '[data-task-due]'),
      default_priority:Number(node.querySelector('[data-task-priority]').value),
      resource_url:node.querySelector('[data-task-url]').value,
      dependency_client_ids:selectedValues(node.querySelector('[data-task-dependencies]')),
      is_required:node.querySelector('[data-task-required]').checked,
      requires_approval:node.querySelector('[data-task-approval]').checked,
      participant_editable:node.querySelector('[data-task-editable]').checked
    };
  }

  function scheduleSave() {
    status('Unsaved changes');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (saving) { queued = true; return current; }
    const payload = serialize();
    if (!payload.template.title.trim()) { status('Add a title to start autosave'); return current; }
    saving = true;
    try {
      status('Saving…');
      const data = await api('', payload);
      current = data.template;
      syncSavedIds(data.sections || []);
      history.replaceState({}, '', `task-plan-builder.html?id=${current.id}`);
      document.getElementById('builderPageTitle').textContent = current.title;
      status('All changes saved');
    } catch (error) {
      status(error.message, true);
    } finally {
      saving = false;
      if (queued) { queued = false; saveNow(); }
    }
    return current;
  }

  function syncSavedIds(savedSections) {
    const sectionNodes = [...sectionsEl.children];
    const idMap = new Map();
    sectionNodes.forEach((sectionNode, sectionIndex) => {
      const savedSection = savedSections[sectionIndex];
      if (!savedSection) return;
      idMap.set(sectionNode.dataset.clientId, savedSection.id);
      sectionNode.dataset.clientId = savedSection.id;
      const localTasks = [...sectionNode.querySelectorAll('.cmcTaskPlanTask')];
      const savedTasks = flatten(savedSection.tasks || []);
      localTasks.forEach((taskNode, taskIndex) => {
        const savedTask = savedTasks[taskIndex];
        if (!savedTask) return;
        idMap.set(taskNode.dataset.clientId, savedTask.id);
        taskNode.dataset.clientId = savedTask.id;
      });
    });
    sectionNodes.forEach(sectionNode => {
      sectionNode.querySelectorAll('.cmcTaskPlanTask').forEach(taskNode => {
        taskNode.dataset.parentId = idMap.get(taskNode.dataset.parentId) || taskNode.dataset.parentId || '';
        const dependencies = JSON.parse(taskNode.dataset.dependencyIds || '[]');
        taskNode.dataset.dependencyIds = JSON.stringify(dependencies.map(id => idMap.get(id) || id));
      });
    });
    refreshAllOptions();
  }

  async function api(query = '', body) {
    const response = await fetch(`/.netlify/functions/task-plan-admin${query}`, {
      method:body ? 'POST' : 'GET',
      headers:{ Authorization:`Bearer ${token}`, ...(body ? { 'Content-Type':'application/json' } : {}) },
      body:body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Task plan request failed.');
    return data;
  }

  function status(text, error = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', error);
  }
  function uid() { return `local-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`; }
  function titleCase(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  function numberValue(node, selector) { const text = node.querySelector(selector).value; return text === '' ? null : Number(text); }
  function flatten(tasks, output = []) { tasks.forEach(task => { output.push(task); flatten(task.tasks || [], output); }); return output; }
  function selectedValues(select) { return [...select.selectedOptions].map(option => option.value); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }
})();
