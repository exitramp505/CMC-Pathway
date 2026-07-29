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
  let courseId = params.get('id') || '';
  let currentCourse = null;
  let autosaveTimer = 0;
  let saveInFlight = false;
  let autosaveQueued = false;
  let isHydrating = true;
  let lastSavedSignature = '';

  document.getElementById('addModuleBtn').addEventListener('click', () => {
    addModule({}, { scroll:true });
    queueAutosave();
  });
  document.getElementById('collapseAllBtn').addEventListener('click', toggleAllModules);
  document.getElementById('courseDetailsToggle').addEventListener('click', toggleCourseDetails);
  document.getElementById('publishBtn').addEventListener('click', () => save('published'));
  document.getElementById('courseTitle').addEventListener('input', suggestSlug);
  document.getElementById('courseAccess').addEventListener('change', updateAccessHelp);
  document.getElementById('courseBuilderForm').addEventListener('input', handleBuilderChange);
  document.getElementById('courseBuilderForm').addEventListener('change', handleBuilderChange);

  if (courseId) await loadCourse();
  else addModule({ title:'', description:'', lessons:[{}] });
  isHydrating = false;
  updateCourseDetailsSummary();
  lastSavedSignature = currentCourse ? JSON.stringify(buildPayload(currentCourse.status)) : '';
  setAutosaveStatus(currentCourse ? 'All changes saved' : 'Autosave starts when you begin typing');

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
      document.getElementById('courseSlug').dataset.generatedDraft = String(currentCourse.slug || '').startsWith('draft-') ? 'true' : '';
      setValue('courseDescription', currentCourse.description);
      setValue('courseStage', currentCourse.stage_key || 'discover');
      setValue('courseAccess', currentCourse.access_mode || 'assigned');
      setValue('courseMinutes', currentCourse.estimated_minutes || '');
      updateAccessHelp();
      document.getElementById('courseStatus').textContent = currentCourse.status === 'published' ? 'Published' : 'Draft';
      const preview = document.getElementById('previewCourseLink');
      preview.href = previewUrl(currentCourse.slug);
      preview.classList.remove('hidden');
      document.getElementById('moduleList').innerHTML = '';
      (currentCourse.modules || []).forEach((module, index) => addModule(module, { collapsed:index > 0 }));
      if (!currentCourse.modules?.length) addModule({lessons:[{}]});
      updateCourseDetailsSummary();
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
      queueAutosave();
    });
    node.querySelector('[data-remove-module]').addEventListener('click', () => {
      if (document.querySelectorAll('[data-module]').length === 1) return setMessage('A course needs at least one module.', true);
      node.remove();
      renumber();
      queueAutosave();
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
    setNodeValue(node, '[data-lesson-type]', data.lesson_type || 'article');
    setNodeValue(node, '[data-lesson-content]', data.content);
    setNodeValue(node, '[data-lesson-video]', data.video_url);
    setNodeValue(node, '[data-lesson-image]', data.image_url);
    setNodeValue(node, '[data-lesson-image-alt]', data.image_alt);
    setNodeValue(node, '[data-lesson-resource]', data.resource_url);
    setNodeValue(node, '[data-lesson-resource-label]', data.resource_label);
    setNodeValue(node, '[data-lesson-reflection]', data.reflection_prompt);
    setNodeValue(node, '[data-lesson-minutes]', data.estimated_minutes || '');
    node.querySelector('[data-lesson-required]').checked = data.is_required !== false;
    node.querySelector('[data-lesson-response]').checked = data.response_required === true;
    node.querySelector('[data-toggle-lesson]').addEventListener('click', () => setCollapsed(node, !node.classList.contains('collapsed')));
    node.querySelector('[data-lesson-title]').addEventListener('input', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-type]').addEventListener('change', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-minutes]').addEventListener('input', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-required]').addEventListener('change', () => updateLessonSummary(node));
    node.querySelector('[data-lesson-response]').addEventListener('change', () => updateLessonSummary(node));
    node.querySelector('[data-remove-lesson]').addEventListener('click', () => {
      node.remove();
      renumber();
      queueAutosave();
    });
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
    queueAutosave();
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
    const type = selectedNodeLabel(lesson, '[data-lesson-type]') || 'Article';
    const minutes = Number(lesson.querySelector('[data-lesson-minutes]').value || 0);
    const required = lesson.querySelector('[data-lesson-required]').checked;
    const response = lesson.querySelector('[data-lesson-response]').checked;
    lesson.querySelector('[data-lesson-summary-title]').textContent = title;
    lesson.querySelector('[data-lesson-meta]').textContent =
      `${type} · ${required ? 'Required' : 'Optional'} · ${minutes ? `${minutes} min` : 'No time set'}${response ? ' · Response' : ''}`;
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

  function toggleCourseDetails() {
    setCourseDetailsCollapsed(!document.getElementById('courseDetailsPanel').classList.contains('collapsed'));
  }

  function setCourseDetailsCollapsed(collapsed) {
    const panel = document.getElementById('courseDetailsPanel');
    panel.classList.toggle('collapsed', collapsed);
    const toggle = document.getElementById('courseDetailsToggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.cmcCollapseIcon').textContent = collapsed ? '+' : '−';
  }

  function updateCourseDetailsSummary() {
    const title = document.getElementById('courseTitle').value.trim() || 'Untitled course';
    const stage = selectedLabel('courseStage');
    const access = selectedLabel('courseAccess');
    document.getElementById('courseDetailsSummary').textContent = title;
    document.getElementById('courseDetailsMeta').textContent =
      stage && access ? `${stage} · ${access}` : 'Choose a pathway stage and availability';
  }

  function selectedLabel(id) {
    const select = document.getElementById(id);
    return select.value ? select.options[select.selectedIndex]?.textContent.trim() : '';
  }

  function selectedNodeLabel(node, selector) {
    const select = node.querySelector(selector);
    return select?.options?.[select.selectedIndex]?.textContent.trim() || '';
  }

  function handleBuilderChange() {
    updateCourseDetailsSummary();
    queueAutosave();
  }

  function queueAutosave() {
    if (isHydrating) return;
    clearTimeout(autosaveTimer);
    setAutosaveStatus('Changes waiting to save…');
    autosaveTimer = window.setTimeout(runAutosave, 1200);
  }

  async function runAutosave() {
    if (saveInFlight) {
      autosaveQueued = true;
      return;
    }
    const status = currentCourse?.status === 'published' ? 'published' : 'draft';
    const payload = buildPayload(status);
    if (!hasStartedWriting()) {
      setAutosaveStatus('Autosave ready');
      return;
    }
    const signature = JSON.stringify(payload);
    if (signature === lastSavedSignature) {
      setAutosaveStatus('All changes saved');
      return;
    }
    await save(status, { automatic:true });
  }

  function hasStartedWriting() {
    if (document.getElementById('courseTitle').value.trim()) return true;
    return [...document.querySelectorAll('[data-module-title],[data-lesson-title]')]
      .some(input => input.value.trim());
  }

  function buildPayload(status) {
    const modules = [...document.querySelectorAll('[data-module]')].map(module => ({
      id:module.dataset.id || '',
      title:module.querySelector('[data-module-title]').value,
      description:module.querySelector('[data-module-description]').value,
      lessons:[...module.querySelectorAll('[data-lesson]')].map(lesson => ({
        id:lesson.dataset.id || '',
        title:lesson.querySelector('[data-lesson-title]').value,
        summary:lesson.querySelector('[data-lesson-summary]').value,
        lesson_type:lesson.querySelector('[data-lesson-type]').value,
        content:lesson.querySelector('[data-lesson-content]').value,
        video_url:lesson.querySelector('[data-lesson-video]').value,
        image_url:lesson.querySelector('[data-lesson-image]').value,
        image_alt:lesson.querySelector('[data-lesson-image-alt]').value,
        resource_url:lesson.querySelector('[data-lesson-resource]').value,
        resource_label:lesson.querySelector('[data-lesson-resource-label]').value,
        reflection_prompt:lesson.querySelector('[data-lesson-reflection]').value,
        response_required:lesson.querySelector('[data-lesson-response]').checked,
        estimated_minutes:Number(lesson.querySelector('[data-lesson-minutes]').value || 0),
        is_required:lesson.querySelector('[data-lesson-required]').checked
      }))
    }));
    return {
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
  }

  function syncSavedIds(savedCourse) {
    const moduleNodes = [...document.querySelectorAll('[data-module]')];
    moduleNodes.forEach((moduleNode, moduleIndex) => {
      const savedModule = savedCourse.modules?.[moduleIndex];
      if (!savedModule) return;
      moduleNode.dataset.id = savedModule.id || '';
      [...moduleNode.querySelectorAll('[data-lesson]')].forEach((lessonNode, lessonIndex) => {
        lessonNode.dataset.id = savedModule.lessons?.[lessonIndex]?.id || '';
      });
    });
  }

  async function save(status, options = {}) {
    const form = document.getElementById('courseBuilderForm');
    const requiresCompleteCourse = status === 'published' && !options.automatic;
    if (requiresCompleteCourse && !form.checkValidity()) {
      const invalidField = form.querySelector(':invalid');
      const invalidModule = invalidField?.closest('[data-module]');
      const invalidLesson = invalidField?.closest('[data-lesson]');
      if (invalidField?.closest('#courseDetailsPanel')) setCourseDetailsCollapsed(false);
      if (invalidModule) setCollapsed(invalidModule, false);
      if (invalidLesson) setCollapsed(invalidLesson, false);
      invalidField?.focus();
      form.reportValidity();
      return false;
    }
    if (saveInFlight) {
      autosaveQueued = true;
      return false;
    }
    saveInFlight = true;
    const payload = buildPayload(status);
    payload.autosave = Boolean(options.automatic);
    setWorking(true);
    if (options.automatic) setAutosaveStatus('Saving changes…');
    else setMessage(status === 'published' ? 'Publishing course…' : 'Saving draft…');
    try {
      const response = await fetch('/.netlify/functions/course-admin', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save course.');
      currentCourse = data.course;
      courseId = currentCourse.id;
      document.getElementById('courseSlug').value = currentCourse.slug;
      document.getElementById('courseSlug').dataset.generatedDraft =
        String(currentCourse.slug || '').startsWith('draft-') ? 'true' : '';
      history.replaceState(null, '', `course-builder.html?id=${encodeURIComponent(currentCourse.id)}`);
      document.getElementById('courseStatus').textContent = status === 'published' ? 'Published' : 'Draft';
      document.getElementById('builderTitle').textContent = 'Edit the course.';
      const preview = document.getElementById('previewCourseLink');
      preview.href = previewUrl(currentCourse.slug);
      preview.classList.remove('hidden');
      if (options.automatic) {
        syncSavedIds(currentCourse);
      } else {
        isHydrating = true;
        document.getElementById('moduleList').innerHTML = '';
        currentCourse.modules.forEach((module, index) => addModule(module, { collapsed:index > 0 }));
        isHydrating = false;
        setMessage(status === 'published' ? 'Course published.' : 'Draft saved.');
      }
      lastSavedSignature = JSON.stringify(buildPayload(currentCourse.status));
      updateCourseDetailsSummary();
      setAutosaveStatus('All changes saved');
      return true;
    } catch (error) {
      if (options.automatic) setAutosaveStatus('Autosave paused. Keep editing to retry.', true);
      else setMessage(error.message, true);
      return false;
    } finally {
      saveInFlight = false;
      setWorking(false);
      if (autosaveQueued) {
        autosaveQueued = false;
        queueAutosave();
      }
    }
  }

  function suggestSlug() {
    const slugInput = document.getElementById('courseSlug');
    if ((courseId && slugInput.dataset.generatedDraft !== 'true') || slugInput.dataset.edited) return;
    slugInput.value = document.getElementById('courseTitle').value
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
  }
  function previewUrl(slug) {
    return `course.html?slug=${encodeURIComponent(slug)}&preview=1`;
  }
  document.getElementById('courseSlug').addEventListener('input', event => { event.currentTarget.dataset.edited = 'true'; });
  function updateAccessHelp() {
    const automatic = document.getElementById('courseAccess').value === 'automatic';
    document.getElementById('courseAccessHelp').textContent = automatic
      ? 'The course will appear automatically for every current and future participant once published.'
      : 'The course stays hidden until a regional or national leader assigns it to a participant.';
  }
  function setWorking(value){document.getElementById('publishBtn').disabled=value}
  function setMessage(value,error){const el=document.getElementById('builderMessage');el.textContent=value||'';el.classList.toggle('error',Boolean(error))}
  function setAutosaveStatus(value,error){const el=document.getElementById('autosaveStatus');el.textContent=value;el.classList.toggle('error',Boolean(error))}
  function setValue(id,value){document.getElementById(id).value=value||''}
  function setNodeValue(node,selector,value){node.querySelector(selector).value=value||''}
})();
