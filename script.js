const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const SCALE=['Not Yet Evident','Emerging','Evident','Strongly Evident','Exceptionally Evident'];
const KNOCKOUT_QUALITIES=new Set(['Spousal Cooperation','Effectively Builds Relationships','Visionizing Capacity','Relates to the Lost and Unchurched','Creates Ministry Ownership','Intrinsically Motivated']);
function qualityNameHtml(name){return KNOCKOUT_QUALITIES.has(name)?`<strong class="knockoutQuality">${name}<span class="knockoutStar">*</span></strong>`:name;}
function knockoutBadge(name){return KNOCKOUT_QUALITIES.has(name)?'<span class="knockoutBadge">Knock-Out Factor</span>':''}
function scoreToneClass(score){if(score===null||score===undefined)return 'scoreNA';const n=Number(score);if(n<3)return 'scoreBelow';if(n===3)return 'scoreEvident';if(n<4.5)return 'scoreAbove';return 'scoreHigh'}
function rgbaFromRgb(rgb,alpha){const m=String(rgb).match(/\d+/g);return m&&m.length>=3?`rgba(${m[0]},${m[1]},${m[2]},${alpha})`:rgb}
function scoreBadgeStyle(score){if(score===null||score===undefined)return ''; const c=chartColor(score); return `background:${rgbaFromRgb(c,.13)};border-color:${rgbaFromRgb(c,.38)};color:${c};box-shadow:inset 0 0 0 1px rgba(255,255,255,.72);`}

const QUALITY_DEFINITIONS={
 "Resilience":"Resilience reflects the candidate’s capacity to keep moving faithfully when ministry becomes difficult. It includes emotional steadiness under pressure, the ability to recover after disappointment or criticism, and the maturity to learn from setbacks without becoming defeated, reactive, or withdrawn.",
 "Spousal Cooperation":"For married candidates, Spousal Cooperation reflects the health of shared calling and family alignment. It looks at whether ministry expectations are openly discussed, whether roles and boundaries are clear, and whether the couple can protect family life while serving together through the demands of ministry.",
 "Financial Responsibility":"Financial Responsibility reflects the candidate’s stewardship, discipline, and credibility with resources. It includes managing personal finances wisely, avoiding unnecessary financial pressure, living within realistic limits, and demonstrating the trustworthiness needed to handle church or ministry funds with integrity.",
 "Builds Group Cohesiveness":"Builds Group Cohesiveness reflects the ability to gather people into a unified ministry community. It includes helping newcomers belong, keeping a group focused on mission, building morale, encouraging collaboration, and addressing conflict in ways that preserve trust and move people forward together.",
 "Effectively Builds Relationships":"Effectively Builds Relationships reflects the candidate’s ability to form genuine, trust-building connections with people. It includes taking initiative relationally, listening well, responding to needs with compassion, helping others feel safe and valued, and relating wisely across different personalities and backgrounds.",
 "Flexible and Adaptable":"Flexible and Adaptable reflects the candidate’s ability to adjust without losing mission clarity. It includes handling ambiguity, changing methods when circumstances require it, responding creatively to challenges, and adapting leadership priorities through different seasons of ministry growth and pressure.",
 "Exercises Faith":"Exercises Faith reflects a pattern of leadership rooted in dependence on God rather than anxiety, control, or self-reliance. It includes conviction about calling, prayerful decision-making, expectancy that God is at work, willingness to obey before outcomes are guaranteed, and patience to wait on God’s timing.",
 "Cultural Agility":"Cultural Agility reflects the candidate’s ability to understand and serve people whose background, assumptions, or lived experience differ from their own. It includes humility, curiosity, cultural awareness, and the ability to adapt communication and ministry approaches to the actual people being reached.",
 "Visionizing Capacity":"Visionizing Capacity reflects the ability to see and communicate a compelling ministry future. It includes forming a clear picture of what God may be building, translating vision into practical next steps, helping others see beyond present limitations, and treating challenges as opportunities rather than dead ends.",
 "Utilizes Giftedness of Others":"Utilizes Giftedness of Others reflects the candidate’s ability to recognize, develop, and release the gifts of people around them. It includes matching people to meaningful opportunities, delegating wisely, equipping before assigning responsibility, and building ministry that does not depend entirely on one leader.",
 "Relates to the Lost and Unchurched":"Relates to the Lost and Unchurched reflects the candidate’s ability to build authentic connection with people outside the church. It includes communicating faith naturally, understanding questions and barriers unchurched people carry, creating welcoming pathways, and moving toward spiritually curious or disconnected people with confidence and care.",
 "Responsive to Community":"Responsive to Community reflects the candidate’s attentiveness to the real life, needs, culture, and pulse of the surrounding community. It includes listening before acting, identifying practical ways to serve, adapting ministry to the local context, and blessing the neighborhood rather than only serving insiders.",
 "Creates Ministry Ownership":"Creates Ministry Ownership reflects the ability to move people from attendance into shared responsibility. It includes helping people buy into the vision, giving away meaningful responsibility, equipping teams, building shared identity, and creating systems where ministry continues without everything depending on the primary leader.",
 "Committed to Kingdom Growth":"Committed to Kingdom Growth reflects a deep commitment to discipleship, mission, outreach, and multiplication. It includes resisting maintenance-only ministry, valuing growth as spiritual and relational transformation, celebrating Kingdom fruit beyond one organization, and seeking more and better disciples for the sake of God’s mission.",
 "Intrinsically Motivated":"Intrinsically Motivated reflects the candidate’s inner drive, initiative, and perseverance. It includes working from a sense of call rather than recognition, following through without constant external pressure, anticipating needed work, persisting through slow seasons, and being willing to build from little or nothing.",
};
const sections=[
['Resilience',['I recover well after setbacks or disappointments.','I remain steady under pressure.','I can continue leading when progress is slow.','I respond constructively to criticism.','I stay faithful to commitments during difficult seasons.']],
['Spousal Cooperation',['My spouse supports my sense of calling and ministry direction.','My spouse and I communicate openly about ministry expectations.','My spouse understands the sacrifices involved in ministry leadership.','We make ministry decisions together with unity.','My spouse is willing to participate appropriately in the discernment process.'],true],
['Financial Responsibility',['I manage personal finances with discipline and integrity.','I avoid unnecessary debt and financial impulsiveness.','I can live within a realistic ministry budget.','I handle money transparently and ethically.','My financial habits would not hinder ministry credibility.']],
['Builds Group Cohesiveness',['I help people work together toward a shared purpose.','I address conflict in ways that preserve unity.','I create environments where people feel included.','I encourage collaboration rather than competition.','I help groups regain focus when they become divided or distracted.']],
['Effectively Builds Relationships',['I initiate meaningful relationships with new people.','I listen well and remember what matters to others.','I build trust over time through consistency.','I relate well across personality differences.','I follow up with people in ways that strengthen connection.']],
['Flexible and Adaptable',['I adjust plans when circumstances change.','I can lead effectively in uncertain or ambiguous situations.','I receive new ideas without becoming defensive.','I can change methods without losing sight of mission.','I handle interruptions and unexpected demands with maturity.']],
['Exercises Faith',['I make decisions with prayerful dependence on God.','I trust God when outcomes are not yet visible.','I take obedient steps even when success is not guaranteed.','I encourage others to believe God for growth and transformation.','My leadership is marked by spiritual confidence rather than fear.']],
['Cultural Agility',['I seek to understand people whose backgrounds differ from mine.','I adapt communication to fit different cultural contexts.','I avoid assuming that my preferences are universal.','I can learn from communities that are unlike my own.','I value diversity within the body of Christ.']],
['Visionizing Capacity',['I can describe a compelling picture of a preferred future.','I help others see possibilities beyond current limitations.','I connect present actions to long-term mission.','I communicate vision in ways that inspire participation.','I can translate vision into practical next steps.']],
['Utilizes Giftedness of Others',['I notice the gifts and strengths of people around me.','I invite others to serve in areas that fit their abilities.','I delegate responsibility rather than trying to do everything myself.','I develop emerging leaders intentionally.','I celebrate others contributions publicly and sincerely.']],
['Relates to the Lost and Unchurched',['I build genuine friendships with people who are not connected to church.','I can talk about faith naturally without being pushy.','I understand questions and concerns unchurched people may have.','I prioritize ministry beyond existing church insiders.','I look for ways to create welcoming environments for spiritual seekers.']],
['Responsive to Community',['I pay attention to the real needs of the surrounding community.','I listen to community voices before creating ministry plans.','I can identify practical ways the church can serve locally.','I value partnerships with community organizations where appropriate.','I believe ministry should bless the neighborhood, not just the congregation.']],
['Creates Ministry Ownership',['I help people move from attendance to active participation.','I invite others to take responsibility for ministry outcomes.','I equip teams rather than simply assigning tasks.','I communicate why each persons contribution matters.','I build systems that allow ministry to continue without depending only on me.']],
['Committed to Kingdom Growth',['I care about growth in discipleship, outreach, and multiplication.','I celebrate ministry fruit beyond my own organization or church.','I am willing to make sacrifices for Kingdom impact.','I think strategically about reaching more people for Christ.','I measure success by faithfulness, transformation, and mission advancement.']],
['Intrinsically Motivated',['I take initiative without needing constant external pressure.','I remain motivated by calling rather than recognition.','I follow through on responsibilities even when no one is watching.','I pursue growth because I want to become more faithful and effective.','I sustain effort over time from internal conviction.']]
];
function interpretation(s){if(s===null)return'N/A';if(s<2)return'Not Yet Evident';if(s<3)return'Emerging';if(s<3.8)return'Evident';if(s<4.5)return'Strongly Evident';return'Exceptionally Evident'}
let currentIndex=0;
let currentItems=[];
let answers={};
let autosaveReady=false;
function characterDraftKey(){
 const email=(assessmentForm?.email?.value||'anonymous').trim().toLowerCase();
 return `discernment_character_draft_${email}`;
}
function saveCharacterDraft(){
 if(!autosaveReady || !assessmentForm?.email?.value)return;
 const draft={answers,currentIndex,phone:assessmentForm.phone.value,state:state.value,married:married.value,updatedAt:new Date().toISOString()};
 localStorage.setItem(characterDraftKey(),JSON.stringify(draft));
 showAutoSaveStatus('Progress saved');
}
function loadCharacterDraft(){
 try{
  const raw=localStorage.getItem(characterDraftKey());
  if(!raw)return;
  const draft=JSON.parse(raw);
  if(draft && draft.answers){
   answers=draft.answers||{};
   currentIndex=Number(draft.currentIndex||0);
   if(!assessmentForm.phone.value && draft.phone)assessmentForm.phone.value=draft.phone;
   if(!state.value && draft.state)state.value=draft.state;
   if(!married.value && draft.married)married.value=draft.married;
  }
 }catch(_){}
}
function clearCharacterDraft(){
 try{localStorage.removeItem(characterDraftKey())}catch(_){}
}
function showAutoSaveStatus(text){
 let el=document.getElementById('assessmentAutosaveStatus');
 if(!el){
  el=document.createElement('p');
  el.id='assessmentAutosaveStatus';
  el.className='muted autoSaveStatus';
  assessmentForm.insertBefore(el,questions);
 }
 el.textContent=text;
}

async function init(){
 if(window.dcAuth){
  window.dcAuth.setupLogout();
  const user=await window.dcAuth.requireUser();
  if(!user)return;
  const profile=await window.dcAuth.getProfile(user.id).catch(()=>null);
  window.dcAuth.renderRoleNavigation(profile,'pathway');
  state.innerHTML='<option value="">Select state</option>'+Object.entries(STATES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  if(profile){
   assessmentForm.name.value=profile.full_name||'';
   assessmentForm.email.value=profile.email||user.email||'';
   assessmentForm.phone.value=profile.phone||'';
   state.value=profile.state||'';
   married.value=profile.married||'';
  } else {
   assessmentForm.email.value=user.email||'';
  }
 } else {
  state.innerHTML='<option value="">Select state</option>'+Object.entries(STATES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
 }
 loadCharacterDraft();
 autosaveReady=true;
 renderQuestions();
 showAutoSaveStatus(Object.keys(answers).length ? 'Progress restored and auto-save is on.' : 'Auto-save is on.');
 married.addEventListener('change',()=>{answers={};currentIndex=0;saveCharacterDraft();renderQuestions()});
 assessmentForm.addEventListener('input',saveCharacterDraft);
 assessmentForm.addEventListener('change',saveCharacterDraft);
 assessmentForm.addEventListener('submit',submit)
}

function orderedQuestions(marriedYes){
 const items=[];
 sections.forEach((s,si)=>{if(s[2]&&!marriedYes)return; s[1].forEach((q,qi)=>items.push({si,qi,q,name:`q_${si}_${qi}`}))});
 const interleaved=[];
 for(let qi=0;qi<5;qi++){sections.forEach((s,si)=>{if(s[2]&&!marriedYes)return; interleaved.push(...items.filter(x=>x.si===si&&x.qi===qi))})}
 return interleaved;
}
function candidateReady(){return assessmentForm.name.value.trim()&&assessmentForm.email.value.trim()&&assessmentForm.phone.value.trim()&&state.value&&married.value}
function renderQuestions(){const marriedYes=married.value==='Yes';currentItems=orderedQuestions(marriedYes);document.getElementById('generateReportBtn').classList.add('hidden');const spouseNote=married.value==='No'?`<div class="card note"><h2>Marriage Related Questions</h2><p class="muted">Because you selected that you are not married, the Spousal Cooperation category will appear as N/A in the final report and will not affect the overall score.</p></div>`:'';
 if(!candidateReady()){questions.innerHTML=spouseNote+`<div class="card"><h2>Assessment Questions</h2><p class="muted">Complete the candidate information above to begin the one-question-at-a-time assessment.</p></div>`;return}
 if(currentIndex>=currentItems.length){showCompleteStep();return}
 const item=currentItems[currentIndex];const answered=answers[item.name];const pct=Math.round((currentIndex/currentItems.length)*100);
 const tone=['toneOne','toneTwo','toneThree'][currentIndex%3];questions.innerHTML=spouseNote+`<div class="card assessmentShell ${tone}"><h2>Assessment Questions</h2><p class="muted">Each question appears one at a time. Choose the answer that is most currently evident. If you go back to review a question, you can click the same answer again to continue.</p><div class="progressWrap"><div class="progressMeta"><span>Question ${currentIndex+1} of ${currentItems.length}</span><span>${pct}% complete</span></div><div class="progressTrack"><div class="progressBar" style="width:${pct}%"></div></div></div><div class="questionSlide"><div class="questionText"><span class="qnum">${currentIndex+1}</span><strong>${item.q}</strong></div><div class="scale slideScale">${SCALE.map((lab,i)=>`<label class="${answered==i+1?'selected':''}"><input type="radio" name="${item.name}" value="${i+1}" ${answered==i+1?'checked':''}><span class="scaleNum">${i+1}</span><span>${lab}</span></label>`).join('')}</div></div><div class="slideActions"><button type="button" class="secondaryBtn" onclick="prevQuestion()" ${currentIndex===0?'disabled':''}>Previous Question</button><span class="muted">${answered?'Answered':'Select an answer to continue'}</span></div></div>`;
 let isAdvancing=false;
 document.querySelectorAll('.slideScale label').forEach(label=>label.addEventListener('click',e=>{
  e.preventDefault();
  if(isAdvancing)return;
  isAdvancing=true;
  const input=label.querySelector('input');
  answers[item.name]=Number(input.value);
  saveCharacterDraft();
  document.querySelectorAll('.slideScale label').forEach(l=>l.classList.remove('selected'));
  label.classList.add('selected');
  input.checked=true;
  const shell=document.querySelector('.assessmentShell');
  if(shell){shell.classList.add('answeredFlash')}
  setTimeout(()=>{currentIndex++;renderQuestions()},300)
 }));
}
function prevQuestion(){if(currentIndex>0){currentIndex--;saveCharacterDraft();renderQuestions()}}
function showCompleteStep(){const pct=100;const missing=missingItems();
 if(missing.length){currentIndex=currentItems.findIndex(item=>item.name===missing[0].name);renderQuestions();showMessage('One assessment question still needs an answer. I moved you back to it.','warning');return}
 document.getElementById('generateReportBtn').classList.remove('hidden');questions.innerHTML=`<div class="card assessmentShell"><h2>Assessment Complete</h2><div class="progressWrap"><div class="progressMeta"><span>Assessment questions complete</span><span>${pct}% complete</span></div><div class="progressTrack"><div class="progressBar" style="width:100%"></div></div></div><p class="muted">All required assessment questions have been answered. Click Finish Assessment below to view and save the report, or use Previous Question if you need to review your final answer.</p><div class="slideActions"><button type="button" class="secondaryBtn" onclick="prevQuestion()">Previous Question</button></div></div>`}


function calc(){const marriedYes=married.value==='Yes';let results=[];sections.forEach((s,si)=>{if(s[2]&&!marriedYes){results.push({name:s[0],score:null,label:'N/A'});return}let vals=s[1].map((_,qi)=>Number(answers[`q_${si}_${qi}`]||0));let avg=vals.reduce((a,b)=>a+b,0)/vals.length;results.push({name:s[0],score:+avg.toFixed(2),label:interpretation(avg)})});const scored=results.filter(r=>r.score!==null);const overall=+(scored.reduce((a,b)=>a+b.score,0)/scored.length).toFixed(2);return {results,overall,overallLabel:interpretation(overall),top:[...scored].sort((a,b)=>b.score-a.score).slice(0,3),growth:[...scored].sort((a,b)=>a.score-b.score).slice(0,3)}}
function missingItems(){return currentItems.filter(item=>!answers[item.name])}
function submit(e){
 e.preventDefault();
 if(!candidateReady()){
  showMessage('Please complete the candidate information first.');
  return;
 }
 const missing=missingItems();
 if(missing.length){
  currentIndex=currentItems.findIndex(item=>item.name===missing[0].name);
  renderQuestions();
  showMessage(`One assessment question still needs an answer. I moved you back to it.`, 'warning');
  window.scrollTo({top:questions.offsetTop-12,behavior:'smooth'});
  return;
 }
 const fd=new FormData(assessmentForm);
 const candidate=Object.fromEntries(fd.entries());
 candidate.region=(window.dcAuth&&window.dcAuth.regionForState)?window.dcAuth.regionForState(candidate.state):'';
 const scores=calc();
 clearCharacterDraft();
 const html=reportHtml(candidate,scores);
 window.currentReport={candidate,scores,answers,reflections:{}};
 report.innerHTML=html+`<div class="actions"><button type="button" onclick="downloadReport()">Download Report</button></div><div id="sendStatus" class="sendStatus">Sending and storing report...</div>`;
 report.classList.remove('hidden');
 window.scrollTo({top:report.offsetTop,behavior:'smooth'});
 sendReport();
}
function showMessage(text,type='info'){
 let box=document.getElementById('statusMessage');
 if(!box){box=document.createElement('div');box.id='statusMessage';assessmentForm.insertBefore(box,questions)}
 box.className=`statusMessage ${type}`;
 box.textContent=text;
 box.classList.remove('hidden');
 setTimeout(()=>box.classList.add('hidden'),4200);
}
function characterQualityIntro(){return `<section class="reportSection introPanel"><h3>Understanding the Character Qualities</h3><p>The fifteen character qualities are not meant to function like a pass or fail test. They give CMC leaders a shared language for discussing a participant's readiness, strengths, and growth areas. A score of <strong>3.0</strong> is the baseline, meaning the quality is evident at a normal and expected level for this stage of discernment.</p><p class="muted">The visual profile below shows how each score relates to that baseline. Scores to the left of the center line point to growth areas. Scores to the right point to relative areas of strength. Spousal Cooperation appears as N/A for participants who are not married and is not included in the overall score.</p></section>`}
function chartColor(score){if(score===null)return '#94a3b8'; const t=Math.max(0,Math.min(1,(Number(score)-1)/4)); if(Number(score)<3){const k=Math.max(0,Math.min(1,(Number(score)-1)/2)); const r=Math.round(79+(37-79)*k); const g=Math.round(120+(99-120)*k); const b=Math.round(190+(235-190)*k); return `rgb(${r},${g},${b})`} const k=Math.max(0,Math.min(1,(Number(score)-3)/2)); const r=Math.round(42+(22-42)*k); const g=Math.round(157+(163-157)*k); const b=Math.round(143+(74-143)*k); return `rgb(${r},${g},${b})`}
function visualScoreChart(results){return `<section class="reportSection"><h3>Character Quality Score Profile</h3><p class="muted">The center line is the baseline score of 3.0. Each dot shows where that quality landed in relation to the baseline.</p><div class="profileLegend"><span>Lower</span><span>Baseline: 3.0</span><span>Higher</span></div><div class="profileChart">${results.map(r=>{const hasScore=!(r.score===null||r.score===undefined); const point=hasScore?((Number(r.score)-1)/4)*100:50; const width=hasScore?Math.abs(point-50):0; const left=hasScore?Math.min(point,50):50; const color=chartColor(r.score); return `<div class="profileRow"><div class="profileName">${qualityNameHtml(r.name)}</div><div class="profileTrack"><span class="baselineMarker"></span>${hasScore?`<span class="deviationBar" style="left:${left}%;width:${width}%;background:${color};"></span><span class="scoreDot" style="left:${point}%;background:${color};"></span>`:`<span class="naDot">N/A</span>`}</div><div class="profileValue"><strong>${r.score??'N/A'}</strong><span>${r.label}</span></div></div>`}).join('')}</div></section>`}
function characterQualityDefinitions(results){const scoreMap=Object.fromEntries((results||[]).map(r=>[r.name,r])); return `<section class="reportSection"><h3>Character Quality Descriptions</h3><p class="muted">Use these descriptions as a quick guide for interpreting what each category is looking for. <strong>Knock-out Factor</strong> categories are marked with an asterisk and a small badge.</p><div class="qualityGrid">${sections.map(s=>{const name=s[0]; const r=scoreMap[name]||{}; return `<article class="qualityCard ${KNOCKOUT_QUALITIES.has(name)?'knockoutCard':''}"><div class="qualityCardTop"><div><h4>${qualityNameHtml(name)}</h4>${knockoutBadge(name)}</div><span class="qualityScore ${scoreToneClass(r.score)}" style="${scoreBadgeStyle(r.score)}">${r.score??'N/A'} <em>${r.label||''}</em></span></div><p>${QUALITY_DEFINITIONS[name]||''}</p></article>`}).join('')}</div></section>`}
function categoryTable(results){return `<table><tr><th>Character Quality</th><th>Score</th><th>Interpretation</th></tr>${results.map(r=>`<tr><td>${r.name}</td><td>${r.score??'N/A'}</td><td>${r.label}</td></tr>`).join('')}</table>`}
function reportHtml(c,s){return `<h2>CMC Pathway Character Qualities Report</h2><div class="reportMeta"><p><strong>Participant:</strong> ${c.name}<br><strong>Email:</strong> ${c.email}<br><strong>Phone:</strong> ${c.phone}<br><strong>State:</strong> ${STATES[c.state]}<br><strong>Married:</strong> ${c.married}<br><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><div class="overallCard"><span>Overall Readiness</span><strong>${s.overall}</strong><em>${s.overallLabel}</em></div></div>${characterQualityIntro()}${visualScoreChart(s.results)}${characterQualityDefinitions(s.results)}`}


function safeFileName(value){
 return String(value||'discernment-report').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'discernment-report';
}
async function downloadReport(){
 const payload=window.currentReport;
 if(!payload){return}
 const candidate=payload.candidate||{};
 const fileName=`${safeFileName(candidate.name)}-discernment-report.pdf`;
 const btn=event && event.target ? event.target : null;
 const originalText=btn ? btn.textContent : '';
 if(btn){btn.disabled=true;btn.textContent='Preparing PDF...'}
 try{
  const res=await fetch('/.netlify/functions/report-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!res.ok){
    const data=await res.json().catch(()=>({}));
    throw new Error(data.error||'Could not generate the PDF.');
  }
  const blob=await res.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
 }catch(error){
  showMessage(error.message||'Could not download the report PDF.','warning');
 }finally{
  if(btn){btn.disabled=false;btn.textContent=originalText||'Download Report'}
 }
}

async function sendReport(){
 const status=document.getElementById('sendStatus');
 if(status){status.className='sendStatus pending';status.textContent='Sending and storing report...'}
 try{
  let token='';
  if(window.dcAuth){
    const session=await window.dcAuth.getCurrentSession().catch(()=>null);
    token=session?.access_token||'';
  }
  const headers={'Content-Type':'application/json'};
  if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch('/.netlify/functions/submit-assessment',{method:'POST',headers,body:JSON.stringify(window.currentReport)});
  const data=await res.json().catch(()=>({}));
  if(res.ok&&data.ok){
   if(status){status.className='sendStatus success';status.textContent='Report emailed and stored successfully.'}
  }else{
   if(status){status.className='sendStatus error';status.textContent=data.error||'Report could not be emailed or stored. Check Netlify environment variables.'}
  }
 }catch(err){
  if(status){status.className='sendStatus error';status.textContent='Report could not be emailed or stored. Check your Netlify function setup.'}
 }
}
init();
