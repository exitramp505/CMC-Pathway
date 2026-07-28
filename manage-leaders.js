(async function(){
  const user = await dcAuth.requireUser();
  if (!user) return;

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  if (profile?.account_role !== 'cmc_admin') {
    window.location.replace(profile?.account_role === 'regional_leader' ? 'leader.html' : 'dashboard.html');
    return;
  }
  dcAuth.renderRoleNavigation(profile, 'leaders');

  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';
  let profiles = [];
  let regions = [];

  document.getElementById('leaderAccessForm').addEventListener('submit', grantAccess);
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
      render();
      setMessage('');
    }catch(error){
      setMessage(error.message, true);
    }
  }

  function render(){
    const candidates = profiles.filter(item => item.account_role === 'participant');
    const leaders = profiles.filter(item => item.account_role === 'regional_leader');
    document.getElementById('leaderAccount').innerHTML =
      '<option value="">Choose an existing account</option>' +
      candidates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.full_name || item.email)} · ${escapeHtml(item.email)}</option>`).join('');
    document.getElementById('leaderRegion').innerHTML =
      '<option value="">Choose a region</option>' +
      regions.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
    document.getElementById('regionalLeaderCount').textContent = String(leaders.length);

    const list = document.getElementById('regionalLeaderList');
    list.innerHTML = leaders.length ? leaders.map(item => `
      <article>
        <span class="cmcAvatar">${initials(item.full_name)}</span>
        <div><strong>${escapeHtml(item.full_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></div>
        <span class="cmcLeaderRegion">${escapeHtml(item.region || 'Region needed')}</span>
        <button type="button" data-remove-leader="${escapeHtml(item.id)}">Remove access</button>
      </article>`).join('') : '<p class="cmcLeaderEmpty">No regional leaders have been assigned yet.</p>';

    list.querySelectorAll('[data-remove-leader]').forEach(button => {
      button.addEventListener('click', () => updateRole(button.dataset.removeLeader, 'participant', ''));
    });
  }

  async function grantAccess(event){
    event.preventDefault();
    const id = document.getElementById('leaderAccount').value;
    const region = document.getElementById('leaderRegion').value;
    if(!id || !region) return setMessage('Choose an account and region.', true);
    await updateRole(id, 'regional_leader', region);
  }

  async function updateRole(id, role, region){
    setMessage(role === 'regional_leader' ? 'Granting regional access…' : 'Removing regional access…');
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
      setMessage(role === 'regional_leader' ? 'Regional access granted.' : 'Regional access removed.');
    }catch(error){
      setMessage(error.message, true);
    }
  }

  function setMessage(message,isError){
    const element=document.getElementById('leaderAccessMessage');
    element.textContent=message||'';
    element.classList.toggle('error',Boolean(isError));
  }
  function initials(value){return String(value||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
})();
