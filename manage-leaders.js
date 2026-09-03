(async function(){
  const user = await dcAuth.requireUser();
  if (!user) return;

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (!['regional_leader', 'cmc_admin'].includes(profile?.account_role)) {
    window.location.replace('dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'leaders');

  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  let profiles = [];
  let regions = [];
  let viewer = profile;

  document.getElementById('leaderAccessForm').addEventListener('submit', grantAccess);
  document.getElementById('leaderAccessLevel').addEventListener('change', updateAccessForm);
  await load();

  async function load(){
    setMessage('Loading accounts…');
    try{
      const response = await fetch('/.netlify/functions/admin-leaders', {
        headers:{ Authorization:`Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data.ok) throw new Error(data.error || 'Could not load leader access.');
      profiles = data.profiles || [];
      regions = data.regions || [];
      viewer = data.viewer || viewer;
      renderScope();
      render();
      setMessage('');
    }catch(error){
      setMessage(error.message, true);
    }
  }

  function render(){
    const candidates = profiles.filter(item =>
      item.id !== viewer.id &&
      item.account_role !== 'cmc_admin' &&
      (viewer.account_role === 'cmc_admin' || item.account_role === 'participant')
    );
    const leaders = profiles.filter(item => item.account_role === 'regional_leader');
    const administrators = profiles.filter(item => item.account_role === 'cmc_admin');
    document.getElementById('leaderAccount').innerHTML =
      '<option value="">Choose an existing account</option>' +
      candidates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.full_name || item.email)} · ${escapeHtml(item.email)}${item.account_role === 'regional_leader' ? ` · ${escapeHtml(item.region || 'Regional leader')}` : ''}</option>`).join('');
    const regionSelect = document.getElementById('leaderRegion');
    regionSelect.innerHTML =
      '<option value="">Choose a region</option>' +
      regions.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
    if(viewer.account_role === 'regional_leader'){
      regionSelect.value = viewer.region || regions[0] || '';
    }
    document.getElementById('administratorSection').classList.toggle('hidden', viewer.account_role !== 'cmc_admin');
    document.getElementById('administratorCount').textContent = String(administrators.length);
    document.getElementById('regionalLeaderCount').textContent = String(leaders.length);

    const administratorList = document.getElementById('administratorList');
    administratorList.innerHTML = administrators.length ? administrators.map(item => `
      <article>
        <span class="cmcAvatar cmcAdminAvatar">${initials(item.full_name)}</span>
        <div><strong>${escapeHtml(item.full_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></div>
        <span class="cmcLeaderRegion cmcFullAdminRegion">All regions</span>
        ${item.id === viewer.id
          ? '<span class="cmcLeaderSelf">Your account</span>'
          : `<button type="button" data-remove-admin="${escapeHtml(item.id)}" data-person-name="${escapeHtml(item.full_name || item.email)}">Remove full access</button>`}
      </article>`).join('') : '<p class="cmcLeaderEmpty">No full administrators were found.</p>';

    const list = document.getElementById('regionalLeaderList');
    list.innerHTML = leaders.length ? leaders.map(item => `
      <article>
        <span class="cmcAvatar">${initials(item.full_name)}</span>
        <div><strong>${escapeHtml(item.full_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></div>
        <span class="cmcLeaderRegion">${escapeHtml(item.region || 'Region needed')}</span>
        ${item.id === viewer.id
          ? '<span class="cmcLeaderSelf">Your account</span>'
          : `<button type="button" data-remove-leader="${escapeHtml(item.id)}">Remove access</button>`}
      </article>`).join('') : '<p class="cmcLeaderEmpty">No regional leaders have been assigned yet.</p>';

    list.querySelectorAll('[data-remove-leader]').forEach(button => {
      button.addEventListener('click', () => updateRole(button.dataset.removeLeader, 'participant', ''));
    });
    administratorList.querySelectorAll('[data-remove-admin]').forEach(button => {
      button.addEventListener('click', async () => {
        const confirmed = await confirmChange(
          'Remove full administrator access?',
          `${button.dataset.personName} will return to participant access and will no longer be able to manage national content or leadership roles.`,
          'Remove full access'
        );
        if(confirmed) await updateRole(button.dataset.removeAdmin, 'participant', '');
      });
    });
    updateAccessForm();
  }

  async function grantAccess(event){
    event.preventDefault();
    const id = document.getElementById('leaderAccount').value;
    const role = viewer.account_role === 'regional_leader'
      ? 'regional_leader'
      : document.getElementById('leaderAccessLevel').value;
    const region = role === 'regional_leader' && viewer.account_role === 'regional_leader'
      ? viewer.region
      : role === 'regional_leader' ? document.getElementById('leaderRegion').value : '';
    if(!id) return setMessage('Choose an account.', true);
    if(role === 'regional_leader' && !region) return setMessage('Choose an Open Bible region.', true);
    if(role === 'cmc_admin'){
      const person = profiles.find(item => item.id === id);
      const confirmed = await confirmChange(
        'Grant full administrator access?',
        `${person?.full_name || person?.email || 'This person'} will be able to manage people across every region, publish courses and task plans, edit the public website, and assign other administrators.`,
        'Grant full access'
      );
      if(!confirmed) return;
    }
    await updateRole(id, role, region);
  }

  async function updateRole(id, role, region){
    const action = role === 'cmc_admin' ? 'Granting full administrator access…'
      : role === 'regional_leader' ? 'Assigning regional access…'
      : 'Removing leadership access…';
    setMessage(action);
    try{
      const response = await fetch('/.netlify/functions/admin-leaders', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify({profile_id:id, account_role:role, region})
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data.ok) throw new Error(data.error || 'Could not update leader access.');
      const index = profiles.findIndex(item => item.id === data.profile.id);
      if(index >= 0) profiles[index] = data.profile;
      render();
      document.getElementById('leaderAccessForm').reset();
      document.getElementById('leaderAccessLevel').value = 'regional_leader';
      if(viewer.account_role === 'regional_leader'){
        document.getElementById('leaderRegion').value = viewer.region || '';
      }
      updateAccessForm();
      setMessage(role === 'cmc_admin' ? 'Full administrator access granted.' : role === 'regional_leader' ? 'Regional access assigned.' : 'Leadership access removed.');
    }catch(error){
      setMessage(error.message, true);
    }
  }

  function renderScope(){
    const regional = viewer.account_role === 'regional_leader';
    document.getElementById('leaderScopeLabel').textContent = regional
      ? `OPEN BIBLE ${String(viewer.region || '').toUpperCase()} REGION`
      : 'NATIONAL LEADERSHIP';
    document.getElementById('leaderManagementTitle').textContent = 'Leadership access';
    document.getElementById('leaderManagementDescription').textContent = regional
      ? 'Assign trusted leaders within your Open Bible region and review exactly what their role includes.'
      : 'Assign regional or full administrator access while keeping responsibilities clear.';
    document.getElementById('leaderScopeName').textContent = regional
      ? `Open Bible ${viewer.region} Region`
      : 'All Open Bible regions';
    document.getElementById('leaderScopeDescription').textContent = regional
      ? 'You can only view and manage leaders in this region.'
      : 'You can view and manage leaders across every region.';
    document.getElementById('leaderRegionField').classList.toggle('hidden', regional);
    const accessLevel = document.getElementById('leaderAccessLevel');
    accessLevel.querySelector('[value="cmc_admin"]').disabled = regional;
    accessLevel.value = 'regional_leader';
    updateAccessForm();
  }

  function updateAccessForm(){
    const role = viewer.account_role === 'regional_leader' ? 'regional_leader' : document.getElementById('leaderAccessLevel').value;
    const fullAdmin = role === 'cmc_admin';
    document.getElementById('leaderRegionField').classList.toggle('hidden', fullAdmin || viewer.account_role === 'regional_leader');
    document.getElementById('leaderRegion').required = !fullAdmin && viewer.account_role !== 'regional_leader';
  }

  function confirmChange(title, message, confirmLabel){
    const dialog = document.getElementById('leaderAccessDialog');
    if(!dialog?.showModal) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    document.getElementById('leaderAccessDialogTitle').textContent = title;
    document.getElementById('leaderAccessDialogMessage').textContent = message;
    document.getElementById('leaderAccessDialogConfirm').textContent = confirmLabel;
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once:true });
    });
  }

  function setMessage(message,isError){
    const element=document.getElementById('leaderAccessMessage');
    element.textContent=message||'';
    element.classList.toggle('error',Boolean(isError));
  }
  function initials(value){return String(value||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
})();
