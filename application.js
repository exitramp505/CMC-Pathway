(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const sb = await dcAuth.getSupabaseClient();
  const sessionData = await sb.auth.getSession();
  const accessToken = sessionData.data?.session?.access_token || '';

  const form = document.getElementById('applicationForm');
  const msg = document.getElementById('applicationMessage');
  const stateSelect = document.getElementById('state');
  const regionInput = document.getElementById('region');
  const progressFill = document.getElementById('applicationProgressFill');
  const progressText = document.getElementById('applicationProgressText');
  const statusPill = document.getElementById('applicationStatusPill');
  const autoSaveStatus = document.getElementById('autoSaveStatus');
  let autoSaveTimer = null;
  let isSaving = false;
  let hasLoadedInitialApplication = false;
  let applicationLocked = false;

  dcAuth.fillStateSelect(stateSelect);
  stateSelect.addEventListener('change', () => {
    const autoRegion = dcAuth.regionForState(stateSelect.value);
    if (autoRegion) regionInput.value = autoRegion;
    updateProgress();
    scheduleAutoSave();
  });

  regionInput.addEventListener('change', () => {
    updateProgress();
    scheduleAutoSave();
  });

  maritalStatus.addEventListener('change', () => {
    updateSpouseVisibility();
    scheduleAutoSave();
  });

  document.querySelectorAll('input[name="statementOfFaith"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateStatementExplanationVisibility();
      scheduleAutoSave();
    });
  });

  const profile = await dcAuth.getProfile(user.id).catch(() => null);
  dcAuth.renderRoleNavigation(profile, 'pathway');
  if (profile) {
    fullName.value = profile.full_name || '';
    email.value = profile.email || user.email || '';
    phone.value = profile.phone || '';
    stateSelect.value = profile.state || '';
    regionInput.value = profile.region || dcAuth.regionForState(profile.state || '');
    maritalStatus.value = profile.married === 'Yes' ? 'Married' : '';
  } else {
    email.value = user.email || '';
  }

  function childRow(child={}){
    const div=document.createElement('div');
    div.className='repeatRow childRow';
    div.innerHTML=`<input placeholder="Child name" value="${escAttr(child.name||'')}"><input placeholder="Age" value="${escAttr(child.age||'')}"><select><option value="">Sex</option><option ${child.sex==='F'?'selected':''}>F</option><option ${child.sex==='M'?'selected':''}>M</option></select><button type="button" class="removeRow">Remove</button>`;
    div.querySelector('.removeRow').addEventListener('click',()=>{div.remove();updateProgress();});
    return div;
  }
  function roleRow(role={}){
    const div=document.createElement('div');
    div.className='repeatRow roleRow';
    div.innerHTML=`<input placeholder="Role / Title" value="${escAttr(role.title||'')}"><input placeholder="Church / Ministry" value="${escAttr(role.ministry||'')}"><input placeholder="Years" value="${escAttr(role.years||'')}"><button type="button" class="removeRow">Remove</button>`;
    div.querySelector('.removeRow').addEventListener('click',()=>{div.remove();updateProgress();});
    return div;
  }
  function addChild(child){ childrenList.appendChild(childRow(child)); }
  function addRole(role){ rolesList.appendChild(roleRow(role)); }
  addChildBtn.addEventListener('click',()=>{addChild({}); updateProgress(); scheduleAutoSave();});
  addRoleBtn.addEventListener('click',()=>{addRole({}); updateProgress(); scheduleAutoSave();});
  addChild({});
  addRole({});

  const existing = await fetchApplication(accessToken).catch(()=>null);
  if (existing?.application) {
    populate(existing.application);
    statusPill.textContent = existing.status === 'submitted' ? 'Submitted' : 'Draft';
    statusPill.className = existing.status === 'submitted' ? 'adminPill complete' : 'adminPill pending';
    if (existing.photo_name) photoStatus.textContent = `Uploaded: ${existing.photo_name}`;
    if (existing.resume_name) resumeStatus.textContent = `Uploaded: ${existing.resume_name}`;
    if (existing.status === 'submitted') setApplicationLocked(true);
  }
  updateSpouseVisibility();
  updateStatementExplanationVisibility();
  updateProgress();
  hasLoadedInitialApplication = true;

  form.addEventListener('input', () => { updateProgress(); scheduleAutoSave(); });
  form.addEventListener('change', () => { updateProgress(); scheduleAutoSave(); });
  photo.addEventListener('change', () => validateSelectedFile('photo', photo, photoStatus));
  resume.addEventListener('change', () => validateSelectedFile('resume', resume, resumeStatus));
  saveDraftBtn.addEventListener('click', () => saveApplication('draft', accessToken, { manual: true }));
  submitApplicationBtn.addEventListener('click', () => saveApplication('submitted', accessToken, { manual: true }));

  async function fetchApplication(token){
    const res=await fetch('/.netlify/functions/application-get',{headers:{Authorization:`Bearer ${token}`}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok) return null;
    return data.application;
  }

  function collect(){
    const fd = new FormData(form);
    const data = {};
    for (const [key,val] of fd.entries()) {
      if (val instanceof File) continue;
      if (key === 'plantingExperience') {
        if (!data[key]) data[key]=[];
        data[key].push(val);
      } else if (key in data) {
        if (!Array.isArray(data[key])) data[key]=[data[key]];
        data[key].push(val);
      } else {
        data[key]=val;
      }
    }
    data.children = Array.from(document.querySelectorAll('#childrenList .childRow')).map(row=>{
      const [name,age,sex] = row.querySelectorAll('input,select');
      return {name:name.value.trim(), age:age.value.trim(), sex:sex.value.trim()};
    }).filter(x=>x.name||x.age||x.sex);
    data.roles = Array.from(document.querySelectorAll('#rolesList .roleRow')).map(row=>{
      const [title,ministry,years] = row.querySelectorAll('input');
      return {title:title.value.trim(), ministry:ministry.value.trim(), years:years.value.trim()};
    }).filter(x=>x.title||x.ministry||x.years);
    data.region = regionInput.value || dcAuth.regionForState(data.state);
    data.updatedAt = new Date().toISOString();
    return data;
  }

  function populate(data){
    if (!data) return;
    for (const [key,val] of Object.entries(data)) {
      if (key === 'children' || key === 'roles' || key === 'plantingExperience') continue;
      const el = form.elements[key];
      if (el && typeof el.value !== 'undefined') el.value = val || '';
    }
    if (data.state) {
      stateSelect.value = data.state;
      regionInput.value = data.region || dcAuth.regionForState(data.state);
    }
    document.querySelectorAll('input[name="plantingExperience"]').forEach(cb => {
      cb.checked = Array.isArray(data.plantingExperience) && data.plantingExperience.includes(cb.value);
    });
    document.querySelectorAll('input[name="statementOfFaith"]').forEach(radio => {
      radio.checked = data.statementOfFaith === radio.value;
    });
    document.querySelectorAll('input[type="checkbox"]:not([name="plantingExperience"])').forEach(cb=>{
      if(data[cb.name]) cb.checked = true;
    });
    childrenList.innerHTML='';
    (data.children && data.children.length ? data.children : [{}]).forEach(addChild);
    rolesList.innerHTML='';
    (data.roles && data.roles.length ? data.roles : [{}]).forEach(addRole);
  }

  async function saveApplication(status, token, options = {}){
    if (applicationLocked) {
      msg.textContent = 'This application has been submitted and is locked. Ask your CMC leader to reopen it if a change is needed.';
      return;
    }
    if (isSaving) return;
    isSaving = true;
    const manual = options.manual === true;
    if (manual) msg.textContent = status === 'submitted' ? 'Submitting application...' : 'Saving draft...';
    if (status === 'draft') setAutoSaveStatus('Saving...');
    saveDraftBtn.disabled = true;
    submitApplicationBtn.disabled = true;
    try {
      const application = collect();
      const uploads = [];
      const photoFile = photo.files[0];
      const resumeFile = resume.files[0];
      if (photoFile) uploads.push(await uploadFile('photo', photoFile));
      if (resumeFile) uploads.push(await uploadFile('resume', resumeFile));
      const res = await fetch('/.netlify/functions/application-submit', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify({status, application, uploads})
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok) throw new Error(data.error || 'Could not save application.');
      statusPill.textContent = status === 'submitted' ? 'Submitted' : 'Draft';
      statusPill.className = status === 'submitted' ? 'adminPill complete' : 'adminPill pending';
      if (data.photoName) photoStatus.textContent = `Uploaded: ${data.photoName}`;
      if (data.resumeName) resumeStatus.textContent = `Uploaded: ${data.resumeName}`;
      if (photoFile) photo.value = '';
      if (resumeFile) resume.value = '';
      if (manual || status === 'submitted') msg.textContent = status === 'submitted' ? 'Application submitted.' : 'Draft saved.';
      if (status === 'draft') setAutoSaveStatus(`Saved ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`);
      updateProgress();
      if (status === 'submitted') {
        setApplicationLocked(true);
        window.location.href = 'application-confirmation.html';
        return;
      }
    } catch (err) {
      if (manual || status === 'submitted') msg.textContent = err.message || 'Could not save application.';
      if (status === 'draft') setAutoSaveStatus(err.message || 'Auto-save failed. Click Save Draft.');
    } finally {
      saveDraftBtn.disabled = false;
      submitApplicationBtn.disabled = false;
      isSaving = false;
    }
  }

  function completionPercent(){
    const data=collect();
    const keys=['fullName','birthDate','email','phone','state','address','city','zip','maritalStatus','conversionStory','callToMinistry','hasSponsor','licenseStatus','lastYearIncome','averageIncome','bankruptcy','whyPlant','plantType','targetAudience','financialPlan','plantTiming','supportNetwork','waiverAgreement','statementOfFaith','coreConvictions'];
    const done=keys.filter(k=>{
      const v=data[k];
      return Array.isArray(v) ? v.length : String(v||'').trim();
    }).length;
    return Math.round((done/keys.length)*100);
  }
  function updateProgress(){
    const pct = completionPercent();
    progressFill.style.width = pct + '%';
    progressText.textContent = `${pct}% complete`;
  }


  function scheduleAutoSave(delay = 2000){
    if (!hasLoadedInitialApplication || applicationLocked) return;
    clearTimeout(autoSaveTimer);
    setAutoSaveStatus('Unsaved changes');
    autoSaveTimer = setTimeout(() => saveApplication('draft', accessToken), delay);
  }

  function setAutoSaveStatus(text){
    if (autoSaveStatus) autoSaveStatus.textContent = text;
  }

  function updateSpouseVisibility(){
    const isMarried = maritalStatus.value === 'Married';
    spouseInfoBlock.classList.toggle('hidden', !isMarried);
    if (!isMarried) {
      spouseInfoBlock.querySelectorAll('input').forEach(input => input.value = '');
    }
  }

  function updateStatementExplanationVisibility(){
    const selected = document.querySelector('input[name="statementOfFaith"]:checked')?.value;
    statementExplainBlock.classList.toggle('hidden', selected !== 'No');
  }

  async function uploadFile(kind, originalFile){
    const prepared = kind === 'photo' ? await optimizePhoto(originalFile) : originalFile;
    const mimeType=validateFile(kind, prepared, originalFile.name);
    const safeName = originalFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').slice(-100) || 'upload';
    const path = `${user.id}/${kind}-${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from('candidate-uploads').upload(path, prepared, {
      contentType:mimeType,
      upsert:false
    });
    if(error) throw new Error(`Could not upload ${originalFile.name}. ${error.message || ''}`.trim());
    return { kind, path, fileName:originalFile.name, mimeType, size:prepared.size };
  }

  async function validateSelectedFile(kind, input, statusElement){
    const file = input.files[0];
    if(!file) return;
    try{
      validateFile(kind, file, file.name);
      statusElement.textContent = `${file.name} is ready to upload.`;
      scheduleAutoSave(300);
    }catch(error){
      input.value='';
      statusElement.textContent=error.message;
      msg.textContent=error.message;
    }
  }

  function validateFile(kind, file, displayName){
    const photoTypes=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
    const resumeTypes=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const inferredType=inferMimeType(displayName);
    const mimeType=(file.type||inferredType).toLowerCase();
    const max=kind==='photo'?25*1024*1024:15*1024*1024;
    const allowed=kind==='photo'?photoTypes:resumeTypes;
    if(!allowed.includes(mimeType))throw new Error(kind==='photo'?'Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.':'Choose a PDF, DOC, or DOCX résumé.');
    if(file.size>max)throw new Error(kind==='photo'?'Keep photos under 25 MB.':'Keep résumés under 15 MB.');
    if(!file.type&&inferredType){try{Object.defineProperty(file,'type',{value:inferredType});}catch(_){}}
    return mimeType;
  }

  function inferMimeType(name){
    const extension=String(name||'').split('.').pop().toLowerCase();
    return {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[extension]||'';
  }

  async function optimizePhoto(file){
    const type=(file.type||inferMimeType(file.name)).toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(type))return file;
    try{
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
      if(scale===1&&file.size<=5*1024*1024){bitmap.close();return file;}
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
      return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'}):file;
    }catch(_){return file;}
  }

  function setApplicationLocked(locked){
    applicationLocked=Boolean(locked);
    form.querySelectorAll('input,select,textarea,button').forEach(control=>{control.disabled=applicationLocked;});
    if(applicationLocked){
      clearTimeout(autoSaveTimer);
      statusPill.textContent='Submitted';
      statusPill.className='adminPill complete';
      setAutoSaveStatus('Submitted and locked');
      msg.textContent='Your application has been submitted. A CMC leader can reopen it if changes are needed.';
    }
  }

  function escAttr(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
})();
