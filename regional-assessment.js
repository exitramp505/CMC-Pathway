(async function(){
  const $=id=>document.getElementById(id);
  const session=await dcAuth.getCurrentSession().catch(()=>null);
  if(!session?.user){location.replace('login.html');return;}
  const token=session.access_token;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yearNow=new Date().getFullYear();
  const app={config:null,viewer:null,year:yearNow,record:null,answers:{},scores:{},reflections:{},history:[],step:0,dirty:false,saving:null,timer:null,locked:false,version:0};
  function status(message,error=false){
    $('healthMessage').textContent=message||'';
    $('healthMessage').classList.toggle('error',error);
    $('healthMessage').classList.toggle('hidden',!message);
  }
  function feedback(s,error=false){
    $('editorFeedback').textContent=s||'';
    $('editorFeedback').classList.toggle('error',error);
  }
  async function api(method='GET',payload=null,query=''){
    const response=await fetch('/.netlify/functions/regional-assessments'+query,{
      method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||'Could not save your assessment.');
    return data;
  }
  function scoreCount(){return app.config.sections.filter(s=>Number.isInteger(app.scores[s.id])).length;}
  function total(){return app.config.sections.reduce((n,s)=>n+(Number.isInteger(app.scores[s.id])?app.scores[s.id]:0),0);}
  function answerCount(){return Object.values(app.answers).filter(Boolean).length+Object.values(app.reflections).filter(Boolean).length;}
  function percent(n,d){return Math.round(n/d*100);}
  function renderTop(){
    const count=scoreCount();
    $('assessmentProgressText').textContent=count+' of 8 systems scored · '+answerCount()+' of 48 written responses';
    $('assessmentProgressFill').style.width=percent(count,8)+'%';
    $('assessmentProgressBar').setAttribute('aria-valuenow',String(count));
    $('assessmentTotal').textContent=String(total());
    $('assessmentStatus').textContent=app.locked?'Submitted':app.record?.id?'Draft saved':'Not submitted';
    $('assessmentStatus').classList.toggle('submitted',app.locked);
    $('saveStatus').textContent=app.locked?'Final submission':app.saving?'Saving…':app.dirty?'Unsaved changes':app.record?'Saved':'Not saved yet';
  }
  function isStepReady(index){
    if(index<8)return Number.isInteger(app.scores[app.config.sections[index].id]);
    return Boolean(app.reflections.r7);
  }
  function renderNav(){
    $('stepNav').innerHTML=app.config.sections.map((s,i)=>'<button type="button" data-step="'+i+'" class="'+(i===app.step?'active':'')+'"><span class="cmcHealthStepNumber">'+(isStepReady(i)?'✓':i+1)+'</span><span>'+esc(s.name)+'</span></button>').join('')+
    '<button type="button" data-step="8" class="'+(app.step===8?'active':'')+'"><span class="cmcHealthStepNumber">'+(isStepReady(8)?'✓':'9')+'</span><span>Reflection &amp; submission</span></button>';
    $('stepNav').querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>switchStep(Number(b.dataset.step))));
  }
  function renderHistory(){
    const history=app.history.filter(r=>r.reporting_year!==app.year);
    $('assessmentHistory').innerHTML=history.length?history.map(r=>
      '<button type="button" data-history-year="'+r.reporting_year+'"><span>'+r.reporting_year+'</span><small>'+esc(r.status==='submitted'?'Submitted':'Draft')+'</small></button>'
    ).join(''):'<p>No earlier assessments yet.</p>';
    $('assessmentHistory').querySelectorAll('[data-history-year]').forEach(b=>b.addEventListener('click',()=>setYear(Number(b.dataset.historyYear))));
  }
  function questionField(question,index){
    return '<label class="cmcHealthQuestion"><span class="cmcHealthQuestionIndex">'+(index+1)+'</span><span class="cmcHealthQuestionContent"><strong>'+esc(question.label)+'</strong>'+
      '<textarea data-question="'+esc(question.id)+'" rows="3" maxlength="3000" placeholder="Your answer or reflection…" '+(app.locked?'disabled':'')+'>'+esc(app.answers[question.id]||'')+'</textarea></span></label>';
  }
  function reflectionField(question,index){
    return '<label class="cmcHealthQuestion"><span class="cmcHealthQuestionIndex">'+(index+1)+'</span><span class="cmcHealthQuestionContent"><strong>'+esc(question.label)+
      (question.id==='r7'?' <em class="cmcHealthRequired">Required for submission</em>':'')+'</strong><textarea data-reflection="'+esc(question.id)+
      '" rows="'+(question.id==='r7'?5:3)+'" maxlength="7000" placeholder="Write your response…" '+(app.locked?'disabled':'')+'>'+esc(app.reflections[question.id]||'')+'</textarea></span></label>';
  }
  function renderSection(){
    const isReview=app.step===8;
    const section=!isReview?app.config.sections[app.step]:null;
    $('sectionCount').textContent='SECTION '+(app.step+1)+' OF 9';
    $('sectionTitle').textContent=isReview?'Reflect & prepare for what’s next':section.name;
    $('sectionSubtitle').textContent=isReview?'Review what you learned, identify priorities, and submit when you are ready.':section.subtitle;
    if(isReview){
      const scores=app.config.sections.map(s=>'<div><span>'+esc(s.name)+'</span><strong>'+ (Number.isInteger(app.scores[s.id])?app.scores[s.id]+' / 25':'Not scored')+'</strong></div>').join('');
      $('sectionBody').innerHTML='<section class="cmcHealthScoreGrid"><h3>Systems snapshot</h3><div>'+scores+'</div><p><strong>Total: '+total()+' / 200</strong>. These are your self-assigned system scores, not automatically graded answers.</p></section>'+
       '<div class="cmcHealthQuestionList">'+app.config.reflections.map(reflectionField).join('')+'</div>'+
       '<p class="cmcHealthSubmissionNote">You can save a partial draft at any time. To submit, score all eight systems and complete the five next steps question.</p>';
    }else{
      $('sectionBody').innerHTML='<details class="cmcHealthContext"><summary>Why this system matters</summary><p>'+esc(section.context)+'</p></details>'+
       '<div class="cmcHealthQuestionList">'+section.questions.map(questionField).join('')+'</div>'+
       '<div class="cmcHealthScoreInput"><div><label for="sectionScore">Your score for '+esc(section.name)+'</label><p>Based on your responses, rate the strength of this system in your region. Use a whole number from 0 to 25.</p></div>'+
       '<div class="cmcHealthScoreControl"><input id="sectionScore" data-score="'+section.id+'" type="number" min="0" max="25" step="1" inputmode="numeric" aria-label="'+esc(section.name)+' score" value="'+(Number.isInteger(app.scores[section.id])?app.scores[section.id]:'')+'" '+(app.locked?'disabled':'')+'><span>/25</span></div></div>';
    }
    const fields=$('sectionBody');
    fields.querySelectorAll('[data-question],[data-reflection],[data-score]').forEach(input=>{
      input.addEventListener('input',()=>{
        if(app.locked)return;
        if(input.dataset.question)app.answers[input.dataset.question]=input.value;
        else if(input.dataset.reflection)app.reflections[input.dataset.reflection]=input.value;
        else if(input.dataset.score){
          if(input.value.trim()==='')delete app.scores[input.dataset.score];
          else if(Number.isInteger(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=25)app.scores[input.dataset.score]=Number(input.value);
          else delete app.scores[input.dataset.score];
        }
        changed();
      });
    });
    $('previousSection').disabled=app.step===0;
    $('nextSection').textContent=app.step===8?(app.locked?'Submitted':'Review & submit'):'Next section →';
    $('nextSection').disabled=app.locked&&app.step===8;
    $('saveDraft').classList.toggle('hidden',app.locked);
    feedback('');
    renderTop();renderNav();
  }
  function changed(){
    app.dirty=true;app.version++;
    renderTop();renderNav();
    if(app.timer)clearTimeout(app.timer);
    app.timer=setTimeout(()=>saveDraft(false),1300);
  }
  function snapshot(action){
    return {action,year:app.year,answers:{...app.answers},scores:{...app.scores},reflections:{...app.reflections}};
  }
  async function saveDraft(manual=true){
    if(app.locked)return true;
    if(app.timer)clearTimeout(app.timer);app.timer=null;
    if(app.saving){await app.saving; if(!app.dirty)return true;}
    if(!app.dirty && !manual)return true;
    const version=app.version;
    app.saving=api('POST',snapshot('save'));
    renderTop();
    try{
      const response=await app.saving;
      app.record=response.record;
      if(version===app.version)app.dirty=false;
      if(!app.history.some(r=>r.reporting_year===app.year))app.history.push({reporting_year:app.year,status:'draft'});
      if(manual)feedback('Draft saved. You can continue another time.');
      return true;
    }catch(err){feedback('Draft not saved: '+err.message,true);return false;}
    finally{
      app.saving=null;renderTop();
      if(app.dirty&&!app.timer)app.timer=setTimeout(()=>saveDraft(false),1300);
    }
  }
  async function switchStep(n){
    if(!Number.isInteger(n)||n<0||n>8)return;
    if(app.dirty&&!app.locked)await saveDraft(false);
    app.step=n;renderSection();
    $('sectionTitle').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function setYear(year){
    if(year===app.year)return;
    if(app.dirty&&!app.locked){const saved=await saveDraft(false);if(!saved){$('reportYear').value=String(app.year);return;}}
    app.year=year;app.step=0;await loadYear();
  }
  async function loadYear(){
    status('Loading '+app.year+' assessment…');
    $('assessmentApp').classList.add('hidden');
    try{
      const data=await api('GET',null,'?mode=mine&year='+app.year);
      app.viewer=data.viewer;
      app.record=data.record;
      app.history=data.history||[];
      app.answers={...(data.record?.answers||{})};
      app.scores={...(data.record?.scores||{})};
      app.reflections={...(data.record?.reflections||{})};
      app.locked=data.record?.status==='submitted';app.dirty=false;
      $('reportYear').value=String(app.year);
      $('regionName').textContent='Open Bible '+app.viewer.region+' Region';
      dcAuth.renderRoleNavigation(app.viewer,'health');
      renderHistory();renderSection();renderTop();
      status('');$('assessmentApp').classList.remove('hidden');
    }catch(err){status(err.message,true);}
  }
  async function beginSubmit(){
    if(app.locked)return;
    if(scoreCount()!==8){feedback('Score each of the eight systems before submitting. You can still save this as a draft.',true);return;}
    if(!String(app.reflections.r7||'').trim()){feedback('Complete the five next steps reflection before submitting.',true);return;}
    const saved=await saveDraft(false);if(!saved)return;
    $('submitSummary').textContent='Reporting year '+app.year+' · Total score '+total()+' / 200 · '+answerCount()+' written responses.';
    $('submitDialog').showModal();
  }
  async function submit(){
    $('confirmSubmit').disabled=true;
    try{
      const data=await api('POST',snapshot('submit'));
      app.record=data.record;app.locked=true;app.dirty=false;
      $('submitDialog').close();
      app.history=app.history.map(r=>r.reporting_year===app.year?{...r,status:'submitted'}:r);
      renderHistory();renderSection();
      status('Your '+app.year+' assessment was submitted and is available to national CMC leadership.');
    }catch(err){$('submitSummary').textContent=err.message;}
    finally{$('confirmSubmit').disabled=false;}
  }
  $('previousSection').addEventListener('click',()=>switchStep(app.step-1));
  $('nextSection').addEventListener('click',()=>app.step===8?beginSubmit():switchStep(app.step+1));
  $('saveDraft').addEventListener('click',()=>saveDraft(true));
  $('reportYear').addEventListener('change',()=>setYear(Number($('reportYear').value)));
  $('cancelSubmit').addEventListener('click',()=>$('submitDialog').close());
  $('confirmSubmit').addEventListener('click',submit);
  try{
    const cfg=await fetch('/regional-assessment-config.json').then(r=>{if(!r.ok)throw Error('Assessment content is not available.');return r.json()});
    if(cfg.sections?.length!==8||cfg.reflections?.length!==8)throw Error('The assessment configuration is incomplete.');
    app.config=cfg;
    $('reportYear').innerHTML=Array.from({length:Math.min(5,yearNow-2021)},(_,i)=>yearNow-i)
      .map(y=>'<option value="'+y+'">'+y+'</option>').join('');
    await loadYear();
  }catch(err){status(err.message,true);}
})();