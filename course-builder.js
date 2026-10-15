(async function(){
  window.CMCBuilderUI?.initShell({ shellId:'courseBuilderShell', toggleId:'courseBuilderSidebarToggle', storageKey:'cmcCourseBuilderSidebarCollapsed' });
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
  const draftCourseId = window.crypto.randomUUID();
  let lastSavedPayload = null;
  let saveBlocked = false;
  let publishQueued = false;
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
  document.getElementById('reloadCourseBtn').addEventListener('click', () => {
    if (window.confirm('Reload the latest saved course? Unsaved edits in this tab will be lost. Copy important text before continuing.')) {
      window.location.reload();
    }
  });
  document.getElementById('courseTitle').addEventListener('input', suggestSlug);
  document.getElementById('courseAccess').addEventListener('change', updateAccessHelp);
  document.getElementById('courseBuilderForm').addEventListener('input', handleBuilderChange);
  document.getElementById('courseBuilderForm').addEventListener('change', handleBuilderChange);

  if (courseId) await loadCourse();
  else addModule({ title:'', description:'', lessons:[{}] });
  isHydrating = false;
  updateCourseDetailsSummary();
  refreshBuilderSidebar();
  // The placeholder module shown for a truly empty existing course has not
  // been stored. Keep the server snapshot empty so the first edit inserts it.
  lastSavedPayload = currentCourse ? buildPayload(currentCourse.status) : null;
  if (lastSavedPayload && !(currentCourse.modules || []).length) {
    lastSavedPayload.modules = [];
  }
  lastSavedSignature = lastSavedPayload ? JSON.stringify(lastSavedPayload) : '';
  if (!saveBlocked) setAutosaveStatus(currentCourse ? 'All changes saved' : 'Autosave starts when you begin typing');

  async function loadCourse() {
    setMessage('Loading course…');
    try {
      const response = await fetch(`/.netlify/functions/course-admin?id=${encodeURIComponent(courseId)}`, {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load course.');
      currentCourse = data.course;
      if (currentCourse.save_revision === undefined || currentCourse.save_revision === null ||
          !Number.isSafeInteger(Number(currentCourse.save_revision))) {
        throw new Error('Safe Course Builder saving is not enabled yet. A database update is required.');
      }
      document.getElementById('builderTitle').textContent = 'Edit the course.';
      setValue('courseTitle', currentCourse.title);
      setValue('courseSubtitle', currentCourse.subtitle);
      setValue('courseSlug', currentCourse.slug);
      document.getElementById('courseSlug').dataset.generatedDraft = String(currentCourse.slug || '').startsWith('draft-') ? 'true' : '';
      setValue('courseDescription', currentCourse.description);
      setValue('courseStage', currentCourse.stage_key || 'discover');
      setValue('courseAccess', currentCourse.access_mode || 'assigned');
      setValue('courseNavigation', currentCourse.navigation_mode || 'open');
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
      refreshBuilderSidebar();
      setMessage('');
    } catch (error) {
      saveBlocked = true;
      setMessage(error.message, true);
      setAutosaveStatus('Course could not be loaded. Saving is paused.', true);
    }
  }

  function addModule(data = {}, options = {}) {
    const node = document.getElementById('moduleTemplate').content.firstElementChild.cloneNode(true);
    node.dataset.id = data.id || newUuid();
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
    node.dataset.id = data.id || newUuid();
    setNodeValue(node, '[data-lesson-title]', data.title);
    setNodeValue(node, '[data-lesson-summary]', data.summary);
    node._legacyType = data.lesson_type || 'article';
    node._savedStoredContent = data.content || '';
    let savedBody = data.content || '';
    try {
      savedBody = CMCLessonContent.lessonBody(data.content);
      node._initialFormats = CMCLessonContent.lessonFormats(data.content, data);
    } catch (_) {
      node._initialFormats = [node._legacyType];
    }
    node.querySelectorAll('[data-lesson-format]').forEach(checkbox => {
      checkbox.checked = node._initialFormats.includes(checkbox.value);
      checkbox.addEventListener('change', () => {
        if (!selectedLessonFormats(node).length) {
          checkbox.checked = true;
          return setMessage('Choose at least one lesson format.', true);
        }
        setMessage('');
        updateLessonSummary(node);
      });
    });
    initLessonEditor(node, savedBody);
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


  function initLessonEditor(node, savedContent) {
    const element = node.querySelector('[data-lesson-content]');
    node._savedContent = savedContent;
    node._richDirty = false;
    if (typeof Quill !== 'function' || !window.CMCLessonContent) {
      const fallback = document.createElement('textarea');
      fallback.rows = 10;
      fallback.value = savedContent;
      fallback.className = 'cmcRichFallback';
      element.replaceWith(fallback);
      fallback.setAttribute('data-lesson-content', '');
      fallback.addEventListener('input', queueAutosave);
      return;
    }
    const quill = new Quill(element, {
      theme:'snow',
      placeholder:'Start writing or paste your formatted lesson here…',
      modules:{
        toolbar:[
          [{header:[false,2,3,4]}],
          ['bold','italic','underline'],
          [{list:'ordered'},{list:'bullet'}],
          ['blockquote','link','image'],
          ['clean']
        ],
        history:{delay:700,maxStack:100,userOnly:true}
      },
      formats:['header','bold','italic','underline','list','blockquote','link','image','indent']
    });
    node._quill = quill;
    if (savedContent) {
      try {
        if (CMCLessonContent.isRichText(savedContent)) quill.setContents(CMCLessonContent.readDelta(savedContent), 'silent');
        else quill.clipboard.dangerouslyPasteHTML(CMCLessonContent.renderMarkdown(savedContent), 'silent');
      } catch (error) {
        quill.setText('This lesson could not be loaded. Please contact an administrator.', 'silent');
      }
    }
    quill.on('text-change', function (_delta, _old, source) {
      if (source === 'silent') return;
      node._richDirty = true;
      queueAutosave();
    });
  }

  function getLessonContent(node) {
    if (node._quill) {
      if (!node._richDirty) return node._savedContent;
      return CMCLessonContent.serializeDelta(node._quill.getContents().ops);
    }
    return node.querySelector('[data-lesson-content]').value;
  }

  function selectedLessonFormats(node) {
    return [...node.querySelectorAll('[data-lesson-format]:checked')].map(checkbox => checkbox.value);
  }

  function sameFormats(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function getStoredLessonContent(node) {
    const body = getLessonContent(node);
    const formats = selectedLessonFormats(node);
    if (body === node._savedContent && sameFormats(formats, node._initialFormats)) {
      return node._savedStoredContent;
    }
    if (CMCLessonContent.isLessonEnvelope(node._savedStoredContent)
        || !sameFormats(formats, node._initialFormats)) {
      return CMCLessonContent.serializeLesson(formats, body);
    }
    return body;
  }

  function legacyLessonType(node) {
    const formats = selectedLessonFormats(node);
    if (formats.includes(node._legacyType)) return node._legacyType;
    return formats.find(format => format !== 'image') || 'article';
  }

  function saveEditorSnapshot(payload) {
    // A lesson can move while a save is in flight. Match stable IDs rather
    // than indexes to avoid falsely marking a different lesson as saved.
    const savedById = new Map((payload.modules || [])
      .flatMap(module => module.lessons || [])
      .map(lesson => [lesson.id, lesson]));
    document.querySelectorAll('[data-lesson]').forEach(node => {
      const saved = savedById.get(node.dataset.id);
      if (!saved || getStoredLessonContent(node) !== saved.content) return;
      node._savedStoredContent = saved.content;
      node._savedContent = CMCLessonContent.lessonBody(saved.content);
      node._initialFormats = selectedLessonFormats(node);
      node._legacyType = saved.lesson_type;
      node._richDirty = false;
    });
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
    refreshBuilderSidebar();
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
    const names = {article:'Written', video:'Video', image:'Image', reflection:'Reflection', resource:'Resource'};
    const type = selectedLessonFormats(lesson).map(format => names[format]).join(' + ') || 'Written';
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
    const navigation = selectedLabel('courseNavigation');
    document.getElementById('courseDetailsSummary').textContent = title;
    document.getElementById('courseDetailsMeta').textContent =
      stage && access && navigation
        ? `${stage} · ${access} · ${navigation.split('·')[0].trim()}`
        : 'Choose a pathway stage, availability, and lesson order';
    refreshBuilderSidebar();
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
    refreshBuilderSidebar();
    queueAutosave();
  }

  function refreshBuilderSidebar() {
    const title = document.getElementById('courseTitle')?.value.trim() || currentCourse?.title || 'Untitled course';
    const description = document.getElementById('courseSubtitle')?.value.trim() || document.getElementById('courseDescription')?.value.trim() || 'Add course details and begin building the lesson outline.';
    const modules = [...document.querySelectorAll('[data-module]')];
    const lessons = [...document.querySelectorAll('[data-lesson]')];
    const minutes = lessons.reduce((total, lesson) => total + Number(lesson.querySelector('[data-lesson-minutes]')?.value || 0), 0);
    const stage = selectedLabel('courseStage') || 'No stage';
    setText('courseSidebarTitle', title);
    setText('courseSidebarDescription', description);
    setText('courseSidebarCount', `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`);
    setText('courseSidebarMeta', `${modules.length} ${modules.length === 1 ? 'module' : 'modules'} · ${minutes ? `${minutes} min · ` : ''}${stage} · ${currentCourse?.status === 'published' ? 'Published' : 'Draft'}`);
    setText('courseBuilderRailStatus', `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`);
    const outline = document.getElementById('courseBuilderOutline');
    if (!outline) return;
    outline.innerHTML = modules.map((module, index) => {
      const moduleTitle = module.querySelector('[data-module-title]')?.value.trim() || `Untitled module ${index + 1}`;
      const count = module.querySelectorAll('[data-lesson]').length;
      return `<button type="button" data-builder-module="${index}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(moduleTitle)}</strong><small>${count} ${count === 1 ? 'lesson' : 'lessons'}</small></button>`;
    }).join('') || '<p class="cmcBuilderOutlineEmpty">Add a module to begin.</p>';
    outline.querySelectorAll('[data-builder-module]').forEach(button => button.addEventListener('click', () => {
      const module = modules[Number(button.dataset.builderModule)];
      if (!module) return;
      setCollapsed(module, false);
      module.scrollIntoView({ behavior:'smooth', block:'start' });
    }));
  }

  function setText(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character])); }

  function queueAutosave() {
    if (isHydrating || saveBlocked) return;
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
    let payload;
    try { payload = buildPayload(status); }
    catch (error) { setAutosaveStatus(error.message, true); return; }
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

  function newUuid() { return window.crypto.randomUUID(); }

  function buildPayload(status) {
    const modules = [...document.querySelectorAll('[data-module]')].map(module => ({
      id:module.dataset.id || '',
      title:module.querySelector('[data-module-title]').value,
      description:module.querySelector('[data-module-description]').value,
      lessons:[...module.querySelectorAll('[data-lesson]')].map(lesson => ({
        id:lesson.dataset.id || '',
        title:lesson.querySelector('[data-lesson-title]').value,
        summary:lesson.querySelector('[data-lesson-summary]').value,
        lesson_type:legacyLessonType(lesson),
        content:getStoredLessonContent(lesson),
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
      id:currentCourse?.id || draftCourseId,
      published_at:currentCourse?.published_at || null,
      title:document.getElementById('courseTitle').value,
      subtitle:document.getElementById('courseSubtitle').value,
      slug:document.getElementById('courseSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'draft-' + draftCourseId.slice(0,12),
      description:document.getElementById('courseDescription').value,
      stage_key:document.getElementById('courseStage').value || 'discover',
      access_mode:document.getElementById('courseAccess').value || 'assigned',
      navigation_mode:document.getElementById('courseNavigation').value,
      estimated_minutes:Number(document.getElementById('courseMinutes').value || 0),
      status,
      modules
    };
  }

  async function save(status, options = {}) {
    if (saveBlocked) {
      setAutosaveStatus('Saving is paused to protect your edits. Please reload after copying any unsaved text.', true);
      return false;
    }
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
      if (options.automatic) autosaveQueued = true;
      else publishQueued = true;
      return false;
    }
    let payload, patch;
    try {
      payload = buildPayload(status);
      patch = CMCCoursePatch.diff(lastSavedPayload, payload, currentCourse?.save_revision ?? 0);
    } catch (error) {
      setAutosaveStatus(error.message, true);
      return false;
    }
    if (!CMCCoursePatch.hasChanges(patch)) {
      if (status === 'published' && !options.automatic) setMessage('Course is already published.');
      setAutosaveStatus('All changes saved');
      return true;
    }
    saveInFlight = true;
    setWorking(true);
    if (options.automatic) setAutosaveStatus('Saving changes…');
    else setMessage(status === 'published' ? 'Publishing course…' : 'Saving draft…');

    try {
      const response = await fetch('/.netlify/functions/course-admin', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:'Bearer ' + token},
        body:JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        const error = new Error(data.error || 'Could not save course.');
        error.statusCode = response.status;
        throw error;
      }
      const saved = data.course;
      if (!saved?.id || saved.save_revision === undefined || saved.save_revision === null ||
          !Number.isSafeInteger(Number(saved.save_revision))) {
        throw new Error('The server did not confirm a safe save.');
      }

      // Only a successful database transaction advances the revision/snapshot.
      currentCourse = { ...(currentCourse || {}), ...saved };
      courseId = currentCourse.id;
      lastSavedPayload = payload;
      lastSavedSignature = JSON.stringify(payload);
      saveEditorSnapshot(payload);
      const slugElement = document.getElementById('courseSlug');
      if (!slugElement.value.trim() || slugElement.value.trim() === payload.slug) {
        slugElement.value = currentCourse.slug;
      }
      slugElement.dataset.generatedDraft =
        String(currentCourse.slug || '').startsWith('draft-') ? 'true' : '';
      history.replaceState(null, '', 'course-builder.html?id=' + encodeURIComponent(currentCourse.id));
      document.getElementById('courseStatus').textContent = currentCourse.status === 'published' ? 'Published' : 'Draft';
      document.getElementById('builderTitle').textContent = 'Edit the course.';
      const preview = document.getElementById('previewCourseLink');
      preview.href = previewUrl(currentCourse.slug);
      preview.classList.remove('hidden');
      if (!options.automatic) setMessage(status === 'published' ? 'Course published.' : 'Draft saved.');
      updateCourseDetailsSummary();

      if (JSON.stringify(buildPayload(currentCourse.status)) !== lastSavedSignature) autosaveQueued = true;
      setAutosaveStatus(autosaveQueued ? 'More changes waiting to save…' : 'All changes saved');
      return true;
    } catch (error) {
      const conflict = error.statusCode === 409;
      const unready = error.statusCode === 503 || error.statusCode === 428;
      if (conflict || unready) {
        saveBlocked = true;
        clearTimeout(autosaveTimer);
        if (conflict) document.getElementById('reloadCourseBtn').classList.remove('hidden');
      }
      const message = error.message || 'Save failed. Your unsaved edits remain in this browser.';
      setAutosaveStatus(message, true);
      if (!options.automatic) setMessage(message, true);
      return false;
    } finally {
      saveInFlight = false;
      setWorking(false);
      if (!saveBlocked && publishQueued) {
        publishQueued = false;
        await save('published');
      } else if (!saveBlocked && autosaveQueued) {
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
