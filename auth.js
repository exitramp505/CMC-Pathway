(function(){
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico'};
const REGION_BY_STATE={WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',FL:'Southeast',GA:'Southeast',AL:'Southeast',MS:'Southeast',LA:'Southeast',SC:'Southeast',NC:'Southeast',PR:'Southeast'};
function fillStateSelect(select){if(!select)return;select.innerHTML='<option value="">Select state</option>'+Object.entries(STATES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
function regionForState(state){return REGION_BY_STATE[state]||'Unassigned'}
async function readPublicConfig(url){
 const res=await fetch(url,{credentials:'omit'});
 const cfg=await res.json().catch(()=>({}));
 if(!res.ok||!cfg.url||!cfg.anonKey){
  throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Netlify.');
 }
 // Keys are public but no script should ever accept credentials from an
 // untrusted/non-HTTPS config URL.
 const parsed=new URL(cfg.url);
 if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password){
  throw new Error('Invalid public Supabase URL.');
 }
 return cfg;
}
let supabaseClientPromise;
async function getSupabaseClient(){
 if(supabaseClientPromise)return supabaseClientPromise;
 supabaseClientPromise=(async()=>{
  // Netlify generates this static file during each deploy. It contains only
  // the public URL and anonymous key, not any service credentials, and avoids
  // starting a Lambda just to configure Supabase. Keep the established
  // function as fallback for local/preview builds or a missing static file.
  let cfg;
  try{
    cfg=await readPublicConfig('/cmc-public-config.json');
  }catch(_){
    cfg=await readPublicConfig('/.netlify/functions/supabase-config');
  }
  return window.supabase.createClient(cfg.url,cfg.anonKey);
 })().catch(error=>{
  // A temporary configuration failure should not block all retries.
  supabaseClientPromise=null;
  throw error;
 });
 return supabaseClientPromise;
}
async function getCurrentSession(){const sb=await getSupabaseClient();const {data}=await sb.auth.getSession();return data.session||null}
async function requireUser(){const session=await getCurrentSession(); if(!session){window.location.href='login.html';return null} return session.user}
async function signOut(){const sb=await getSupabaseClient(); await sb.auth.signOut(); window.location.href='login.html'}
async function getProfile(userId){const sb=await getSupabaseClient(); const {data,error}=await sb.from('candidate_profiles').select('*').eq('id',userId).maybeSingle(); if(error) throw error; return data}
async function upsertProfile(profile){const session=await getCurrentSession();if(!session?.access_token)throw new Error('Please log in again to save your profile.');const response=await fetch('/.netlify/functions/profile-self',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(profile||{})});const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw new Error(data.error||'Could not save your profile.');return data.profile}
function setupLogout(){document.querySelectorAll('#logoutBtn').forEach(btn=>btn.addEventListener('click',signOut))}
let autoHideHeaderInitialized=false;
function setupAutoHideHeader(){
 if(autoHideHeaderInitialized)return;
 const header=document.querySelector('.cmcHeader');
 if(!header)return;
 autoHideHeaderInitialized=true;
 header.classList.add('cmcHeaderAutoHide');
 let lastY=Math.max(window.scrollY,0);
 let downwardDistance=0;
 let upwardDistance=0;
 let direction='idle';
 let ticking=false;
 const reveal=()=>{
  header.classList.remove('cmcHeaderHidden');
  downwardDistance=0;
  upwardDistance=0;
  direction='idle';
 };
 const update=()=>{
  const y=Math.max(window.scrollY,0);
  const delta=y-lastY;
  const navigationFocused=header.contains(document.activeElement);
  const mobile=window.matchMedia('(max-width: 720px)').matches;
  const noiseThreshold=mobile?6:4;
  const hideThreshold=mobile?92:72;
  const revealThreshold=mobile?170:120;
  const topRevealPoint=mobile?118:100;
  header.classList.toggle('cmcHeaderScrolled',y>12);
  if(y<topRevealPoint||navigationFocused||header.querySelector('[aria-expanded="true"]')){
   reveal();
   lastY=y;
  }else if(Math.abs(delta)<noiseThreshold){
   ticking=false;
   return;
  }else if(delta<0){
   if(direction!=='up')upwardDistance=0;
   direction='up';
   downwardDistance=0;
   upwardDistance+=Math.abs(delta);
   if(upwardDistance>=revealThreshold)reveal();
  }else if(delta>0&&y>150){
   if(direction!=='down')downwardDistance=0;
   direction='down';
   upwardDistance=0;
   downwardDistance+=delta;
   if(downwardDistance>=hideThreshold)header.classList.add('cmcHeaderHidden');
  }
  lastY=y;
  ticking=false;
 };
 window.addEventListener('scroll',()=>{
  if(ticking)return;
  ticking=true;
  window.requestAnimationFrame(update);
 },{passive:true});
 header.addEventListener('focusin',reveal);
 window.addEventListener('pageshow',reveal);
}
// Visibility follows the existing page/API guards. National administrators are
// stored as cmc_admin by effectiveRole, including regional + national admins.
function roleNavigationItems(profile){
 const role=profile?.account_role||'participant';
 const nationalAccess=['none','viewer','admin'].includes(profile?.cmc_national_access)
  ?profile.cmc_national_access:(role==='cmc_admin'?'admin':role==='cmc_viewer'?'viewer':'none');
 const nationalReports=nationalAccess==='viewer'||nationalAccess==='admin';
 const leader=['regional_leader','cmc_admin','cmc_viewer'].includes(role);
 const manager=['regional_leader','cmc_admin'].includes(role);
 const admin=role==='cmc_admin';
 return [
  {key:'home',label:'Home',href:'leadership-home.html',show:leader},
  {key:'people',label:'People',href:'leader.html',show:manager},
  {key:'health',label:'Regional Health',href:nationalReports?'regional-reports.html':'regional-assessment.html',show:leader},
  {key:'pathway',label:'My Pathway',href:role==='participant'?'dashboard.html':'dashboard.html?view=participant',show:role!=='cmc_viewer'},
  {key:'events',label:'Events',href:'events.html',group:'Planning',show:manager},
  {key:'plans',label:'Task Plans',href:'task-plans.html',group:'Planning',show:admin},
  {key:'courses',label:'Courses',href:'courses.html',group:'Content',show:admin},
  {key:'website',label:'Website',href:'website.html',group:'Content',show:admin},
  {key:'team',label:'Team',href:'coaching.html',group:'Administration',show:manager},
  {key:'coaching',label:'My People',href:'coach.html',group:'Administration',show:Boolean(profile?.is_coach)},
  {key:'settings',label:'National Settings',href:'national-settings.html',group:'Administration',show:admin}
 ].filter(item=>item.show);
}
let navigationCleanup;
function renderRoleNavigation(profile,activeKey){
 const nav=document.getElementById('cmcRoleNav');
 if(!nav)return;
 navigationCleanup?.();
 nav.setAttribute('aria-label','Main navigation');
 const items=roleNavigationItems(profile);
 const currentKey=activeKey==='calendar'?'home':activeKey;
 const link=item=>`<a href="${item.href}"${item.key===currentKey?' class="active" aria-current="page"':''}>${item.label}</a>`;
 const groups=['Planning','Content','Administration'].map(group=>{
  const members=items.filter(item=>item.group===group);
  return members.length?`<section class="cmcNavGroup" aria-label="${group}"><h2>${group}</h2>${members.map(link).join('')}</section>`:'';
 }).join('');
 const manageActive=items.some(item=>item.group&&item.key===currentKey);
 const chevron='<span class="cmcNavChevron" aria-hidden="true">⌄</span>';
 nav.innerHTML=`<button class="cmcCompactToggle" type="button" aria-expanded="false" aria-controls="cmcPrimaryLinks" aria-label="Open navigation"><span aria-hidden="true">☰</span><span>Menu</span></button>
  <div id="cmcPrimaryLinks" class="cmcPrimaryLinks">${items.filter(item=>!item.group).map(link).join('')}
  ${groups?`<div class="cmcNavDisclosure"><button id="cmcManageToggle" class="cmcDisclosureToggle${manageActive?' active':''}" type="button" aria-expanded="false" aria-controls="cmcManagePanel">Manage ${chevron}</button><div id="cmcManagePanel" class="cmcDisclosurePanel" hidden>${groups}</div></div>`:''}</div>
  <div class="cmcNavDisclosure cmcAccount"><button id="cmcAccountToggle" class="cmcAccountToggle${activeKey==='profile'?' active':''}" type="button" aria-label="Account menu" aria-expanded="false" aria-controls="cmcAccountPanel"><span class="cmcAvatar" aria-hidden="true"></span>${chevron}</button><div id="cmcAccountPanel" class="cmcDisclosurePanel" hidden><div class="cmcAccountIdentity"></div><a href="profile.html"${activeKey==='profile'?' class="active" aria-current="page"':''}>Profile</a><button id="logoutBtn" type="button">Logout</button></div></div>`;
 const name=profile?.full_name?.trim()||'Your account';
 nav.querySelector('.cmcAccountIdentity').textContent=name;
 nav.querySelector('.cmcAvatar').textContent=profile?.full_name?.trim().split(/\s+/).map(part=>Array.from(part)[0]).slice(0,2).join('').toUpperCase()||'CM';
 nav.closest('.cmcHeader')?.classList.add('cmcCompactHeader');
 const mobileToggle=nav.querySelector('.cmcCompactToggle');
 const primary=nav.querySelector('.cmcPrimaryLinks');
 const media=window.matchMedia('(max-width: 960px)');
 const toggles=[...nav.querySelectorAll('.cmcNavDisclosure > button')];
 const panel=button=>document.getElementById(button.getAttribute('aria-controls'));
 const closeDisclosures=()=>toggles.forEach(button=>{button.setAttribute('aria-expanded','false');panel(button).hidden=true;});
 const closeMobile=()=>{nav.classList.remove('cmcCompactOpen');mobileToggle.setAttribute('aria-expanded','false');mobileToggle.setAttribute('aria-label','Open navigation');};
 toggles.forEach(button=>button.addEventListener('click',()=>{
  const opening=button.getAttribute('aria-expanded')!=='true';
  closeDisclosures();
  if(button.id==='cmcAccountToggle')closeMobile();
  button.setAttribute('aria-expanded',String(opening));panel(button).hidden=!opening;
 }));
 mobileToggle.addEventListener('click',()=>{
  const opening=mobileToggle.getAttribute('aria-expanded')!=='true';
  closeDisclosures();nav.classList.toggle('cmcCompactOpen',opening);
  mobileToggle.setAttribute('aria-expanded',String(opening));
  mobileToggle.setAttribute('aria-label',opening?'Close navigation':'Open navigation');
 });
 const onClick=event=>{if(!nav.contains(event.target)||event.target.closest('a,#logoutBtn')){closeDisclosures();closeMobile();}};
 const onFocus=event=>{
  toggles.forEach(button=>{if(!button.parentElement.contains(event.target)){button.setAttribute('aria-expanded','false');panel(button).hidden=true;}});
  if(!nav.contains(event.target))closeMobile();
 };
 const onKey=event=>{
  if(!nav.contains(event.target))return;
  const open=toggles.find(button=>button.getAttribute('aria-expanded')==='true');
  if(event.key==='Escape'){
   if(open){closeDisclosures();open.focus();event.preventDefault();}
   else if(mobileToggle.getAttribute('aria-expanded')==='true'){closeMobile();mobileToggle.focus();event.preventDefault();}
  }
  // Native links + disclosure buttons retain normal Tab/Shift+Tab semantics.
  // Arrow keys are an additional convenience, not an ARIA menu requirement.
  const trigger=toggles.find(button=>button===event.target);
  if(trigger&&['ArrowDown','ArrowUp'].includes(event.key)){
   event.preventDefault();closeDisclosures();trigger.setAttribute('aria-expanded','true');panel(trigger).hidden=false;
   const links=panel(trigger).querySelectorAll('a,button');links[event.key==='ArrowUp'?links.length-1:0]?.focus();
  }else if(open&&panel(open).contains(event.target)&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const links=[...panel(open).querySelectorAll('a,button')];
   let index=links.indexOf(event.target);
   index=event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length;
   links[index]?.focus();
  }
 };
 const onResize=()=>{
  const focused=document.activeElement;
  closeDisclosures();closeMobile();
  if(media.matches&&primary.contains(focused))mobileToggle.focus();
  else if(focused===mobileToggle)primary.querySelector('a,button')?.focus();
  else if(focused?.closest('.cmcDisclosurePanel'))nav.querySelector('#cmcAccountToggle')?.focus();
 };
 document.addEventListener('click',onClick);
 document.addEventListener('focusin',onFocus);
 document.addEventListener('keydown',onKey);
 media.addEventListener('change',onResize);
 navigationCleanup=()=>{
  document.removeEventListener('click',onClick);document.removeEventListener('focusin',onFocus);
  document.removeEventListener('keydown',onKey);media.removeEventListener('change',onResize);
 };
 setupLogout();setupAutoHideHeader();
}

window.dcAuth={fillStateSelect,regionForState,getSupabaseClient,getCurrentSession,requireUser,signOut,getProfile,upsertProfile,setupLogout,setupAutoHideHeader,renderRoleNavigation,roleNavigationItems,STATES,REGION_BY_STATE};
})();
