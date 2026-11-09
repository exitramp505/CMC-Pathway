/* Ministry Style Inventory v2 — accessible step-based experience. */
(async function(){
 const $=id=>document.getElementById(id);
 const bank=window.CMCMinistryStyleV2Bank;
 if(!bank||bank.VERSION!==2)return;
 dcAuth.setupLogout();
 const user=await dcAuth.requireUser();if(!user)return;
 const sb=await dcAuth.getSupabaseClient();
 const profile=await dcAuth.getProfile(user.id).catch(()=>null);
 dcAuth.renderRoleNavigation(profile,'pathway');
 const candidate={name:profile?.full_name||user.user_metadata?.full_name||user.email||'Participant',email:profile?.email||user.email||'',phone:profile?.phone||'',state:profile?.state||'',region:profile?.region||dcAuth.regionForState(profile?.state)||''};
 const ITEMS=bank.ITEMS,PER_PAGE=4,PAGES=Math.ceil(ITEMS.length/PER_PAGE),localKey='cmc_msv2_'+user.id;
 let answers={},page=0,pendingSave=null,saveVersion=0,saving=false,submitting=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const status=(msg)=>{$('msv2SaveStatus').textContent=msg;};
 const setError=(msg)=>{const node=$('msv2Error');node.textContent=msg||'';node.hidden=!msg;};
 const getLocal=()=>{try{const x=JSON.parse(localStorage.getItem(localKey)||'{}');return x&&typeof x==='object'?x:{};}catch(_){return {};}};
 async function loadDraft(){
   const local=getLocal();
   let server=null;
   try{const {data,error}=await sb.from('cmc_ministry_style_drafts').select('answers,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;server=data;}
   catch(e){status('Draft saves on this device until connection is restored.');}
   answers={...(server?.answers||{}),...local};
   for(const key of Object.keys(answers)){if(!ITEMS.some(q=>q.id===key)||!Number.isInteger(answers[key])||answers[key]<1||answers[key]>5)delete answers[key];}
   try{localStorage.setItem(localKey,JSON.stringify(answers));}catch(_){}
   if(server)status('Progress saved to your account.');
   else if(!Object.keys(answers).length)status('Your answers save as you go.');
 }
 async function persist(){
   if(saving){return;}
   saving=true;
   const version=saveVersion;
   const snapshot={...answers};
   status('Saving…');
   try{
     const {error}=await sb.from('cmc_ministry_style_drafts').upsert({user_id:user.id,instrument_version:2,answers:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'});
     if(error)throw error;
     status(version===saveVersion?'Progress saved to your account.':'Saving latest changes…');
     if(version===saveVersion){try{localStorage.removeItem(localKey);}catch(_){}}
   }catch(_){status('Saved on this device; account sync unavailable.');}
   finally{saving=false;if(version!==saveVersion)queueSave();}
 }
 function queueSave(){clearTimeout(pendingSave);pendingSave=setTimeout(persist,650);}
 function choice(item,value){answers[item.id]=value;saveVersion++;try{localStorage.setItem(localKey,JSON.stringify(answers));}catch(_){}queueSave();renderProgress();}
 function renderProgress(){
   const completed=ITEMS.filter(q=>Number.isInteger(answers[q.id])).length;
   $('msv2ProgressLabel').textContent='Step '+(page+1)+' of '+PAGES+' · '+completed+' of '+ITEMS.length+' answered';
   $('msv2ProgressTrack').setAttribute('aria-valuenow',String(completed));
   $('msv2ProgressFill').style.width=Math.round(completed/ITEMS.length*100)+'%';
 }
 function pageItems(){return ITEMS.slice(page*PER_PAGE,(page+1)*PER_PAGE);}
 function render(){
   const ease=pageItems()[0].kind==='ease';
   $('msv2Stage').textContent=ease?'Ministry activities':'Leadership tendencies';
   $('msv2SectionTitle').textContent=ease?'How easy or difficult do these activities feel?':'How do you naturally lead?';
   $('msv2Prompt').textContent=ease?'Think about what feels natural to you today, regardless of how skilled you might become.':'Rate how accurately each statement describes your typical behavior.';
   const names=ease?['Very difficult','Difficult','Neither','Easy','Very easy']:['Strongly disagree','Disagree','Neither','Agree','Strongly agree'];
   const short=ease?['Very difficult','Difficult','Neutral','Easy','Very easy']:['Strongly disagree','Disagree','Neutral','Agree','Strongly agree'];
   $('msv2Questions').innerHTML=pageItems().map((q,index)=>'<fieldset class="msv2Question"><legend><span class="msv2Number">'+(page*PER_PAGE+index+1)+'</span> '+escape(q.text)+'</legend><div class="msv2Choices">'+names.map((label,i)=>'<label class="msv2Choice"><input type="radio" name="'+q.id+'" value="'+(i+1)+'" '+(answers[q.id]===i+1?'checked':'')+'><span class="msv2Circle" aria-hidden="true"></span><span>'+escape(short[i])+'</span></label>').join('')+'</div></fieldset>').join('');
   $('msv2Back').disabled=page===0;
   $('msv2Next').textContent=page===PAGES-1?'Finish inventory':'Continue →';
   renderProgress();setError('');
 }
 $('msv2Questions').addEventListener('change',event=>{
   const input=event.target.closest('input[type="radio"]');
   if(!input)return;
   const q=ITEMS.find(q=>q.id===input.name);
   if(q)choice(q,Number(input.value));
 });
 $('msv2Back').addEventListener('click',()=>{if(page>0){page--;render();$('msv2Workflow').scrollIntoView({behavior:'smooth',block:'start'});}});
 function showQuestions(){ $('msv2Welcome').classList.add('hidden');$('msv2Workflow').classList.remove('hidden');render(); }
 $('msv2Start').addEventListener('click',showQuestions);
 $('msv2Form').addEventListener('submit',async(event)=>{
   event.preventDefault();if(submitting)return;
   const first=pageItems().find(q=>!Number.isInteger(answers[q.id]));
   if(first){setError('Choose a response for every statement before continuing.');const input=document.querySelector('[name="'+first.id+'"]');input?.focus();return;}
   if(page<PAGES-1){page++;render();$('msv2Workflow').scrollIntoView({behavior:'smooth',block:'start'});return;}
   if(ITEMS.some(q=>!Number.isInteger(answers[q.id]))){page=Math.floor(ITEMS.findIndex(q=>!Number.isInteger(answers[q.id]))/PER_PAGE);render();setError('Please complete the remaining statements.');return;}
   submitting=true;$('msv2Next').disabled=true;status('Submitting your inventory…');
   try{
     const session=await sb.auth.getSession();const token=session.data?.session?.access_token;
     if(!token)throw Error('Your session expired. Please sign in again.');
     const response=await fetch('/.netlify/functions/submit-ministry-style',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({instrumentVersion:2,candidate,answers})});
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data.ok||!data.scores)throw Error(data.error||'Could not submit your inventory.');
     $('msv2Workflow').classList.add('hidden');$('msv2Results').classList.remove('hidden');
     $('msv2Results').innerHTML=window.MinistryStyleV2Report.buildReportHtml({candidate,scores:data.scores,answers},{audience:'candidate'});
     status('Inventory submitted.');
     try{await sb.from('cmc_ministry_style_drafts').delete().eq('user_id',user.id);localStorage.removeItem(localKey);}catch(_){}
     $('msv2Results').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(error){setError(error.message||'Could not submit your inventory. Your responses are saved.');status('Submission unsuccessful. Your answers are retained.');}
   finally{submitting=false;$('msv2Next').disabled=false;}
 });
 await loadDraft();
 if(Object.keys(answers).length){let firstIncomplete=ITEMS.findIndex(q=>!Number.isInteger(answers[q.id]));page=firstIncomplete===-1?PAGES-1:Math.floor(firstIncomplete/PER_PAGE);$('msv2Start').textContent='Resume inventory →';}
})();
