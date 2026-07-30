(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  const list = document.getElementById('participantList');
  let participants = [];
  let followupsOnly = false;
  let viewer = null;

  try {
    const response = await fetch('/.netlify/functions/regional-participants', {
      headers: { Authorization:`Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load participants.');

    participants = data.participants || [];
    viewer = data.viewer || null;
    dcAuth.renderRoleNavigation(viewer, 'people');
    const region = viewer?.account_role === 'cmc_admin' ? 'ALL OPEN BIBLE REGIONS' : `OPEN BIBLE ${viewer?.region || ''} REGION`;
    setText('leaderRegionLabel', region);
    setText('activeCaption', viewer?.account_role === 'cmc_admin' ? 'Across all regions' : `Across ${viewer?.region || 'your'} Region`);
    updateSummary();
    render();
  } catch (error) {
    list.innerHTML = `<div class="cmcLeaderError"><strong>Unable to open the regional dashboard.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }

  document.getElementById('peopleSearch').addEventListener('input', render);
  document.getElementById('peopleTypeFilter').addEventListener('change', () => {
    followupsOnly = false;
    document.getElementById('showFollowupsBtn').textContent = 'View follow-ups →';
    updateSummary();
    render();
  });
  document.getElementById('peopleStatusFilter').addEventListener('change', render);
  document.getElementById('stageFilter').addEventListener('change', render);
  document.getElementById('showFollowupsBtn').addEventListener('click', () => {
    followupsOnly = !followupsOnly;
    document.getElementById('showFollowupsBtn').textContent = followupsOnly ? 'Show everyone →' : 'View follow-ups →';
    render();
  });
  document.getElementById('inviteParticipantBtn').addEventListener('click', () => {
    window.alert('Participant invitations will be connected in the next build step.');
  });

  function updateSummary() {
    const type = document.getElementById('peopleTypeFilter').value;
    const people = participants.filter(person =>
      matchesPeopleType(person, type) && !person.archived_at
    );
    const discover = people.filter(person => assignment(person,'discover_course')).length;
    const followups = people.filter(isReadyForFollowup).length;
    const discern = people.filter(person => person.assignments.some(item => item.stage_key === 'discern' && item.status === 'assigned')).length;
    setText('activeLabel', type === 'participant' ? 'Active participants' : type === 'leader' ? 'Active leaders' : 'Active people');
    setText('activeCount', people.length);
    setText('discoverCount', discover);
    setText('followupCount', followups);
    setText('discernCount', discern);

    const banner = document.getElementById('followupBanner');
    if (followups) {
      banner.classList.remove('hidden');
      setText('followupMessage', `${followups} ${followups === 1 ? 'person is' : 'people are'} ready for a conversation.`);
    } else {
      banner.classList.add('hidden');
    }
  }

  function render() {
    const query = document.getElementById('peopleSearch').value.trim().toLowerCase();
    const type = document.getElementById('peopleTypeFilter').value;
    const accountStatus = document.getElementById('peopleStatusFilter').value;
    const stage = document.getElementById('stageFilter').value;
    let visible = participants.filter(person => {
      const text = [person.full_name,person.email,person.church_name,person.ministry_role,person.state,person.region].join(' ').toLowerCase();
      if (query && !text.includes(query)) return false;
      if (!matchesPeopleType(person, type)) return false;
      if (accountStatus === 'active' && person.archived_at) return false;
      if (accountStatus === 'archived' && !person.archived_at) return false;
      if (stage && currentStage(person) !== stage) return false;
      if (followupsOnly && (person.archived_at || !isReadyForFollowup(person))) return false;
      return true;
    });

    if (!visible.length) {
      list.innerHTML = '<div class="cmcLeaderEmpty">No people match this view.</div>';
      return;
    }

    list.innerHTML = visible.map(person => {
      const stage = currentStage(person);
      const discover = assignment(person,'discover_course');
      const ready = isReadyForFollowup(person);
      const latest = latestActivity(person);
      const status = person.archived_at
        ? 'Archived'
        : ready
          ? 'Follow up'
          : stage === 'discover' && !discoverProgress(discover)
            ? 'New'
            : 'In progress';
      const statusClass = person.archived_at
        ? 'archived'
        : ready
          ? 'attention'
          : status === 'New'
            ? 'waiting'
            : 'active';
      const stageDetail = stage === 'discover'
        ? discoverProgress(discover) >= 100 ? 'Completed' : `${discoverProgress(discover)}% complete`
        : `${person.assignments.filter(item => item.stage_key === stage && item.status === 'assigned').length} item(s) assigned`;

      return `<article class="cmcParticipantRow${person.archived_at ? ' archived' : ''}">
        <div class="cmcPerson">
          <span class="cmcAvatar">${initials(person.full_name)}</span>
          <div><strong>${escapeHtml(person.full_name || person.email)}</strong><small>${escapeHtml([roleLabel(person),person.church_name,person.state].filter(Boolean).join(' · ') || person.email)}</small></div>
        </div>
        <div class="cmcPersonMetric"><span>${titleCase(stage)}</span><strong>${escapeHtml(stageDetail)}</strong></div>
        <div class="cmcPersonMetric"><span>Latest activity</span><strong>${escapeHtml(latest)}</strong></div>
        <span class="cmcActionPill ${statusClass}">${status}</span>
        <div class="cmcRowActions">
          <a class="cmcRowAction" href="participant.html?id=${encodeURIComponent(person.id)}">Open dashboard →</a>
        </div>
      </article>`;
    }).join('');
  }

  function assignment(person,key){ return person.assignments.find(item => item.item_key === key && item.status === 'assigned'); }
  function matchesPeopleType(person,type){
    if (type === 'participant') return person.account_role === 'participant';
    if (type === 'leader') return ['regional_leader','cmc_admin'].includes(person.account_role);
    return true;
  }
  function roleLabel(person){
    if (person.account_role === 'regional_leader') return 'Regional leader';
    if (person.account_role === 'cmc_admin') return 'National administrator';
    return 'Participant';
  }
  function discoverProgress(item){ return Math.max(0,Math.min(100,Number(item?.progress || (item?.external_status === 'completed' ? 100 : 0)))); }
  function isReadyForFollowup(person){ const item=assignment(person,'discover_course'); return Boolean(item && discoverProgress(item)>=100); }
  function currentStage(person){
    if (['discover','discern','develop','deploy'].includes(person.current_stage)) return person.current_stage;
    if (person.assignments.some(item => item.stage_key === 'deploy' && item.status === 'assigned')) return 'deploy';
    if (person.assignments.some(item => item.stage_key === 'develop' && item.status === 'assigned')) return 'develop';
    if (person.assignments.some(item => item.stage_key === 'discern' && item.status === 'assigned')) return 'discern';
    return 'discover';
  }
  function latestActivity(person){
    const dates = [...person.assignments.map(item => item.updated_at || item.assigned_at), ...person.reports.map(item => item.created_at)].filter(Boolean);
    if (!dates.length) return formatDate(person.created_at);
    return formatDate(dates.sort().reverse()[0]);
  }
  function formatDate(value){ try{return new Date(value).toLocaleDateString([],{month:'short',day:'numeric'});}catch(_){return '—';} }
  function initials(value){ return String(value||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(); }
  function titleCase(value){ return String(value||'').replace(/\b\w/g,c=>c.toUpperCase()); }
  function setText(id,value){ const el=document.getElementById(id); if(el) el.textContent=value; }
  function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
})();
