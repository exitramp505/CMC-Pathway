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
window.dcAuth={fillStateSelect,regionForState,getSupabaseClient,getCurrentSession,requireUser,signOut,getProfile,upsertProfile,setupLogout,STATES,REGION_BY_STATE};
})();
