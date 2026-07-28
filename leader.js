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
  let accessProfiles = [];
  let regions = [];

  try {
    const response = await fetch('/.netlify/functions/regional-participants', {
      headers: { Authorization:`Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load participants.');

    participants = data.participants || [];
    viewer = data.viewer || null;
    const region = viewer?.account_role === 'cmc_admin' ? 'ALL OPEN BIBLE REGIONS' : `OPEN BIBLE ${viewer?.region || ''} REGION`;
    setText('leaderRegionLabel', region);
    setText('activeCaption', viewer?.account_role === 'cmc_admin' ? 'Across all regions' : `Across ${viewer?.region || 'your'} Region`);
    updateSummary();
    render();
    if (viewer?.account_role === 'cmc_admin') await loadLeaderManagement();
  } catch (error) {
    list.innerHTML = `<div class="cmcLeaderError"><strong>Unable to open the regional dashboard.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }

  document.getElementById('peopleSearch').addEventListener('input', render);
  document.getElementById('stageFilter').addEventListener('change', render);
  document.getElementById('showFollowupsBtn').addEventListener('click', () => {
    followupsOnly = !followupsOnly;
    document.getElementById('showFollowupsBtn').textContent = followupsOnly ? 'Show everyone →' : 'View follow-ups →';
    render();
  });
  document.getElementById('inviteParticipantBtn').addEventListener('click', () => {
    window.alert('Participant invitations will be connected in the next build step.');
  });
  document.getElementById('leaderAccessForm').addEventListener('submit', grantLeaderAccess);

  function updateSummary() {
    const discover = participants.filter(person => assignment(person,'discover_course')).length;
    const followups = participants.filter(isReadyForFollowup).length;
    const discern = participants.filter(person => person.assignments.some(item => item.stage_key === 'discern' && item.status === 'assigned')).length;
    setText('activeCount', participants.length);
    setText('discoverCount', discover);
    setText('followupCount', followups);
    setText('discernCount', discern);

    if (followups) {
      const banner = document.getElementById('followupBanner');
      banner.classList.remove('hidden');
      setText('followupMessage', `${followups} ${followups === 1 ? 'person is' : 'people are'} ready for a conversation.`);
    }
  }

  function render() {
    const query = document.getElementById('peopleSearch').value.trim().toLowerCase();
    const stage = document.getElementById('stageFilter').value;
    let visible = participants.filter(person => {
      const text = [person.full_name,person.email,person.church_name,person.ministry_role,person.state,person.region].join(' ').toLowerCase();
      if (query && !text.includes(query)) return false;
      if (stage && currentStage(person) !== stage) return false;
      if (followupsOnly && !isReadyForFollowup(person)) return false;
      return true;
    });

    if (!visible.length) {
      list.innerHTML = '<div class="cmcLeaderEmpty">No participants match this view.</div>';
      return;
    }

    list.innerHTML = visible.map(person => {
      const stage = currentStage(person);
      const discover = assignment(person,'discover_course');
      const ready = isReadyForFollowup(person);
      const latest = latestActivity(person);
      const status = ready ? 'Follow up' : stage === 'discover' && !discoverProgress(discover) ? 'New' : 'In progress';
      const statusClass = ready ? 'attention' : status === 'New' ? 'waiting' : 'active';
      const stageDetail = stage === 'discover'
        ? discoverProgress(discover) >= 100 ? 'Completed' : `${discoverProgress(discover)}% complete`
        : `${person.assignments.filter(item => item.stage_key === stage && item.status === 'assigned').length} item(s) assigned`;

      return `<article class="cmcParticipantRow">
        <div class="cmcPerson">
          <span class="cmcAvatar">${initials(person.full_name)}</span>
          <div><strong>${escapeHtml(person.full_name || person.email)}</strong><small>${escapeHtml([person.church_name,person.state].filter(Boolean).join(' · ') || person.email)}</small></div>
        </div>
        <div class="cmcPersonMetric"><span>${titleCase(stage)}</span><strong>${escapeHtml(stageDetail)}</strong></div>
        <div class="cmcPersonMetric"><span>Latest activity</span><strong>${escapeHtml(latest)}</strong></div>
        <span class="cmcActionPill ${statusClass}">${status}</span>
        <a class="cmcRowAction" href="admin.html?candidate=${encodeURIComponent(person.id)}">Open →</a>
      </article>`;
    }).join('');
  }

  async function loadLeaderManagement() {
    const panel = document.getElementById('leaderManagement');
    panel.classList.remove('hidden');
    setAccessMessage('Loading accounts…');
    try {
      const response = await fetch('/.netlify/functions/admin-leaders', {
        headers: { Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load leader access.');
      accessProfiles = data.profiles || [];
      regions = data.regions || [];
      renderLeaderAccess();
      setAccessMessage('');
    } catch (error) {
      setAccessMessage(error.message, true);
    }
  }

  function renderLeaderAccess() {
    const accountSelect = document.getElementById('leaderAccount');
    const regionSelect = document.getElementById('leaderRegion');
    const candidates = accessProfiles.filter(profile => profile.account_role === 'participant');
    const leaders = accessProfiles.filter(profile => profile.account_role === 'regional_leader');

    accountSelect.innerHTML = '<option value="">Choose an existing account</option>' +
      candidates.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.full_name || profile.email)} · ${escapeHtml(profile.email)}</option>`).join('');
    regionSelect.innerHTML = '<option value="">Choose a region</option>' +
      regions.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');

    setText('regionalLeaderCount', String(leaders.length));
    const leaderList = document.getElementById('regionalLeaderList');
    leaderList.innerHTML = leaders.length ? leaders.map(profile => `
      <article>
        <span class="cmcAvatar">${initials(profile.full_name)}</span>
        <div><strong>${escapeHtml(profile.full_name || profile.email)}</strong><small>${escapeHtml(profile.email)}</small></div>
        <span class="cmcLeaderRegion">${escapeHtml(profile.region || 'Region needed')}</span>
        <button type="button" data-remove-leader="${escapeHtml(profile.id)}">Remove access</button>
      </article>`).join('') : '<p class="cmcLeaderEmpty">No regional leaders have been assigned yet.</p>';

    leaderList.querySelectorAll('[data-remove-leader]').forEach(button => {
      button.addEventListener('click', () => removeLeaderAccess(button.dataset.removeLeader));
    });
  }

  async function grantLeaderAccess(event) {
    event.preventDefault();
    const profileId = document.getElementById('leaderAccount').value;
    const region = document.getElementById('leaderRegion').value;
    if (!profileId || !region) return setAccessMessage('Choose an account and region.', true);
    setAccessMessage('Granting access…');
    await updateLeaderRole(profileId, 'regional_leader', region);
  }

  async function removeLeaderAccess(profileId) {
    setAccessMessage('Removing regional access…');
    await updateLeaderRole(profileId, 'participant', '');
  }

  async function updateLeaderRole(profileId, accountRole, region) {
    try {
      const response = await fetch('/.netlify/functions/admin-leaders', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${token}`
        },
        body:JSON.stringify({ profile_id:profileId, account_role:accountRole, region })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update leader access.');
      const index = accessProfiles.findIndex(profile => profile.id === data.profile.id);
      if (index >= 0) accessProfiles[index] = data.profile;
      renderLeaderAccess();
      document.getElementById('leaderAccessForm').reset();
      setAccessMessage(accountRole === 'regional_leader' ? 'Regional access granted.' : 'Regional access removed.');
    } catch (error) {
      setAccessMessage(error.message, true);
    }
  }

  function setAccessMessage(message, isError) {
    const element = document.getElementById('leaderAccessMessage');
    element.textContent = message || '';
    element.classList.toggle('error', Boolean(isError));
  }

  function assignment(person,key){ return person.assignments.find(item => item.item_key === key && item.status === 'assigned'); }
  function discoverProgress(item){ return Math.max(0,Math.min(100,Number(item?.progress || (item?.external_status === 'completed' ? 100 : 0)))); }
  function isReadyForFollowup(person){ const item=assignment(person,'discover_course'); return Boolean(item && discoverProgress(item)>=100); }
  function currentStage(person){
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
