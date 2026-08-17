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
  const leaderMode = Boolean(participantId && ['regional_leader','cmc_admin'].includes(profile?.account_role));
  if (!planId) { location.href = 'dashboard.html'; return; }

  let plan;
  let tasks = [];
  let templateDiff = null;
  let view = 'list';
  let selected = null;

  try {
    await loadPlan();
    render();
  } catch (error) {
    document.getElementById('taskPlanContent').innerHTML = empty('Unable to open this task plan.', error.message);
  }

  document.querySelectorAll('[data-plan-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.planView;
    document.querySelectorAll('[data-plan-view]').forEach(item => item.classList.toggle('active', item === button));
    renderTasks();
  }));
  document.getElementById('completeTaskButton').addEventListener('click', saveSelectedTask);
  document.getElementById('addCustomPlanTask').addEventListener('click', () => {
    document.getElementById('customTaskMessage').textContent = '';
    document.getElementById('customTaskDialog').showModal();
  });
  document.getElementById('saveCustomPlanTask').addEventListener('click', saveCustomTask);
  document.getElementById('applyTaskPlanUpdate').addEventListener('click', applyTemplateUpdate);

  async function loadPlan() {
    const query = leaderMode
      ? `?participant_id=${encodeURIComponent(participantId)}&plan_id=${encodeURIComponent(planId)}`
      : `?plan_id=${encodeURIComponent(planId)}`;
    const response = await fetch(`/.netlify/functions/task-plan-assignments${query}`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load this task plan.');
    plan = data.plan;
    tasks = data.tasks || [];
    templateDiff = data.template_diff || null;
  }

  function render() {
    document.title = `${plan.title} | CMC Pathway`;
    text('taskPlanName', plan.title);
    text('taskPlanDescription', plan.description || 'Your launch work, dates, and progress in one place.');
    renderProgress();
    renderLeaderTools();
    renderTasks();
  }

  function renderLeaderTools() {
    const tools = document.getElementById('taskPlanLeaderTools');
    tools.classList.toggle('hidden', !leaderMode);
    if (!leaderMode) return;
    const diffCount = (templateDiff?.added?.length || 0) + (templateDiff?.removed?.length || 0) + (templateDiff?.changed?.length || 0);
    const button = document.getElementById('applyTaskPlanUpdate');
    button.classList.toggle('hidden', !templateDiff?.available);
    text('taskPlanUpdateSummary', templateDiff?.available
      ? `A newer master template is available with ${diffCount} proposed change${diffCount === 1 ? '' : 's'}. Completed work will be preserved.`
      : 'This participant is using the current template version.');
  }

  function renderProgress() {
    const actionable = tasks.filter(task => task.task_type !== 'group' && task.status !== 'not_applicable');
    const complete = actionable.filter(task => task.status === 'completed').length;
    const progress = actionable.length ? Math.round(complete / actionable.length * 100) : 0;
    text('taskPlanProgress', `${progress}%`);
    document.getElementById('taskPlanProgressBar').style.width = `${progress}%`;
    text('taskPlanProgressCaption', `${complete} of ${actionable.length} tasks complete`);
  }

  function renderTasks() {
    const content = document.getElementById('taskPlanContent');
    const filtered = view === 'completed'
      ? tasks.filter(task => task.status === 'completed')
      : tasks.filter(task => view !== 'list' || task.status !== 'not_applicable');
    if (view === 'timeline') {
      const dated = filtered.filter(task => task.due_date || task.start_date)
        .sort((a, b) => String(a.due_date || a.start_date).localeCompare(String(b.due_date || b.start_date)));
      content.innerHTML = dated.length
        ? `<div class="cmcTaskTimeline">${dated.map(taskCard).join('')}</div>`
        : empty('No dated tasks yet.', 'A leader can add dates to shape the launch timeline.');
      attachTaskCards();
      return;
    }
    const sections = groupBy(filtered, task => task.section_title);
    content.innerHTML = [...sections].map(([name, items]) => {
      const actionable = items.filter(item => item.task_type !== 'group' && item.status !== 'not_applicable');
      return `<section class="cmcTaskPlanPhase"><header><div><p class="cmcEyebrow">PHASE</p><h2>${escapeHtml(name)}</h2></div><span>${actionable.filter(item => item.status === 'completed').length} of ${actionable.length} complete</span></header><div class="cmcTaskPlanTaskCards">${items.map(taskCard).join('')}</div></section>`;
    }).join('') || empty('Nothing here yet.', view === 'completed' ? 'Completed tasks will stay available here.' : 'Your leader can add work to this plan.');
    attachTaskCards();
  }

  function taskCard(task) {
    const group = task.task_type === 'group';
    const complete = task.status === 'completed';
    const pendingReview = task.status === 'pending_review';
    const blocked = task.blocked_by_dependency && !complete;
    return `<article class="cmcPlanTaskCard ${group ? 'group' : ''} ${complete ? 'complete' : ''} ${blocked ? 'blocked' : ''} ${pendingReview ? 'pending-review' : ''}" data-task-id="${task.id}"><span class="cmcPlanTaskCheck">${group ? '' : complete ? '✓' : pendingReview ? '…' : blocked ? '⌛' : '○'}</span><div><div class="cmcPlanTaskMeta"><span>${escapeHtml(group ? 'Task group' : task.task_type)}</span>${task.priority < 3 ? `<b>Priority ${task.priority}</b>` : ''}${pendingReview ? '<b>Awaiting leader approval</b>' : ''}${blocked ? '<b>Waiting on earlier work</b>' : ''}</div><h3>${escapeHtml(task.title)}</h3>${task.description ? `<p>${escapeHtml(short(task.description, 150))}</p>` : ''}<div class="cmcPlanTaskDates">${task.start_date ? `<span>Starts ${formatDate(task.start_date)}</span>` : ''}${task.due_date ? `<span>Due ${formatDate(task.due_date)}</span>` : ''}</div></div>${group ? '' : `<button type="button">${leaderMode ? 'Manage' : complete || pendingReview ? 'Review' : 'Open'} →</button>`}</article>`;
  }

  function attachTaskCards() {
    document.querySelectorAll('.cmcPlanTaskCard:not(.group)').forEach(card => card.addEventListener('click', () => openTask(card.dataset.taskId)));
  }

  function openTask(id) {
    selected = tasks.find(task => task.id === id);
    if (!selected) return;
    text('taskDialogPhase', selected.section_title);
    text('taskDialogTitle', selected.title);
    document.getElementById('taskDialogDescription').innerHTML = selected.description
      ? escapeHtml(selected.description).replace(/\n/g, '<br>')
      : '<p>No additional instructions were added.</p>';
    document.getElementById('taskDialogDates').innerHTML = `${selected.start_date ? `<span>Starts <strong>${formatDate(selected.start_date)}</strong></span>` : ''}${selected.due_date ? `<span>Due <strong>${formatDate(selected.due_date)}</strong></span>` : ''}`;
    const resource = document.getElementById('taskDialogResource');
    resource.classList.toggle('hidden', !selected.resource_url);
    resource.href = selected.resource_url || '#';
    const leaderFields = document.getElementById('leaderTaskFields');
    leaderFields.classList.toggle('hidden', !leaderMode);
    const button = document.getElementById('completeTaskButton');
    if (leaderMode) {
      document.getElementById('leaderTaskTitle').value = selected.title;
      document.getElementById('leaderTaskDescription').value = selected.description || '';
      document.getElementById('leaderTaskStart').value = selected.start_date || '';
      document.getElementById('leaderTaskDue').value = selected.due_date || '';
      document.getElementById('leaderTaskPriority').value = selected.priority || 3;
      document.getElementById('leaderTaskStatus').value = selected.status;
      button.textContent = 'Save task changes';
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
      let response;
      if (leaderMode) {
        response = await fetch('/.netlify/functions/task-plan-assignments', {
          method:'POST',
          headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
          body:JSON.stringify({
            action:'update_task', participant_id:participantId, plan_id:plan.id, task_id:selected.id,
            task:{
              title:document.getElementById('leaderTaskTitle').value,
              description:document.getElementById('leaderTaskDescription').value,
              start_date:document.getElementById('leaderTaskStart').value,
              due_date:document.getElementById('leaderTaskDue').value,
              priority:Number(document.getElementById('leaderTaskPriority').value),
              status:document.getElementById('leaderTaskStatus').value
            }
          })
        });
      } else {
        response = await fetch('/.netlify/functions/task-plan-progress', {
          method:'POST',
          headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
          body:JSON.stringify({ task_id:selected.id, status:selected.status === 'completed' ? 'not_started' : 'completed' })
        });
      }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save this task.');
      Object.assign(selected, data.task);
      document.getElementById('taskPlanTaskDialog').close();
      renderProgress();
      renderTasks();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }

  async function saveCustomTask() {
    const button = document.getElementById('saveCustomPlanTask');
    const message = document.getElementById('customTaskMessage');
    button.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/task-plan-assignments', {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body:JSON.stringify({
          action:'add_task', participant_id:participantId, plan_id:plan.id,
          task:{
            title:document.getElementById('customTaskTitle').value,
            description:document.getElementById('customTaskDescription').value,
            section_title:document.getElementById('customTaskSection').value,
            due_date:document.getElementById('customTaskDue').value,
            priority:Number(document.getElementById('customTaskPriority').value)
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not add this task.');
      tasks.push(data.task);
      document.getElementById('customTaskDialog').close();
      renderProgress();
      renderTasks();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }

  async function applyTemplateUpdate() {
    const summary = document.getElementById('taskPlanUpdateSummary');
    const changes = [
      `${templateDiff.added.length} added`,
      `${templateDiff.changed.length} updated`,
      `${templateDiff.removed.length} removed`
    ].join(', ');
    if (!confirm(`Apply the newer master template?\n\n${changes}\n\nCompleted work will not be overwritten.`)) return;
    const button = document.getElementById('applyTaskPlanUpdate');
    button.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/task-plan-assignments', {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ action:'apply_template_update', participant_id:participantId, plan_id:plan.id })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update this plan.');
      await loadPlan();
      render();
      summary.textContent = 'The participant plan now matches the current master template.';
    } catch (error) {
      summary.textContent = error.message;
      summary.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }

  function text(id, value) { document.getElementById(id).textContent = value; }
  function groupBy(list, key) { const map = new Map(); list.forEach(item => { const value = key(item); if (!map.has(value)) map.set(value, []); map.get(value).push(item); }); return map; }
  function short(value, max) { return value.length > max ? `${value.slice(0, max).trim()}…` : value; }
  function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }); }
  function empty(title, copy) { return `<div class="cmcTaskPlanEmpty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }
})();
