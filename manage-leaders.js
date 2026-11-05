(async function(){
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const user=await dcAuth.requireUser();
  if(!user)return;
  const profile=await dcAuth.getProfile(user.id).catch(()=>null);
  if(!profile||!['regional_leader','cmc_admin'].includes(profile.account_role)){
    location.replace('dashboard.html');return;
  }
  dcAuth.renderRoleNavigation(profile,'team');
  const session=await dcAuth.getCurrentSession();
  const token=session?.access_token||'';
  let profiles=[],regions=[],viewer=profile,canManageNational=false;
  let selectedId=null,activeFilter='all',search='',loading=false;
  const validRegions=new Set(['Central','East','Mountain Plains','Pacific','Southeast']);
  const nationalOf=p=>{
    const n=p?.cmc_national_access;
    return ['none','viewer','admin'].includes(n)?n:
      p?.account_role==='cmc_admin'?'admin':p?.account_role==='cmc_viewer'?'viewer':'none';
  };
  const regionOf=p=>{
    if(validRegions.has(p?.cmc_regional_director_region))return p.cmc_regional_director_region;
    return p?.cmc_regional_director_region===undefined&&p?.account_role==='regional_leader'?p.region:null;
  };
  const isLeader=p=>Boolean(regionOf(p)||nationalOf(p)!=='none');
  const person=id=>profiles.find(p=>p.id===id)||null;
  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x.slice(0,1)).join('').toUpperCase();
  const nameOf=p=>p?.full_name?.trim()||p?.email||'Team member';
  function setPageMessage(message,error=false){
    const el=$('accessPageMessage');
    el.textContent=message||'';
    el.classList.toggle('hidden',!message);
    el.classList.toggle('error',Boolean(error));
  }
  function setEditorMessage(message,error=false){
    $('leaderAccessMessage').textContent=message||'';
    $('leaderAccessMessage').classList.toggle('error',Boolean(error));
  }
  function nationalLabel(level){
    return level==='admin'?'National administrator':level==='viewer'?'National reporting':null;
  }
  function rolePills(region,national){
    return [
      region?'<span class="cmcRolesPill">'+esc(region)+' · Regional</span>':'',
      national!=='none'?'<span class="cmcRolesPill isNational">'+esc(nationalLabel(national))+'</span>':''
    ].filter(Boolean).join('')||
      '<span class="cmcRolesPill isMuted">Participant access</span>';
  }
  function renderStats(){
    const leadership=profiles.filter(isLeader);
    $('regionalLeaderCount').textContent=leadership.filter(p=>regionOf(p)).length;
    $('administratorCount').textContent=leadership.filter(p=>nationalOf(p)!=='none').length;
  }
  function renderRoster(){
    const people=profiles.filter(isLeader)
      .filter(p=>activeFilter==='all'||
        (activeFilter==='regional'&&Boolean(regionOf(p)))||
        (activeFilter==='national'&&nationalOf(p)!=='none'))
      .filter(p=>(nameOf(p)+' '+(p.email||'')+' '+(regionOf(p)||'')).toLowerCase().includes(search));
    const markup=people.map(p=>{
      const selected=p.id===selectedId;
      return '<button class="cmcRolesPerson'+(selected?' isSelected':'')+'" type="button" data-select-person="'+esc(p.id)+'" aria-pressed="'+selected+'">'+
        '<span class="cmcRolesAvatar" aria-hidden="true">'+esc(initials(nameOf(p)))+'</span>'+
        '<span class="cmcRolesIdentity"><strong>'+esc(nameOf(p))+'</strong>'+
          '<small>'+esc(p.email||'No email address')+(p.id===viewer.id?' · You':'')+'</small>'+
          '<span class="cmcRolesPills">'+rolePills(regionOf(p),nationalOf(p))+'</span>'+
        '</span><span class="cmcRolesPersonArrow" aria-hidden="true">›</span></button>';
    }).join('');
    $('leaderRoster').innerHTML=markup||'<p class="cmcRolesMuted">'+
      (search?'No team members match your search.':'No people in this category.')+'</p>';
    document.querySelectorAll('[data-leader-filter]').forEach(button=>{
      const selected=button.dataset.leaderFilter===activeFilter;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function currentSelection(){
    return {
      region:$('hasRegionalAccess').checked?$('leaderRegion').value:null,
      national:document.querySelector('input[name="nationalAccess"]:checked')?.value||'none'
    };
  }
  function changed(){
    const p=person(selectedId);if(!p)return false;
    const current=currentSelection();
    return current.region!==regionOf(p)||current.national!==nationalOf(p);
  }
  function updatePreview(){
    if(!selectedId)return;
    const p=person(selectedId);
    const current=currentSelection();
    const hasRegion=$('hasRegionalAccess').checked;
    $('regionalAccessRegion').classList.toggle('hidden',!hasRegion);
    $('leaderRegion').required=hasRegion;
    const national=current.national;
    $('leaderAccessPreview').innerHTML=rolePills(hasRegion?current.region||'Region needed':null,national);
    const lines=[];
    if(hasRegion)lines.push(current.region?
      'Can lead '+current.region+' regional work and submit its annual assessment.':
      'Choose the region this director will lead.');
    if(national==='viewer')lines.push('Can view reporting and leadership information from every region.');
    if(national==='admin')lines.push('Can manage CMC people, content, settings, and every region.');
    if(!hasRegion&&national==='none')lines.push('Participant access only; existing pathway work is preserved.');
    $('leaderAccessExplanation').textContent=lines.join(' ');
    const self=p?.id===viewer.id;
    const allowed=!self;
    $('leaderAccessSubmit').disabled=loading||!allowed||!changed()||(hasRegion&&!current.region);
    $('cancelAccessEdits').disabled=loading||!changed();
  }
  function updateAccessForm(){
    const p=person(selectedId);
    $('leaderEditorEmpty').classList.toggle('hidden',Boolean(p));
    $('leaderAccessForm').classList.toggle('hidden',!p);
    if(!p)return;
    const self=p.id===viewer.id;
    $('selectedLeaderAvatar').textContent=initials(nameOf(p));
    $('selectedLeaderName').textContent=nameOf(p);
    $('selectedLeaderEmail').textContent=p.email||'No email address';
    $('selectedSelf').classList.toggle('hidden',!self);
    $('hasRegionalAccess').checked=Boolean(regionOf(p));
    $('hasRegionalAccess').disabled=self;
    $('leaderRegion').innerHTML='<option value="">Choose a region</option>'+
      regions.map(region=>'<option value="'+esc(region)+'">'+esc(region)+'</option>').join('');
    $('leaderRegion').value=regionOf(p)||(!canManageNational?regionOf(viewer)||'':'');
    $('leaderRegion').disabled=self||!canManageNational;
    // A regional manager may assign within their own region, but never grant national access.
    const level=nationalOf(p);
    for(const radio of document.querySelectorAll('input[name="nationalAccess"]')){
      radio.checked=radio.value===level;
      radio.disabled=self||!canManageNational;
    }
    $('nationalAccessRestriction').classList.toggle('hidden',canManageNational||self);
    if(!canManageNational){
      $('nationalAccessRestriction').textContent='National access is managed by a national administrator.';
    }
    setEditorMessage(self?'Your own access cannot be changed here.': '');
    updatePreview();
  }
  function renderPicker(){
    const query=$('accountSearch').value.trim().toLowerCase();
    let options=profiles.filter(p=>!isLeader(p)&&p.id!==viewer.id);
    if(query)options=options.filter(p=>(nameOf(p)+' '+p.email+' '+p.region).toLowerCase().includes(query));
    const visible=options.slice(0,25);
    $('accountPickerResults').innerHTML=visible.map(p=>'<button type="button" class="cmcRolesPickerPerson" data-pick-person="'+esc(p.id)+'">'+
      '<span class="cmcRolesAvatar" aria-hidden="true">'+esc(initials(nameOf(p)))+'</span><span>'+
      '<strong>'+esc(nameOf(p))+'</strong><small>'+esc(p.email||'No email address')+'</small></span></button>').join('')||
      '<p class="cmcRolesMuted">No matching accounts. This person may already be on the leadership team.</p>';
    if(options.length>visible.length){
      $('accountPickerResults').insertAdjacentHTML('beforeend','<p class="cmcRolesMuted">Showing 25 of '+options.length+' matches. Refine your search to find someone else.</p>');
    }
  }
  function hasPendingChanges(){return Boolean(selectedId&&changed());}
  function selectPerson(id,{scroll=false}={}){
    if(hasPendingChanges()&&!window.confirm('Discard your unsaved access changes?'))return false;
    selectedId=id;
    renderRoster();
    updateAccessForm();
    if(scroll&&window.matchMedia('(max-width:840px)').matches){
      $('leaderAccessForm').scrollIntoView({behavior:'smooth',block:'start'});
    }
    return true;
  }
  async function confirmChange(title,message,actionLabel){
    const dialog=$('leaderAccessDialog');
    $('leaderAccessDialogTitle').textContent=title;
    $('leaderAccessDialogMessage').textContent=message;
    $('leaderAccessDialogConfirm').textContent=actionLabel;
    if(!dialog.showModal)return window.confirm(title+'\n\n'+message);
    return new Promise(resolve=>{
      const yes=$('leaderAccessDialogConfirm'),no=$('leaderAccessDialogCancel');
      const cleanup=()=>{yes.removeEventListener('click',accept);no.removeEventListener('click',reject);dialog.removeEventListener('close',dismiss);};
      const accept=()=>{cleanup();dialog.close();resolve(true);};
      const reject=()=>{cleanup();dialog.close();resolve(false);};
      const dismiss=()=>{cleanup();resolve(false);};
      yes.addEventListener('click',accept);
      no.addEventListener('click',reject);
      dialog.addEventListener('close',dismiss);
      dialog.showModal();
    });
  }
  async function saveAccess(event){
    event.preventDefault();
    const p=person(selectedId);if(!p||p.id===viewer.id||loading)return;
    const next=currentSelection();
    if($('hasRegionalAccess').checked&&!next.region){
      setEditorMessage('Choose an Open Bible region.',true);$('leaderRegion').focus();return;
    }
    if(!canManageNational&&next.national!==nationalOf(p)){
      setEditorMessage('Only national administrators can change national access.',true);return;
    }
    if(!changed())return;
    const previous=regionOf(p),previousNational=nationalOf(p);
    const changes=[];
    if(previous!==next.region)changes.push(next.region?
      'Regional director: '+next.region:'Remove regional director responsibility');
    if(previousNational!==next.national)changes.push('National access: '+(nationalLabel(next.national)||'None'));
    let confirmed=true;
    if(previousNational!==next.national||(previous&&previous!==next.region)){
      const highImpact=next.national==='admin';
      const message=nameOf(p)+' will have these permissions after saving: '+
        changes.join('; ')+'. '+(highImpact?
        'A national administrator can manage accounts, courses, and settings in every region.':
        'Their account and existing pathway work will be preserved.');
      confirmed=await confirmChange('Confirm leadership access',message,highImpact?'Grant national administration':'Save changes');
    }
    if(!confirmed)return;
    loading=true;setEditorMessage('Saving access…');updatePreview();
    try{
      const response=await fetch('/.netlify/functions/admin-leaders',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({profile_id:p.id,regional_director_region:next.region,national_access:next.national})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw Error(data.error||'Unable to save access.');
      profiles=profiles.map(item=>item.id===data.profile.id?data.profile:item);
      loading=false;
      renderStats();renderRoster();updateAccessForm();
      setEditorMessage('Access updated. '+nameOf(data.profile)+' now has the selected permissions.');
    }catch(error){
      loading=false;setEditorMessage(error.message,true);updatePreview();
    }
  }
  async function load(){
    setPageMessage('Loading team access…');
    try{
      const response=await fetch('/.netlify/functions/admin-leaders',{headers:{Authorization:'Bearer '+token}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw Error(data.error||'Could not load leadership access.');
      profiles=data.profiles||[];regions=data.regions||[];
      viewer=data.viewer||viewer;canManageNational=Boolean(data.can_manage_national);
      // Prefer a member the current user can edit while keeping self visible in the roster.
      const first=profiles.find(p=>p.id!==viewer.id&&isLeader(p));
      selectedId=selectedId&&person(selectedId)?selectedId:first?.id||null;
      renderStats();renderRoster();updateAccessForm();
      $('addLeaderButton').classList.remove('hidden');
      setPageMessage('');
    }catch(error){setPageMessage(error.message,true);}
  }
  $('leaderRoster').addEventListener('click',event=>{
    const button=event.target.closest('[data-select-person]');
    if(button)selectPerson(button.dataset.selectPerson);
  });
  $('leaderSearch').addEventListener('input',event=>{
    search=event.target.value.trim().toLowerCase();renderRoster();
  });
  document.querySelectorAll('[data-leader-filter]').forEach(button=>{
    button.addEventListener('click',()=>{activeFilter=button.dataset.leaderFilter;renderRoster();});
  });
  $('hasRegionalAccess').addEventListener('change',()=>{
    if($('hasRegionalAccess').checked&&!$('leaderRegion').value&&!canManageNational){
      $('leaderRegion').value=regionOf(viewer)||'';
    }
    updatePreview();
  });
  $('leaderRegion').addEventListener('change',updatePreview);
  document.querySelectorAll('input[name="nationalAccess"]').forEach(radio=>radio.addEventListener('change',updatePreview));
  $('leaderAccessForm').addEventListener('submit',saveAccess);
  $('cancelAccessEdits').addEventListener('click',()=>updateAccessForm());
  $('addLeaderButton').addEventListener('click',()=>{
    $('accountSearch').value='';
    renderPicker();
    $('selectLeaderDialog').showModal();
    $('accountSearch').focus();
  });
  $('closeLeaderPicker').addEventListener('click',()=>$('selectLeaderDialog').close());
  $('accountSearch').addEventListener('input',renderPicker);
  $('accountPickerResults').addEventListener('click',event=>{
    const button=event.target.closest('[data-pick-person]');
    if(!button)return;
    if(selectPerson(button.dataset.pickPerson,{scroll:true})){
      $('selectLeaderDialog').close();
    }
  });
  await load();
})();
