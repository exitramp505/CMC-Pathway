(async function(){
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (!['regional_leader','cmc_admin'].includes(profile?.account_role)) {
    window.location.replace('dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'people');

  const participantId = new URLSearchParams(window.location.search).get('participant') || '';
  const list = document.getElementById('courseAssignmentList');
  const message = document.getElementById('courseAssignmentMessage');
  const saveButton = document.getElementById('saveCourseAssignments');
  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  let courses = [];
  let participant = null;
  let pathwayItems = [];

  if (!participantId) {
    setMessage('Choose a participant from the People page.', true);
    return;
  }

  await load();
  saveButton.addEventListener('click', save);

  async function load() {
    try {
      const [courseResponse, pathwayResponse] = await Promise.all([
        fetch(`/.netlify/functions/leader-course-assignments?participant_id=${encodeURIComponent(participantId)}`, {
          headers:{ Authorization:`Bearer ${token}` }
        }),
        fetch(`/.netlify/functions/participant-manage?participant_id=${encodeURIComponent(participantId)}`, {
          headers:{ Authorization:`Bearer ${token}` }
        })
      ]);
      const data = await courseResponse.json().catch(() => ({}));
      const pathwayData = await pathwayResponse.json().catch(() => ({}));
      if (!courseResponse.ok || !data.ok) throw new Error(data.error || 'Could not load course assignments.');
      if (!pathwayResponse.ok || !pathwayData.ok) throw new Error(pathwayData.error || 'Could not load pathway assignments.');
      courses = data.courses || [];
      pathwayItems = pathwayData.pathway_items || [];
      participant = pathwayData.participant || data.participant || {};
      const participantName = participant.full_name || participant.email || 'this participant';
      document.getElementById('assignmentTitle').textContent = `Pathway for ${firstName(participantName)}.`;
      document.getElementById('assignmentIntro').textContent = [
        data.participant?.church_name,
        data.participant?.state,
        data.participant?.region ? `Open Bible ${data.participant.region} Region` : ''
      ].filter(Boolean).join(' · ');
      const currentStage = participant.current_stage || 'discover';
      const stageInput = document.querySelector(`input[name="current_stage"][value="${currentStage}"]`);
      if (stageInput) stageInput.checked = true;
      render();
      renderPathwayItems();
      saveButton.disabled = false;
      setMessage('');
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  function render() {
    if (!courses.length) {
      list.innerHTML = '<div class="cmcCourseAssignmentEmpty"><strong>No leader-assigned courses are published yet.</strong><p>Create or publish a course with “Assigned by a regional leader” selected.</p></div>';
      return;
    }
    const stages = ['discover','discern','develop','deploy'];
    list.innerHTML = stages.map(stage => {
      const stageCourses = courses.filter(course => course.stage_key === stage);
      if (!stageCourses.length) return '';
      return `<section class="cmcAssignmentStage">
        <div class="cmcAssignmentStageLabel"><span>${stageNumber(stage)}</span><strong>${titleCase(stage)}</strong></div>
        <div class="cmcAssignmentCourseGrid">${stageCourses.map(course => `
          <label class="cmcAssignmentCourseCard">
            <input type="checkbox" value="${escapeHtml(course.id)}"${course.assigned ? ' checked' : ''}>
            <span class="cmcAssignmentCourseCheck" aria-hidden="true">✓</span>
            <span>
              <strong>${escapeHtml(course.title)}</strong>
              <small>${escapeHtml(course.subtitle || course.description || 'Course details')}</small>
              ${course.assigned && course.progress ? `<em>${course.progress}% complete</em>` : ''}
            </span>
          </label>`).join('')}</div>
      </section>`;
    }).join('');
  }

  function renderPathwayItems() {
    const container = document.getElementById('pathwayItemAssignmentList');
    container.innerHTML = pathwayItems.map(item => `
      <label class="cmcAssignmentCourseCard cmcLightAssignmentCard">
        <input type="checkbox" value="${escapeHtml(item.key)}"${item.assigned ? ' checked' : ''}${item.automatic ? ' disabled' : ''}>
        <span class="cmcAssignmentCourseCheck" aria-hidden="true">✓</span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.description)}</small>
          ${item.completed ? '<em>Completed</em>' : item.progress ? `<em>${item.progress}% complete</em>` : item.automatic ? '<em>Available automatically</em>' : ''}
        </span>
      </label>`).join('');
  }

  async function save() {
    const courseIds = [...document.querySelectorAll('#courseAssignmentList input:checked')].map(input => input.value);
    const pathwayItemKeys = [...document.querySelectorAll('#pathwayItemAssignmentList input:checked')].map(input => input.value);
    const currentStage = document.querySelector('input[name="current_stage"]:checked')?.value || 'discover';
    saveButton.disabled = true;
    setMessage('Saving pathway…');
    try {
      const [courseResponse, stageResponse, itemResponse] = await Promise.all([
        fetch('/.netlify/functions/leader-course-assignments', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({ participant_id:participantId, course_ids:courseIds })
        }),
        fetch('/.netlify/functions/participant-manage', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({
            action:'update_stage',
            participant_id:participantId,
            current_stage:currentStage
          })
        }),
        fetch('/.netlify/functions/participant-manage', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:JSON.stringify({
            action:'update_assignments',
            participant_id:participantId,
            item_keys:pathwayItemKeys
          })
        })
      ]);
      const courseData = await courseResponse.json().catch(() => ({}));
      const stageData = await stageResponse.json().catch(() => ({}));
      const itemData = await itemResponse.json().catch(() => ({}));
      if (!courseResponse.ok || !courseData.ok) {
        throw new Error(courseData.error || 'Could not save course assignments.');
      }
      if (!stageResponse.ok || !stageData.ok) {
        throw new Error(stageData.error || 'Could not save the pathway stage.');
      }
      if (!itemResponse.ok || !itemData.ok) {
        throw new Error(itemData.error || 'Could not save forms and assessments.');
      }
      courses = courseData.courses || [];
      participant = { ...participant, ...stageData.participant };
      render();
      setMessage('Pathway saved.');
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  function stageNumber(stage){return {discover:'01',discern:'02',develop:'03',deploy:'04'}[stage] || ''}
  function firstName(value){return String(value||'').trim().split(/\s+/)[0] || 'this participant'}
  function titleCase(value){return String(value||'').replace(/\b\w/g,c=>c.toUpperCase())}
  function setMessage(value,error){message.textContent=value||'';message.classList.toggle('error',Boolean(error))}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
})();
