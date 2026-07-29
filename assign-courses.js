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

  if (!participantId) {
    setMessage('Choose a participant from the People page.', true);
    return;
  }

  await load();
  saveButton.addEventListener('click', save);

  async function load() {
    try {
      const response = await fetch(`/.netlify/functions/leader-course-assignments?participant_id=${encodeURIComponent(participantId)}`, {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load course assignments.');
      courses = data.courses || [];
      const participantName = data.participant?.full_name || data.participant?.email || 'this participant';
      document.getElementById('assignmentTitle').textContent = `Courses for ${firstName(participantName)}.`;
      document.getElementById('assignmentIntro').textContent = [
        data.participant?.church_name,
        data.participant?.state,
        data.participant?.region ? `Open Bible ${data.participant.region} Region` : ''
      ].filter(Boolean).join(' · ');
      render();
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

  async function save() {
    const courseIds = [...document.querySelectorAll('.cmcAssignmentCourseCard input:checked')].map(input => input.value);
    saveButton.disabled = true;
    setMessage('Saving assignments…');
    try {
      const response = await fetch('/.netlify/functions/leader-course-assignments', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ participant_id:participantId, course_ids:courseIds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save course assignments.');
      courses = data.courses || [];
      render();
      setMessage('Course assignments saved.');
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
