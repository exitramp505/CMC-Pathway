(async function(){
  const PATHWRIGHT_DISCOVER_URL = 'https://acquire.pathwright.com/library/discover-church-multiplication-101-238879/725954/path/';

  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
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
      label:'START HERE',
      title:'Discover',
      description:'Learn the biblical foundation, shared language, and models of church multiplication through a short online course.',
      symbol:'✦',
      state: discoverComplete ? 'complete' : 'current',
      status: discoverComplete ? 'Completed' : discoverProgress ? `${discoverProgress}% complete` : 'Ready to begin',
      actionUrl: PATHWRIGHT_DISCOVER_URL,
      actionText: discoverProgress ? 'Continue Discover' : 'Begin Discover'
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
