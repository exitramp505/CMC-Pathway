(async function(){
  const user = await dcAuth.requireUser();
  if (!user) return;
  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  dcAuth.renderRoleNavigation(profile, 'pathway');
  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  const search = new URLSearchParams(window.location.search);
  const slug = search.get('slug') || 'discover';
  const previewMode = search.get('preview') === '1';
  const app = document.getElementById('courseApp');
  let course;
  let lessons = [];
  let currentIndex = 0;

  try {
    const response = await fetch(`/.netlify/functions/course-get?slug=${encodeURIComponent(slug)}`, {
      headers:{ Authorization:`Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load course.');
    course = data.course;
    lessons = course.modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => ({...lesson,module,moduleIndex,lessonIndex}))
    );
    if (!lessons.length) {
      if (data.canEdit && previewMode) {
        renderEmptyPreview();
        return;
      }
      throw new Error('This course does not contain any lessons yet.');
    }
    const firstIncomplete = lessons.findIndex(lesson => !lesson.completed);
    currentIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
    renderShell(data.canEdit);
    renderLesson();
  } catch (error) {
    app.innerHTML = `<section class="cmcCourseUnavailable"><p class="cmcEyebrow">COURSE</p><h1>Not available yet.</h1><p>${escapeHtml(error.message)}</p><a href="dashboard.html">Return to your pathway →</a></section>`;
  }

  function renderEmptyPreview() {
    document.title = `${course.title} Preview | CMC Pathway`;
    app.innerHTML = `
      <section class="cmcCourseUnavailable">
        <p class="cmcEyebrow">COURSE PREVIEW</p>
        <h1>${escapeHtml(course.title || 'Untitled course')}</h1>
        <p>This course does not have any lessons to preview yet.</p>
        <a href="course-builder.html?id=${encodeURIComponent(course.id)}">Return to the course builder →</a>
      </section>`;
  }

  function renderShell(canEdit) {
    const complete = lessons.filter(item => item.completed).length;
    const percent = Math.round((complete / lessons.length) * 100);
    document.title = `${course.title} | CMC Pathway`;
    app.innerHTML = `
      <aside class="cmcCourseSidebar">
        <a class="cmcBackToPathway" href="dashboard.html">← My Pathway</a>
        <p class="cmcEyebrow">CMC COURSE</p>
        <h1>${escapeHtml(course.title)}</h1>
        <p>${escapeHtml(course.subtitle || course.description)}</p>
        <div class="cmcCourseProgress">
          <div><strong id="courseProgressText">${percent}%</strong><span>complete</span></div>
          <div><i id="courseProgressBar" style="width:${percent}%"></i></div>
        </div>
        <nav id="courseOutline" class="cmcCourseOutline">${outlineHtml()}</nav>
        ${canEdit ? `<a class="cmcEditCourseLink" href="course-builder.html?id=${encodeURIComponent(course.id)}">Edit this course →</a>` : ''}
      </aside>
      <section class="cmcLessonWorkspace">
        <article id="lessonContent" class="cmcLessonContent"></article>
      </section>`;
    bindOutline();
  }

  function renderLesson() {
    const lesson = lessons[currentIndex];
    const video = videoHtml(lesson.video_url, lesson.lesson_type);
    const image = imageHtml(lesson.image_url, lesson.image_alt);
    const resource = resourceHtml(lesson.resource_url, lesson.resource_label);
    const content = contentHtml(lesson.content);
    const format = lessonTypeLabel(lesson.lesson_type);
    document.getElementById('lessonContent').innerHTML = `
      <div class="cmcLessonMeta">
        <span>${escapeHtml(lesson.module.title)} · ${escapeHtml(format)}</span>
        <span>Lesson ${lesson.moduleIndex + 1}.${lesson.lessonIndex + 1}${lesson.estimated_minutes ? ` · ${lesson.estimated_minutes} min` : ''}</span>
      </div>
      <h2>${escapeHtml(lesson.title)}</h2>
      ${lesson.summary ? `<p class="cmcLessonSummary">${escapeHtml(lesson.summary)}</p>` : ''}
      ${video}
      ${image}
      <div class="cmcLessonProse">${content || '<p>No written content has been added to this lesson.</p>'}</div>
      ${resource}
      ${reflectionHtml(lesson)}
      <footer class="cmcLessonFooter">
        <button id="previousLessonBtn" class="cmcSecondaryButton" type="button"${currentIndex === 0 ? ' disabled' : ''}>← Previous</button>
        <button id="completeLessonBtn" class="cmcPrimaryButton ${lesson.completed ? 'complete' : ''}" type="button">
          ${lesson.completed ? 'Completed ✓' : currentIndex === lessons.length - 1 ? 'Complete course' : 'Complete and continue'} 
        </button>
      </footer>`;
    document.getElementById('previousLessonBtn').addEventListener('click', () => goTo(currentIndex - 1));
    document.getElementById('completeLessonBtn').addEventListener('click', completeCurrentLesson);
    updateOutlineSelection();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function completeCurrentLesson() {
    const lesson = lessons[currentIndex];
    const button = document.getElementById('completeLessonBtn');
    if (lesson.completed && currentIndex < lessons.length - 1) return goTo(currentIndex + 1);
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const responseField = document.getElementById('lessonResponse');
      const responseText = responseField?.value.trim() || '';
      if (lesson.response_required && !responseText) {
        responseField.focus();
        document.getElementById('lessonResponseMessage').textContent = 'Add your reflection before completing this lesson.';
        button.disabled = false;
        button.textContent = 'Complete and continue';
        return;
      }
      const response = await fetch('/.netlify/functions/course-progress', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify({lesson_id:lesson.id,completed:true,response_text:responseText})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save progress.');
      lesson.completed = true;
      if (responseText) lesson.response_text = responseText;
      updateProgress(data.progress);
      refreshOutline();
      if (data.courseComplete) return showCompletion();
      if (currentIndex < lessons.length - 1) goTo(currentIndex + 1);
      else renderLesson();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Try again';
      window.alert(error.message);
    }
  }

  function showCompletion() {
    document.querySelector('.cmcLessonWorkspace').innerHTML = `
      <section class="cmcCourseComplete">
        <span>✓</span>
        <p class="cmcEyebrow">COURSE COMPLETE</p>
        <h2>You completed ${escapeHtml(course.title)}.</h2>
        <p>Your completion is now visible to your regional CMC leader. Return to your pathway to see what comes next.</p>
        <a class="cmcPrimaryButton" href="dashboard.html">Return to your pathway →</a>
      </section>`;
    updateProgress(100);
  }

  function outlineHtml() {
    return course.modules.map((module, moduleIndex) => `
      <section>
        <h2><span>${String(moduleIndex + 1).padStart(2,'0')}</span>${escapeHtml(module.title)}</h2>
        ${module.lessons.map(lesson => {
          const index = lessons.findIndex(item => item.id === lesson.id);
          return `<button type="button" data-lesson-index="${index}" class="${lesson.completed ? 'complete' : ''}">
            <i>${lesson.completed ? '✓' : index + 1}</i><span>${escapeHtml(lesson.title)}</span>
          </button>`;
        }).join('')}
      </section>`).join('');
  }
  function bindOutline(){document.querySelectorAll('[data-lesson-index]').forEach(button=>button.addEventListener('click',()=>goTo(Number(button.dataset.lessonIndex))))}
  function refreshOutline(){document.getElementById('courseOutline').innerHTML=outlineHtml();bindOutline();updateOutlineSelection()}
  function updateOutlineSelection(){document.querySelectorAll('[data-lesson-index]').forEach(button=>button.classList.toggle('active',Number(button.dataset.lessonIndex)===currentIndex))}
  function goTo(index){if(index<0||index>=lessons.length)return;currentIndex=index;renderLesson()}
  function updateProgress(percent){document.getElementById('courseProgressText').textContent=`${percent}%`;document.getElementById('courseProgressBar').style.width=`${percent}%`}

  function videoHtml(url, lessonType) {
    if (!url) {
      return lessonType === 'video'
        ? `<div class="cmcVideoPlaceholder"><span aria-hidden="true">▶</span><div><strong>Video lesson</strong><p>The video for this lesson will be added here. The written material is available below.</p></div></div>`
        : '';
    }
    const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (youtube) return `<div class="cmcVideoFrame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube[1])}" title="Lesson video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return `<div class="cmcVideoFrame"><iframe src="https://player.vimeo.com/video/${encodeURIComponent(vimeo[1])}" title="Lesson video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    return `<a class="cmcVideoLink" href="${escapeAttribute(url)}" target="_blank" rel="noopener">Open lesson video ↗</a>`;
  }

  function imageHtml(url, alt) {
    if (!url) return '';
    return `<figure class="cmcLessonImage"><img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt || '')}"></figure>`;
  }

  function resourceHtml(url, label) {
    if (!url) return '';
    return `<a class="cmcLessonResource" href="${escapeAttribute(url)}" target="_blank" rel="noopener">
      <span><small>COURSE RESOURCE</small><strong>${escapeHtml(label || 'Open resource')}</strong></span><b aria-hidden="true">↗</b>
    </a>`;
  }

  function reflectionHtml(lesson) {
    if (!lesson.reflection_prompt && !lesson.response_required) return '';
    return `<aside class="cmcReflection">
      <p class="cmcEyebrow">REFLECT</p>
      ${lesson.reflection_prompt ? `<h3>${escapeHtml(lesson.reflection_prompt)}</h3>` : ''}
      ${lesson.response_required ? `<label class="cmcReflectionResponse">
        <span>Your response</span>
        <textarea id="lessonResponse" rows="5" maxlength="5000" placeholder="Write your reflection here…">${escapeHtml(lesson.response_text || '')}</textarea>
        <small id="lessonResponseMessage">Your response will be saved with your course progress.</small>
      </label>` : ''}
    </aside>`;
  }

  function contentHtml(value) {
    const lines = String(value || '').split(/\n/);
    let html = '';
    let listType = '';
    const closeList = () => {
      if (!listType) return;
      html += `</${listType}>`;
      listType = '';
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('- ')) {
        if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
        html += `<li>${inlineHtml(line.slice(2))}</li>`;
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
        html += `<li>${inlineHtml(line.replace(/^\d+\.\s+/, ''))}</li>`;
        continue;
      }
      if (!line) continue;
      closeList();
      if (line === '---') html += '<hr>';
      else if (line.startsWith('### ')) html += `<h4>${inlineHtml(line.slice(4))}</h4>`;
      else if (line.startsWith('## ')) html += `<h3>${inlineHtml(line.slice(3))}</h3>`;
      else if (line.startsWith('> ')) html += `<blockquote>${inlineHtml(line.slice(2))}</blockquote>`;
      else html += `<p>${inlineHtml(line)}</p>`;
    }
    closeList();
    return html;
  }

  function inlineHtml(value) {
    const links = [];
    const linked = String(value || '').replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (_, text, url) => {
      const token = `CMC_LINK_${links.length}_TOKEN`;
      links.push({ token, text, url });
      return token;
    });
    let html = escapeHtml(linked)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    links.forEach(link => {
      html = html.replace(
        link.token,
        `<a href="${escapeAttribute(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.text)}</a>`
      );
    });
    return html;
  }

  function lessonTypeLabel(value) {
    return ({article:'Article',video:'Video',reflection:'Reflection',resource:'Resource'})[value] || 'Article';
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function escapeAttribute(value){return escapeHtml(value)}
})();
