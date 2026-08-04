(function(){
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico'};
const REGION_BY_STATE={WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',FL:'Southeast',GA:'Southeast',AL:'Southeast',MS:'Southeast',LA:'Southeast',SC:'Southeast',NC:'Southeast',PR:'Southeast'};
function fillStateSelect(select){if(!select)return;select.innerHTML='<option value="">Select state</option>'+Object.entries(STATES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
function regionForState(state){return REGION_BY_STATE[state]||'Unassigned'}
let supabaseClientPromise;
async function getSupabaseClient(){
 if(supabaseClientPromise)return supabaseClientPromise;
 supabaseClientPromise=(async()=>{
  const res=await fetch('/.netlify/functions/supabase-config');
  const cfg=await res.json().catch(()=>({}));
  if(!res.ok||!cfg.url||!cfg.anonKey) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Netlify.');
  return window.supabase.createClient(cfg.url,cfg.anonKey);
 })();
 return supabaseClientPromise;
}
async function getCurrentSession(){const sb=await getSupabaseClient();const {data}=await sb.auth.getSession();return data.session||null}
async function requireUser(){const session=await getCurrentSession(); if(!session){window.location.href='login.html';return null} return session.user}
async function signOut(){const sb=await getSupabaseClient(); await sb.auth.signOut(); window.location.href='login.html'}
async function getProfile(userId){const sb=await getSupabaseClient(); const {data,error}=await sb.from('candidate_profiles').select('*').eq('id',userId).maybeSingle(); if(error) throw error; return data}
async function upsertProfile(profile){const sb=await getSupabaseClient(); const {error}=await sb.from('candidate_profiles').upsert(profile,{onConflict:'id'}); if(error) throw error}
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
 let ticking=false;
 const reveal=()=>{
  header.classList.remove('cmcHeaderHidden');
  downwardDistance=0;
  upwardDistance=0;
 };
 const update=()=>{
  const y=Math.max(window.scrollY,0);
  const delta=y-lastY;
  const navigationFocused=header.contains(document.activeElement);
  header.classList.toggle('cmcHeaderScrolled',y>12);
  if(y<100||navigationFocused){
   reveal();
  }else if(delta<0){
   downwardDistance=0;
   upwardDistance+=Math.abs(delta);
   if(upwardDistance>70)reveal();
  }else if(delta>0&&y>150){
   upwardDistance=0;
   downwardDistance+=delta;
   if(downwardDistance>44)header.classList.add('cmcHeaderHidden');
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
function renderRoleNavigation(profile,activeKey){
 const nav=document.getElementById('cmcRoleNav');
 if(!nav)return;
 const role=profile?.account_role||'participant';
 const items=[
  {key:'pathway',label:'My Pathway',href:role==='participant'?'dashboard.html':'dashboard.html?view=participant',show:true},
 {key:'people',label:'People',href:'leader.html',show:['regional_leader','cmc_admin'].includes(role)},
 {key:'events',label:'Events',href:'events.html',show:['regional_leader','cmc_admin'].includes(role)},
 {key:'courses',label:'Courses',href:'courses.html',show:role==='cmc_admin'},
  {key:'leaders',label:'Leaders',href:'manage-leaders.html',show:['regional_leader','cmc_admin'].includes(role)},
  {key:'profile',label:'Profile',href:'profile.html',show:true}
 ];
 const visibleItems=items.filter(item=>item.show);
 const managementKeys=['people','events','courses','leaders'];
 const hasManagementTools=visibleItems.some(item=>managementKeys.includes(item.key));
 const menuItems=visibleItems.map(item=>{
  const dividerBefore=(item.key==='people'&&hasManagementTools)||item.key==='profile';
  return `${dividerBefore?'<span class="cmcNavDivider" aria-hidden="true"></span>':''}<a${item.key===activeKey?' class="active"':''} href="${item.href}">${item.label}</a>`;
 }).join('')+'<button id="logoutBtn" type="button">Logout</button>';
 nav.innerHTML=`<button class="cmcMobileNavToggle" type="button" aria-expanded="false" aria-controls="cmcNavMenu">
   <span class="cmcMobileNavIcon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>
 </button><div id="cmcNavMenu" class="cmcNavMenu">${menuItems}</div>`;
 const toggle=nav.querySelector('.cmcMobileNavToggle');
 const menu=nav.querySelector('.cmcNavMenu');
 const closeMenu=()=>{
  nav.classList.remove('cmcNavOpen');
  toggle?.setAttribute('aria-expanded','false');
 };
 toggle?.addEventListener('click',event=>{
  event.stopPropagation();
  const open=!nav.classList.contains('cmcNavOpen');
  nav.classList.toggle('cmcNavOpen',open);
  toggle.setAttribute('aria-expanded',String(open));
 });
 menu?.addEventListener('click',event=>{
  if(event.target.closest('a,#logoutBtn'))closeMenu();
 });
 document.addEventListener('click',event=>{
  if(nav.classList.contains('cmcNavOpen')&&!nav.contains(event.target))closeMenu();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeMenu();
 });
 setupLogout();
 setupAutoHideHeader();
}
window.dcAuth={fillStateSelect,regionForState,getSupabaseClient,getCurrentSession,requireUser,signOut,getProfile,upsertProfile,setupLogout,setupAutoHideHeader,renderRoleNavigation,STATES,REGION_BY_STATE};
})();
