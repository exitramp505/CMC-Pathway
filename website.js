(async function(){
  const localPreview=['localhost','127.0.0.1'].includes(window.location.hostname)&&new URLSearchParams(window.location.search).has('preview');
  const user=localPreview?{id:'preview'}:await dcAuth.requireUser(); if(!user)return;
  const profile=localPreview?{account_role:'cmc_admin'}:await dcAuth.getProfile(user.id).catch(()=>null);
  if(profile?.account_role!=='cmc_admin'){window.location.replace('dashboard.html');return}
  dcAuth.renderRoleNavigation(profile,'website');
  const sb=localPreview?null:await dcAuth.getSupabaseClient();
  const session=localPreview?null:await sb.auth.getSession();
  const token=session?.data?.session?.access_token||'';
  const editor=document.getElementById('websiteEditor');
  const state={active:'team',content:{},dirty:false};
  const META={
    team:['ABOUT PAGE','CMC team','Manage the people shown on the public About page.'],
    resources:['RESOURCES PAGE','Resources','Manage the resources and featured introduction on the public Resources page.'],
    models:['MODELS PAGE','Church models','Manage the church models visitors can explore on the public Models page.'],
    discern:['DISCERN PAGE','Discernment event','Manage the public description and registration details for the Discernment event.']
  };
  document.querySelectorAll('[data-site-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.siteTab)));
  document.getElementById('saveWebsiteDraft').addEventListener('click',()=>save('draft'));
  document.getElementById('publishWebsiteSection').addEventListener('click',()=>save('publish'));
  editor.addEventListener('input',()=>{state.dirty=true;setStatus('Unsaved changes')});
  editor.addEventListener('click',handleEditorClick);
  window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue=''}});
  await load();

  async function load(){
    if(localPreview){state.content=previewContent();render();message('Local preview. Changes stay in this browser and are not published.');return}
    try{
      const response=await fetch('/.netlify/functions/site-content-admin',{headers:{Authorization:`Bearer ${token}`}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||'Could not load website content.');
      (data.content||[]).forEach(item=>state.content[item.content_key]=item);
      render();
    }catch(error){message(error.message,true)}
  }
  function selectTab(key){
    if(state.dirty&&!window.confirm('Discard unsaved changes in this section?'))return;
    state.active=key;state.dirty=false;
    document.querySelectorAll('[data-site-tab]').forEach(button=>button.classList.toggle('active',button.dataset.siteTab===key));
    render();
  }
  function render(){
    const meta=META[state.active];
    document.getElementById('websiteSectionEyebrow').textContent=meta[0];
    document.getElementById('websiteSectionTitle').textContent=meta[1];
    document.getElementById('websiteSectionHelp').textContent=meta[2];
    const item=state.content[state.active]||{draft_data:defaults(state.active)};
    const data=clone(item.draft_data&&Object.keys(item.draft_data).length?item.draft_data:defaults(state.active));
    editor.dataset.value=JSON.stringify(data);
    if(state.active==='team')renderTeam(data);
    if(state.active==='resources')renderResources(data);
    if(state.active==='models')renderModels(data);
    if(state.active==='discern')renderDiscern(data);
    setStatus('Draft saved');
    document.getElementById('websitePublishedAt').textContent=item.published_at?`Published ${formatDate(item.published_at)}`:'Not published yet';
    message('');
  }
  function renderTeam(data){
    editor.innerHTML=`<div class="cmcWebsiteRepeater">${(data.team||[]).map((member,index)=>card('Team member',index,`
      <div class="cmcWebsitePortraitPreview" data-portrait-preview>${member.image?`<img src="${escapeAttr(member.image)}" alt="Preview for ${escapeAttr(member.name||'team member')}" style="object-position:${Number(member.imagePositionX??50)}% ${Number(member.imagePositionY??30)}%">`:`<span>${escapeHtml(initials(member.name)||'Photo')}</span>`}</div>
      ${input('Region','region',member.region)}${input('Name','name',member.name)}${input('Title','title',member.title)}
      <div class="cmcWebsiteImageField"><label>Picture<input data-field="image" value="${escapeAttr(member.image||'')}" placeholder="Image URL"></label>
      <label class="cmcWebsiteUpload">Upload picture<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-upload-index="${index}"></label></div>
      <div class="cmcWebsitePositionFields">${numberInput('Focus left/right','imagePositionX',member.imagePositionX??50,0,100)}${numberInput('Focus up/down','imagePositionY',member.imagePositionY??50,0,100)}</div>`)).join('')}</div>${addButton('team member')}`;
    bindInputs(data,'team');bindUploads(data);
  }
  function renderResources(data){
    editor.innerHTML=`<section class="cmcWebsiteSettings"><h3>Page introduction</h3>${input('Eyebrow','heroEyebrow',data.heroEyebrow)}${input('Headline','heroTitle',data.heroTitle)}${textarea('Intro','heroDescription',data.heroDescription)}${input('Featured heading','featuredTitle',data.featuredTitle)}${textarea('Featured description','featuredDescription',data.featuredDescription)}</section>
    <div class="cmcWebsiteRepeater">${(data.resources||[]).map((item,index)=>card('Resource',index,`${input('Category','category',item.category)}${input('Title','title',item.title)}${textarea('Description','description',item.description)}${input('Button label','buttonText',item.buttonText)}${input('Link','buttonUrl',item.buttonUrl)}<label class="cmcWebsiteCheck"><input data-field="featured" type="checkbox" ${item.featured?'checked':''}> Featured resource</label>`)).join('')}</div>${addButton('resource')}`;
    bindRootInputs(data);bindInputs(data,'resources');
  }
  function renderModels(data){
    editor.innerHTML=`<div class="cmcWebsiteRepeater">${(data.models||[]).map((item,index)=>card('Church model',index,`${input('Name','title',item.title)}${input('Movement','movement',item.movement)}${textarea('Summary','summary',item.summary)}${textarea('Best suited for','bestSuitedFor',item.bestSuitedFor)}${textarea('What strengthens it','whatStrengthensIt',item.whatStrengthensIt)}`)).join('')}</div>${addButton('church model')}`;
    bindInputs(data,'models');
  }
  function renderDiscern(data){
    editor.innerHTML=`<section class="cmcWebsiteSettings">${input('Eyebrow','heroEyebrow',data.heroEyebrow)}${input('Headline','heroTitle',data.heroTitle)}${textarea('Introduction','heroDescription',data.heroDescription)}${input('What to expect heading','whatToExpectTitle',data.whatToExpectTitle)}${textarea('What to expect, paragraph one','whatToExpectParagraphOne',data.whatToExpectParagraphOne)}${textarea('What to expect, paragraph two','whatToExpectParagraphTwo',data.whatToExpectParagraphTwo)}${input('Dates','dates',data.dates)}${input('Location','location',data.location)}${input('Application link','applicationUrl',data.applicationUrl)}</section>`;
    bindRootInputs(data);
  }
  function handleEditorClick(event){
    const add=event.target.closest('[data-add-item]');
    if(add){const data=currentData();const key=listKey();data[key]=data[key]||[];data[key].push(blankItem(state.active));storeAndRerender(data);return}
    const remove=event.target.closest('[data-remove-index]');
    if(remove){const data=currentData();data[listKey()].splice(Number(remove.dataset.removeIndex),1);storeAndRerender(data)}
  }
  function bindRootInputs(data){editor.querySelectorAll('[data-root-field]').forEach(el=>el.addEventListener('input',()=>{data[el.dataset.rootField]=value(el);sync(data)}))}
  function bindInputs(data,key){editor.querySelectorAll('[data-item-index] [data-field]').forEach(el=>el.addEventListener('input',()=>{const card=el.closest('[data-item-index]');const index=Number(card.dataset.itemIndex);data[key][index][el.dataset.field]=value(el);sync(data);if(key==='team')updatePortrait(card,data[key][index])}))}
  function updatePortrait(card,member){const preview=card.querySelector('[data-portrait-preview]');if(!preview)return;if(member.image){preview.innerHTML=`<img src="${escapeAttr(member.image)}" alt="Preview for ${escapeAttr(member.name||'team member')}" style="object-position:${Number(member.imagePositionX??50)}% ${Number(member.imagePositionY??30)}%">`}else{preview.innerHTML=`<span>${escapeHtml(initials(member.name)||'Photo')}</span>`}}
  function bindUploads(data){editor.querySelectorAll('[data-upload-index]').forEach(input=>input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.size>4*1024*1024){message('The image is larger than 4 MB. Please choose a smaller JPG, PNG, WebP, or AVIF file.',true);input.value='';return}
    input.disabled=true;message('Uploading picture…');
    try{const encoded=await fileData(file);const response=await fetch('/.netlify/functions/site-media-upload',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({content_type:file.type,data:encoded})});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error(result.error||'Upload failed.');data.team[Number(input.dataset.uploadIndex)].image=result.url;storeAndRerender(data);message('Picture uploaded. Publish the Team section when ready.')}catch(error){message(error.message,true)}finally{input.disabled=false}
  }))}
  async function save(action){
    const data=currentData();const button=document.getElementById(action==='publish'?'publishWebsiteSection':'saveWebsiteDraft');button.disabled=true;
    message(action==='publish'?'Publishing changes…':'Saving draft…');
    if(localPreview){state.content[state.active]={draft_data:clone(data),published_data:action==='publish'?clone(data):state.content[state.active]?.published_data||{},published_at:action==='publish'?new Date().toISOString():state.content[state.active]?.published_at};state.dirty=false;render();message(action==='publish'?'Preview published locally. Nothing was sent to the live website.':'Preview draft saved locally.');button.disabled=false;return}
    try{const response=await fetch('/.netlify/functions/site-content-admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({content_key:state.active,data,action})});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error(result.error||'Could not save changes.');state.content[state.active]=result.item;state.dirty=false;setStatus('Draft saved');document.getElementById('websitePublishedAt').textContent=result.item.published_at?`Published ${formatDate(result.item.published_at)}`:'Not published yet';message(action==='publish'?'Published. The public website will update within a few minutes.':'Draft saved.')}catch(error){message(error.message,true)}finally{button.disabled=false}
  }
  function currentData(){try{return JSON.parse(editor.dataset.value||'{}')}catch{return defaults(state.active)}}
  function sync(data){editor.dataset.value=JSON.stringify(data);state.dirty=true;setStatus('Unsaved changes')}
  function storeAndRerender(data){editor.dataset.value=JSON.stringify(data);state.dirty=true;if(state.active==='team')renderTeam(data);if(state.active==='resources')renderResources(data);if(state.active==='models')renderModels(data);setStatus('Unsaved changes')}
  function listKey(){return state.active==='team'?'team':state.active==='models'?'models':'resources'}
  function card(label,index,body){return `<article class="cmcWebsiteItem" data-item-index="${index}"><header><strong>${label} ${String(index+1).padStart(2,'0')}</strong><button type="button" data-remove-index="${index}">Remove</button></header><div class="cmcWebsiteFieldGrid">${body}</div></article>`}
  function input(label,field,val){return `<label>${label}<input ${['heroEyebrow','heroTitle','heroDescription','featuredTitle','featuredDescription','whatToExpectTitle','whatToExpectParagraphOne','whatToExpectParagraphTwo','dates','location','applicationUrl'].includes(field)?`data-root-field="${field}"`:`data-field="${field}"`} value="${escapeAttr(val||'')}"></label>`}
  function numberInput(label,field,val,min,max){return `<label>${label}<input data-field="${field}" type="number" min="${min}" max="${max}" value="${escapeAttr(val)}"></label>`}
  function textarea(label,field,val){return `<label class="full">${label}<textarea ${['heroDescription','featuredDescription','whatToExpectParagraphOne','whatToExpectParagraphTwo'].includes(field)?`data-root-field="${field}"`:`data-field="${field}"`} rows="3">${escapeHtml(val||'')}</textarea></label>`}
  function addButton(label){return `<button class="cmcWebsiteAdd" type="button" data-add-item>Add ${label} ＋</button>`}
  function value(el){return el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value}
  function message(text,error){const el=document.getElementById('websiteMessage');el.textContent=text||'';el.classList.toggle('error',Boolean(error))}
  function setStatus(text){document.getElementById('websiteDraftStatus').textContent=text}
  function defaults(key){return key==='team'?{team:[]}:key==='resources'?{heroEyebrow:'',heroTitle:'',heroDescription:'',featuredTitle:'',featuredDescription:'',resources:[]}:key==='models'?{models:[]}:{heroEyebrow:'',heroTitle:'',heroDescription:'',whatToExpectTitle:'',whatToExpectParagraphOne:'',whatToExpectParagraphTwo:'',dates:'',location:'',applicationUrl:''}}
  function previewContent(){return {
    team:{draft_data:{team:[{region:'Mountain Plains Region',name:'Rob Bray',title:'Director of Multiplication',image:'',imagePositionX:50,imagePositionY:30},{region:'East Region',name:'George Williams',title:'Director of Multiplication',image:'',imagePositionX:50,imagePositionY:30}]},published_at:new Date().toISOString()},
    resources:{draft_data:{heroEyebrow:'Resources',heroTitle:'Tools for pastors, pioneers, and multiplying churches.',heroDescription:'A growing library of practical resources for the next faithful step.',featuredTitle:'Start here',featuredDescription:'Core resources for leaders exploring multiplication.',resources:[{title:'Discover: Church Multiplication 101',category:'Pathway',description:'A biblical and practical introduction to church multiplication.',buttonText:'Learn about Discover',buttonUrl:'/discover',featured:true}]},published_at:new Date().toISOString()},
    models:{draft_data:{models:[{title:'Church Launch',movement:'Gather · Launch · Establish',summary:'A prepared leadership team forms a visible new congregation.',bestSuitedFor:'A pioneer and launch team with a defined community.',whatStrengthensIt:'Prayer, coaching, planning, and accountable leadership.'}]},published_at:new Date().toISOString()},
    discern:{draft_data:{heroEyebrow:'Discernment Event',heroTitle:'Discern your next faithful step.',heroDescription:'Clarify calling, assess readiness, and receive wise feedback.',whatToExpectTitle:'A multi-day gathering built for real discernment.',whatToExpectParagraphOne:'Candidates and leaders listen carefully and assess honestly.',whatToExpectParagraphTwo:'The experience includes exercises, interviews, and guided reflection.',dates:'May 25–27, 2027',location:'Des Moines, Iowa',applicationUrl:'/contact'},published_at:new Date().toISOString()}
  }}
  function blankItem(key){return key==='team'?{region:'',name:'',title:'',image:'',imagePositionX:50,imagePositionY:50}:key==='models'?{title:'',movement:'',summary:'',bestSuitedFor:'',whatStrengthensIt:''}:{category:'',title:'',description:'',buttonText:'',buttonUrl:'',featured:false}}
  function clone(value){return JSON.parse(JSON.stringify(value||{}))}
  function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read.'));reader.readAsDataURL(file)})}
  function formatDate(value){return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))}
  function initials(value){return String(value||'').split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,3).toUpperCase()}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]))}
  function escapeAttr(value){return escapeHtml(value)}
})();
