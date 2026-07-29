(async function(){
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (profile?.account_role !== 'cmc_admin') {
    window.location.replace(profile?.account_role === 'regional_leader' ? 'leader.html' : 'dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'courses');
  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('id') || '';
  let currentCourse = null;

  document.getElementById('addModuleBtn').addEventListener('click', () => addModule({}, { scroll:true }));
  document.getElementById('collapseAllBtn').addEventListener('click', toggleAllModules);
  document.getElementById('saveDraftBtn').addEventListener('click', () => save('draft'));
  document.getElementById('publishBtn').addEventListener('click', () => save('published'));
  document.getElementById('courseTitle').addEventListener('input', suggestSlug);
  document.getElementById('courseAccess').addEventListener('change', updateAccessHelp);

  if (courseId) await loadCourse();
  else addModule({ title:'', description:'', lessons:[{}] });

  async function loadCourse() {
    setMessage('Loading course…');
    try {
      const response = await fetch(`/.netlify/functions/course-admin?id=${encodeURIComponent(courseId)}`, {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load course.');
      currentCourse = data.course;
      document.getElementById('builderTitle').textContent = 'Edit the course.';
      setValue('courseTitle', currentCourse.title);
      setValue('courseSubtitle', currentCourse.subtitle);
      setValue('courseSlug', currentCourse.slug);
      setValue('courseDescription', currentCourse.description);
      setValue('courseStage', currentCourse.stage_key || 'discover');
      setValue('courseAccess', currentCourse.access_mode || 'assigned');
      setValue('courseMinutes', currentCourse.estimated_minutes || '');
      updateAccessHelp();
      document.getElementById('courseStatus').textContent = currentCourse.status === 'published' ? 'Published' : 'Draft';
      const preview = document.getElementById('previewCourseLink');
      preview.href = `course.html?slug=${encodeURIComponent(currentCourse.slug)}`;
      preview.classList.remove('hidden');
      document.getElementById('moduleList').innerHTML = '';
      (currentCourse.modules || []).forEach((module, index) => addModule(module, { collapsed:index > 0 }));
      if (!currentCourse.modules?.length) addModule({lessons:[{}]});
      setMessage('');
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  function addModule(data = {}, options = {}) {
    const node = document.getElementById('moduleTemplate').content.firstElementChild.cloneNode(true);
    node.dataset.id = data.id || '';
    node.querySelector('[data-module-title]').value = data.title || '';
    node.querySelector('[data-module-description]').value = data.description || '';
    node.querySelector('[data-toggle-module]').addEventListener('click', () => setCollapsed(node, !node.classList.contains('collapsed')));
    node.querySelector('[data-module-title]').addEventListener('input', () => updateModuleSummary(node));
    node.querySelector('[data-add-lesson]').addEventListener('click', () => {
      setCollapsed(node, false);
      addLesson(node, {}, { collapsed:false });
    });
    node.querySelector('[data-remove-module]').addEventListener('click', () => {
      if (document.querySelectorAll('[data-module]').length === 1) return setMessage('A course needs at least one module.', true);
      node.remove();
      renumber();
    });
    node.querySelectorAll('[data-move-module]').forEach(button => button.addEventListener('click', () => moveNode(node, button.dataset.moveModule)));
    document.getElementById('moduleList').append(node);
    (data.lessons || []).forEach((lesson, index) => addLesson(node, lesson, { collapsed:options.collapsed || index > 0 }));
    setCollapsed(node, Boolean(options.collapsed));
    renumber();
    if (options.scroll) {
      node.scrollIntoView({ behavior:'smooth', block:'center' });
      node.querySelector('[data-module-title]').focus();
    }
    return node;
  }

  function addLesson(moduleNode, data = {}, options = {}) {
    const node = document.getElementById('lessonTemplate').content.firstElementChild.cloneNode(true);
    node.dataset.id = data.id || '';
    setNodeValue(node, '[data-lesson-title]', data.title);
    setNodeValue(node, '[data-lesson-summary]', data.summary);
    setNodeValue(node, '[data-lesson-content]', data.content);
    setNodeValue(node, '[data-lesson-video]', data.video_url);
    setNodeValue(node, '[data-lesson-reflection]', data.reflection_prompt);
    setNodeValue(node, '[data-lesson-minutes]', data.estimated_minutes || '');
    node.querySelector('[data-lesson-required]').checked = data.is_required !== false;
    node.querySelector('[data-toggle-lesson]').addEventListener('click', () => setCollapsed(node, !node.classList.contains('collapsed')));
    node.querySelector('[data-lesson-title]').addEventListener('input', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-minutes]').addEventListener('input', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-required]').addEventListener('change', () => updateLessonSummary(node));
    node.querySelector('[data-remove-lesson]').addEventListener('click', () => { node.remove(); renumber(); });
    node.querySelectorAll('[data-move-lesson]').forEach(button => button.addEventListener('click', () => moveNode(node, button.dataset.moveLesson)));
    moduleNode.querySelector('[data-lesson-list]').append(node);
    setCollapsed(node, Boolean(options.collapsed));
    renumber();
    if (!options.collapsed && !data.id) node.querySelector('[data-lesson-title]').focus();
  }

  function moveNode(node, direction) {
    const sibling = direction === 'up' ? node.previousElementSibling : node.nextElementSibling;
    if (!sibling) return;
    if (direction === 'up') node.parentElement.insertBefore(node, sibling);
    else node.parentElement.insertBefore(sibling, node);
    renumber();
  }

  function renumber() {
    document.querySelectorAll('[data-module]').forEach((module, moduleIndex) => {
      module.querySelector('.cmcModuleHandle').textContent = `MODULE ${String(moduleIndex + 1).padStart(2,'0')}`;
      module.querySelectorAll('[data-lesson]').forEach((lesson, lessonIndex) => {
        lesson.querySelector('[data-lesson-number]').textContent = `Lesson ${moduleIndex + 1}.${lessonIndex + 1}`;
        updateLessonSummary(lesson);
      });
      updateModuleSummary(module);
    });
    updateCollapseAllButton();
  }

  function setCollapsed(node, collapsed) {
    node.classList.toggle('collapsed', collapsed);
    const toggle = node.matches('[data-module]')
      ? node.querySelector('[data-toggle-module]')
      : node.querySelector('[data-toggle-lesson]');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.cmcCollapseIcon').textContent = collapsed ? '+' : '−';
    updateCollapseAllButton();
  }

  function updateModuleSummary(module) {
    const title = module.querySelector('[data-module-title]').value.trim() || 'Untitled module';
    const lessonCount = module.querySelectorAll('[data-lesson]').length;
    module.querySelector('[data-module-summary]').textContent = title;
    module.querySelector('[data-module-meta]').textContent =
      lessonCount ? `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}` : 'No lessons yet';
  }

  function updateLessonSummary(lesson) {
    const title = lesson.querySelector('[data-lesson-title]').value.trim() || 'Untitled lesson';
    const minutes = Number(lesson.querySelector('[data-lesson-minutes]').value || 0);
    const required = lesson.querySelector('[data-lesson-required]').checked;
    lesson.querySelector('[data-lesson-summary-title]').textContent = title;
    lesson.querySelector('[data-lesson-meta]').textContent =
      `${required ? 'Required' : 'Optional'} · ${minutes ? `${minutes} min` : 'No time set'}`;
  }

  function toggleAllModules() {
    const modules = [...document.querySelectorAll('[data-module]')];
    const shouldCollapse = modules.some(module => !module.classList.contains('collapsed'));
    modules.forEach(module => setCollapsed(module, shouldCollapse));
    updateCollapseAllButton();
  }

  function updateCollapseAllButton() {
    const modules = [...document.querySelectorAll('[data-module]')];
    const allCollapsed = modules.length && modules.every(module => module.classList.contains('collapsed'));
    document.getElementById('collapseAllBtn').textContent = allCollapsed ? 'Expand all' : 'Collapse all';
  }

  async function save(status) {
    const form = document.getElementById('courseBuilderForm');
    if (!form.checkValidity()) {
      const invalidField = form.querySelector(':invalid');
      const invalidModule = invalidField?.closest('[data-module]');
      const invalidLesson = invalidField?.closest('[data-lesson]');
      if (invalidModule) setCollapsed(invalidModule, false);
      if (invalidLesson) setCollapsed(invalidLesson, false);
      invalidField?.focus();
      form.reportValidity();
      return;
    }
    const modules = [...document.querySelectorAll('[data-module]')].map(module => ({
      id:module.dataset.id || '',
      title:module.querySelector('[data-module-title]').value,
      description:module.querySelector('[data-module-description]').value,
      lessons:[...module.querySelectorAll('[data-lesson]')].map(lesson => ({
        id:lesson.dataset.id || '',
        title:lesson.querySelector('[data-lesson-title]').value,
        summary:lesson.querySelector('[data-lesson-summary]').value,
        content:lesson.querySelector('[data-lesson-content]').value,
        video_url:lesson.querySelector('[data-lesson-video]').value,
        reflection_prompt:lesson.querySelector('[data-lesson-reflection]').value,
        estimated_minutes:Number(lesson.querySelector('[data-lesson-minutes]').value || 0),
        is_required:lesson.querySelector('[data-lesson-required]').checked
      }))
    }));
    const payload = {
      id:currentCourse?.id || '',
      published_at:currentCourse?.published_at || null,
      title:document.getElementById('courseTitle').value,
      subtitle:document.getElementById('courseSubtitle').value,
      slug:document.getElementById('courseSlug').value,
      description:document.getElementById('courseDescription').value,
      stage_key:document.getElementById('courseStage').value,
      access_mode:document.getElementById('courseAccess').value,
      estimated_minutes:Number(document.getElementById('courseMinutes').value || 0),
      status,
      modules
    };
    setWorking(true);
    setMessage(status === 'published' ? 'Publishing course…' : 'Saving draft…');
    try {
      const response = await fetch('/.netlify/functions/course-admin', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save course.');
      currentCourse = data.course;
      history.replaceState(null, '', `course-builder.html?id=${encodeURIComponent(currentCourse.id)}`);
      document.getElementById('courseStatus').textContent = status === 'published' ? 'Published' : 'Draft';
      document.getElementById('builderTitle').textContent = 'Edit the course.';
      const preview = document.getElementById('previewCourseLink');
      preview.href = `course.html?slug=${encodeURIComponent(currentCourse.slug)}`;
      preview.classList.remove('hidden');
      document.getElementById('moduleList').innerHTML = '';
      currentCourse.modules.forEach((module, index) => addModule(module, { collapsed:index > 0 }));
      setMessage(status === 'published' ? 'Course published.' : 'Draft saved.');
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      setWorking(false);
    }
  }

  function suggestSlug() {
    if (courseId || document.getElementById('courseSlug').dataset.edited) return;
    document.getElementById('courseSlug').value = document.getElementById('courseTitle').value
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
  }
  document.getElementById('courseSlug').addEventListener('input', event => { event.currentTarget.dataset.edited = 'true'; });
  function updateAccessHelp() {
    const automatic = document.getElementById('courseAccess').value === 'automatic';
    document.getElementById('courseAccessHelp').textContent = automatic
      ? 'The course will appear automatically for every current and future participant once published.'
      : 'The course stays hidden until a regional or national leader assigns it to a participant.';
  }
  function setWorking(value){document.getElementById('saveDraftBtn').disabled=value;document.getElementById('publishBtn').disabled=value}
  function setMessage(value,error){const el=document.getElementById('builderMessage');el.textContent=value||'';el.classList.toggle('error',Boolean(error))}
  function setValue(id,value){document.getElementById(id).value=value||''}
  function setNodeValue(node,selector,value){node.querySelector(selector).value=value||''}
})();
