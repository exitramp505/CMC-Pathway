(async function(){
  // Keep participants on the current Pathwright course while the native
  // Discover course is built and tested privately by CMC administrators.
  const DISCOVER_COURSE_URL = 'https://acquire.pathwright.com/library/discover-church-multiplication-101-238879/725954/path/';

  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  const isLeader = ['regional_leader','cmc_admin'].includes(profile?.account_role);
  const participantView = new URLSearchParams(window.location.search).get('view') === 'participant';
  if (isLeader && !participantView) {
    window.location.replace('leader.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'pathway');
  const profileComplete = Boolean(profile?.full_name && profile?.phone && profile?.state);
  if (!profileComplete) {
    window.location.href = 'profile.html?next=dashboard';
    return;
  }

  setText('welcomeTitle', `Welcome${profile.full_name ? `, ${firstName(profile.full_name)}.` : '.'}`);
  const region = profile.region || dcAuth.regionForState(profile.state);
  setText('regionName', `Open Bible ${region} Region`);
  setText('regionInitial', region ? region.slice(0, 1).toUpperCase() : '—');

  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const accessToken = session.data?.session?.access_token || '';

  await ensureDiscoverAssignment(accessToken);
  const assignments = await getAssignments(accessToken);
  const assignedKeys = new Set(assignments.map(item => item.item_key));

  const { data: reports } = await sb
    .from('assessment_results')
    .select('id,created_at,scores,overall,overall_label')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const completedKeys = new Set();
  for (const report of reports || []) {
    const type = report.scores?.assessmentType || '';
    if (type === 'isa_readiness') completedKeys.add('ministry_readiness');
    else if (type === 'ministry_style') completedKeys.add('ministry_style');
    else completedKeys.add('character_qualities');
  }

  const discoverAssignment = assignments.find(item => item.item_key === 'discover_course');
  const discoverProgress = Number(discoverAssignment?.progress || 0);
  const discoverComplete = discoverProgress >= 100 || discoverAssignment?.external_status === 'completed';
  if (discoverComplete) showDiscoverCompletion();
  const discernKeys = ['discernment_application','ministry_readiness','ministry_style','character_qualities'];
  const discernAssignments = discernKeys.filter(key => assignedKeys.has(key));
  const discernCompleteCount = discernAssignments.filter(key => completedKeys.has(key)).length;
  const hasDiscern = discernAssignments.length > 0;
  const hasDevelop = assignments.some(item => item.stage_key === 'develop');
  const hasDeploy = assignments.some(item => item.stage_key === 'deploy');

  const activeStageCount = 1 + Number(hasDiscern) + Number(hasDevelop) + Number(hasDeploy);
  setText('stagesUnderway', `${activeStageCount} of 4`);
  document.getElementById('journeyProgress').style.width = `${activeStageCount * 25}%`;

  document.getElementById('pathwayStages').innerHTML = [
    stageCard({
      number:'01',
      key:'discover',
      label: discoverComplete ? 'COURSE COMPLETED' : 'START HERE',
      title:'Discover',
      description:'Learn the biblical foundation, shared language, and models of church multiplication through a short online course.',
      symbol: discoverComplete ? '✓' : '✦',
      state: discoverComplete ? 'complete' : 'current',
      status: discoverComplete ? 'Complete' : discoverProgress ? `${discoverProgress}% complete` : 'Ready to begin',
      actionUrl: DISCOVER_COURSE_URL,
      actionText: discoverComplete ? 'Review Discover' : discoverProgress ? 'Continue Discover' : 'Begin Discover'
    }),
    stageCard({
      number:'02',
      key:'discern',
      label:'CLARIFY CALLING',
      title:'Discern',
      description:'Explore calling, character, capacity, context, and readiness with trusted leaders.',
      symbol:'◇',
      state: hasDiscern ? 'available' : 'locked',
      status: hasDiscern ? `${discernCompleteCount} of ${discernAssignments.length} complete` : 'Assigned as you progress',
      actionUrl: hasDiscern ? '#assigned-work' : '',
      actionText: hasDiscern ? 'View assigned work' : ''
    }),
    stageCard({
      number:'03',
      key:'develop',
      label:'PREPARE WELL',
      title:'Develop',
      description:'Build a ministry plan, strengthen essential skills, and prepare with coaching and practical resources.',
      symbol:'＋',
      state: hasDevelop ? 'available' : 'locked',
      status: hasDevelop ? 'Resources assigned' : 'Future stage',
      actionUrl: hasDevelop ? '#assigned-work' : '',
      actionText: hasDevelop ? 'View development plan' : ''
    }),
    stageCard({
      number:'04',
      key:'deploy',
      label:'MOVE INTO MISSION',
      title:'Deploy',
      description:'Move toward launch with accountable relationships, regional support, and a clear plan for multiplication.',
      symbol:'↗',
      state: hasDeploy ? 'available' : 'locked',
      status: hasDeploy ? 'Next steps assigned' : 'Future stage',
      actionUrl: hasDeploy ? '#assigned-work' : '',
      actionText: hasDeploy ? 'View launch steps' : ''
    })
  ].join('');

  const assignedWork = buildAssignedWork(assignments, completedKeys);
  if (assignedWork) {
    document.querySelector('.cmcJourney').insertAdjacentHTML('afterend', assignedWork);
  }

  async function ensureDiscoverAssignment(token) {
    if (!token) return;
    try {
      await fetch('/.netlify/functions/candidate-default-assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_) {}
  }

  async function getAssignments(token) {
    if (!token) return [];
    try {
      const response = await fetch('/.netlify/functions/candidate-assignments-get', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return data.ok && Array.isArray(data.assignments) ? data.assignments : [];
    } catch (_) {
      return [];
    }
  }

  function stageCard({number,key,label,title,description,symbol,state,status,actionUrl,actionText}) {
    return `<article class="cmcStageCard ${escapeHtml(key)} ${escapeHtml(state)}">
      <div class="cmcStageTop">
        <span class="cmcStageNumber">${number}</span>
        <span class="cmcStageStatus">${escapeHtml(status)}</span>
      </div>
      <div class="cmcStageSymbol" aria-hidden="true">${symbol}</div>
      <div>
        <p class="cmcStageLabel">${label}</p>
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
      ${actionUrl
        ? `<a href="${actionUrl}"${actionUrl.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(actionText)} <span>→</span></a>`
        : `<span class="cmcFutureAction">${escapeHtml(status)}</span>`}
    </article>`;
  }

  function showDiscoverCompletion() {
    document.head.insertAdjacentHTML('beforeend', `<style>
      .cmcStageCard.complete .cmcStageSymbol{display:grid;width:78px;height:78px;place-items:center;border:2px solid rgba(251,240,222,.72);border-radius:50%;background:var(--cmcSage);color:white;font-size:43px;font-weight:900;box-shadow:0 12px 30px rgba(77,167,156,.22)}
      .cmcStageCard.complete .cmcStageLabel{color:#9ae0d8!important}
      .cmcCourseCompletion{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;margin-top:18px;padding:20px 22px;border:1px solid rgba(77,167,156,.5);border-radius:18px;background:rgba(77,167,156,.13)}
      .cmcCourseCompletion>span{display:grid;width:44px;height:44px;place-items:center;border-radius:50%;background:var(--cmcSage);color:white;font-size:24px;font-weight:900}
      .cmcCourseCompletion strong{display:block;color:var(--cmcSand);font-size:17px}.cmcCourseCompletion p{margin:4px 0 0;color:rgba(251,240,222,.7);font-size:12px;line-height:1.5}
      .cmcCourseCompletion a{padding:12px 15px;border:1px solid rgba(251,240,222,.22);border-radius:12px;color:var(--cmcSand);font-size:11px;font-weight:900;text-decoration:none}
      @media(max-width:720px){.cmcCourseCompletion{grid-template-columns:auto 1fr}.cmcCourseCompletion a{grid-column:2;justify-self:start}}
    </style>`);
    document.getElementById('pathwayStages').insertAdjacentHTML('afterend', `
      <div class="cmcCourseCompletion">
        <span aria-hidden="true">✓</span>
        <div><strong>Discover complete.</strong><p>Your regional leader can now see that you are ready for a follow-up conversation.</p></div>
        <a href="${DISCOVER_COURSE_URL}" target="_blank" rel="noopener">Review course →</a>
      </div>`);
  }

  function buildAssignedWork(items, completed) {
    const visible = items.filter(item => item.item_key !== 'discover_course');
    if (!visible.length) return '';

    const info = {
      discernment_application:['Discernment Application','application.html'],
      ministry_readiness:['Ministry Readiness Inventory','isa-assessment.html'],
      ministry_style:['Ministry Style Inventory','ministry-style.html'],
      character_qualities:['Character Qualities Assessment','assessment.html']
    };

    return `<section id="assigned-work" class="cmcAssignedSection">
      <div><p class="cmcEyebrow">ASSIGNED TO YOU</p><h2>Your current work.</h2></div>
      <div class="cmcAssignedList">${visible.map(item => {
        const details = info[item.item_key] || [titleCase(item.item_key), '#'];
        const done = completed.has(item.item_key) || Number(item.progress) >= 100 || item.external_status === 'completed';
        return `<article>
          <span class="cmcAssignedCheck">${done ? '✓' : '•'}</span>
          <div><h3>${escapeHtml(details[0])}</h3><p>${done ? 'Completed' : 'Ready when you are.'}</p></div>
          <span class="cmcAssignedPill ${done ? 'done' : ''}">${done ? 'Complete' : 'Assigned'}</span>
          <a href="${details[1]}">${done ? 'Review' : 'Begin'} →</a>
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  function setText(id,value){ const el=document.getElementById(id); if(el) el.textContent=value; }
  function firstName(value){ return String(value || '').trim().split(/\s+/)[0] || ''; }
  function titleCase(value){ return String(value || '').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
  function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
})();
