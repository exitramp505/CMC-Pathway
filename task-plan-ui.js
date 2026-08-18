(function taskPlanUiHelpers() {
  function flatten(items, output = []) {
    (items || []).forEach(item => {
      output.push(item);
      flatten(item.tasks || [], output);
    });
    return output;
  }

  function nestAssignedTasks(rows) {
    const copies = (rows || []).map(row => ({ ...row, tasks: [] }));
    const byId = new Map(copies.map(row => [String(row.id), row]));
    const roots = [];
    copies.forEach(row => {
      const parent = row.parent_task_id ? byId.get(String(row.parent_task_id)) : null;
      if (parent) parent.tasks.push(row);
      else roots.push(row);
    });
    const sortItems = items => {
      items.sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
      items.forEach(item => sortItems(item.tasks));
    };
    sortItems(roots);
    return roots;
  }

  function sectionsFromAssigned(rows) {
    const grouped = new Map();
    (rows || []).forEach(row => {
      const title = row.section_title || 'Task plan';
      const position = Number(row.section_position || 0);
      const key = `${position}:${title}`;
      if (!grouped.has(key)) grouped.set(key, { key, title, description: '', position, rows: [] });
      grouped.get(key).rows.push(row);
    });
    return [...grouped.values()]
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
      .map(section => ({ ...section, tasks: nestAssignedTasks(section.rows) }));
  }

  function actionable(items) {
    return flatten(items).filter(item => item.task_type !== 'group' && item.status !== 'not_applicable');
  }

  function stats(items) {
    const work = actionable(items);
    const completed = work.filter(item => item.status === 'completed').length;
    const blocked = work.filter(item => item.status !== 'completed' && (item.blocked_by_dependency || item.status === 'blocked')).length;
    return {
      total: work.length,
      completed,
      remaining: Math.max(0, work.length - completed),
      blocked,
      percent: work.length ? Math.round(completed / work.length * 100) : 0
    };
  }

  function nextTask(items) {
    const work = actionable(items).filter(item => !['completed', 'pending_review'].includes(item.status));
    return work.sort((a, b) => {
      const aBlocked = a.blocked_by_dependency || a.status === 'blocked' ? 1 : 0;
      const bBlocked = b.blocked_by_dependency || b.status === 'blocked' ? 1 : 0;
      if (aBlocked !== bBlocked) return aBlocked - bBlocked;
      if (Number(a.priority || 3) !== Number(b.priority || 3)) return Number(a.priority || 3) - Number(b.priority || 3);
      const aDate = a.due_date || '9999-12-31';
      const bDate = b.due_date || '9999-12-31';
      return String(aDate).localeCompare(String(bDate));
    })[0] || null;
  }

  function sectionKey(section, index) {
    return String(section.key || `${section.position ?? index}:${section.title || `Phase ${index + 1}`}`);
  }

  function sectionContaining(sections, taskId) {
    if (!taskId) return null;
    return (sections || []).find(section => flatten(section.tasks || []).some(task => String(task.id) === String(taskId))) || null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  }

  function outlineHtml(sections, selectedKey, options = {}) {
    return (sections || []).map((section, index) => {
      const key = sectionKey(section, index);
      const summary = stats(section.tasks || []);
      const count = options.preview
        ? `${summary.total} ${summary.total === 1 ? 'item' : 'items'}`
        : summary.total ? `${summary.completed} of ${summary.total}` : 'No tasks';
      return `<button class="cmcPlanOutlinePhase ${key === selectedKey ? 'active' : ''}" type="button" data-plan-phase="${escapeHtml(key)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(section.title)}</strong><small>${escapeHtml(count)}</small>${options.preview ? '' : `<i><b style="width:${summary.percent}%"></b></i>`}</button>`;
    }).join('');
  }

  window.cmcTaskPlanUI = {
    flatten,
    nestAssignedTasks,
    sectionsFromAssigned,
    actionable,
    stats,
    nextTask,
    sectionKey,
    sectionContaining,
    outlineHtml,
    escapeHtml
  };
})();
