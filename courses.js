(async function(){
  // Authenticate once, then overlap independent profile and course-list reads.
  // The server enforces cmc_admin permission on course-admin; never render
  // protected content until the browser has also checked the role.
  const session = await dcAuth.getCurrentSession().catch(() => null);
  if (!session?.user) {
    window.location.href = 'login.html';
    return;
  }
  const user = session.user;
  const token = session.access_token || '';
  const library = document.getElementById('courseLibrary');
  const message = document.getElementById('courseLibraryMessage');
  const profilePromise = dcAuth.getProfile(user.id).catch(() => null);
  const coursesPromise = (async () => {
    try {
      const response = await fetch('/.netlify/functions/course-admin', {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load courses.');
      return { data };
    } catch (error) {
      // Always resolve so a rejected admin fetch cannot become an unhandled
      // rejection while the profile is still being checked.
      return { error };
    }
  })();
  const profile = await profilePromise;
  if (profile?.account_role !== 'cmc_admin') {
    window.location.replace(profile?.account_role === 'regional_leader' ? 'leader.html' : 'dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'courses');

  try {
    const {data,error} = await coursesPromise;
    if (error) throw error;
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
