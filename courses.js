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
  const library = document.getElementById('courseLibrary');
  const message = document.getElementById('courseLibraryMessage');

  try {
    const response = await fetch('/.netlify/functions/course-admin', {
      headers:{ Authorization:`Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load courses.');
    message.textContent = '';
    library.innerHTML = data.courses.length ? data.courses.map(courseCard).join('') :
      '<div class="cmcCourseEmpty"><strong>No courses yet.</strong><p>Create the first course to begin.</p></div>';
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
  }

  function courseCard(course) {
    const published = course.status === 'published';
    return `<article class="cmcCourseAdminCard">
      <div class="cmcCourseCardTop">
        <span class="cmcCourseStatus ${published ? 'published' : 'draft'}">${published ? 'Published' : 'Draft'}</span>
        <span>${formatDate(course.updated_at)}</span>
      </div>
      <div>
        <p class="cmcEyebrow">${escapeHtml(course.slug)}</p>
        <h3>${escapeHtml(course.title)}</h3>
        <p>${escapeHtml(course.subtitle || course.description || 'Course description has not been added.')}</p>
        <div class="cmcCourseRules">
          <span>${escapeHtml(titleCase(course.stage_key || 'discover'))}</span>
          <span>${course.access_mode === 'automatic' ? 'All participants' : 'Leader assigned'}</span>
        </div>
      </div>
      <div class="cmcCourseCardActions">
        <a href="course-builder.html?id=${encodeURIComponent(course.id)}">Edit course</a>
        <a href="course.html?slug=${encodeURIComponent(course.slug)}">Preview →</a>
      </div>
    </article>`;
  }
  function formatDate(value){try{return new Date(value).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}catch(_){return ''}}
  function titleCase(value){return String(value||'').replace(/\b\w/g,c=>c.toUpperCase())}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
})();
