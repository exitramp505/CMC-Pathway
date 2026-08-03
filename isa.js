const ISA_CATEGORIES={P:'Church Planting',E:'Entrepreneurial Leadership',M:'Ministry Experience',R:'Relational Evangelism'};
const ISA_BENCHMARKS={P:75,E:75,M:75,R:70};
const ISA_MEDIANS={P:52,E:74,M:59,R:48};
const ISA_DESCRIPTIONS={
 P:'Church Planting reflects exposure to pioneering new ministry, starting groups, raising resources, recruiting leaders, and building work that can continue beyond the original leader.',
 E:'Entrepreneurial Leadership reflects initiative, drive, risk tolerance, resilience, vision, ownership, and the ability to gather people around something that does not yet exist.',
 M:'Ministry Experience reflects hands-on leadership in groups, events, teaching, training, supervising, evangelistic ministry, and growing ministry environments.',
 R:'Relational Evangelism reflects personal evangelism, discipling new believers, follow-up, time with unchurched people, and equipping others to engage people outside the church.'
};
const YESNO=['Yes','No'];
const COUNT=['None','1-2','3-6','7-15','16+'];
const AGREE=['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'];
const ISA_QUESTIONS=[
[1,'I have been a part of the core founding team of a newly planted church.','P','yesno'],[2,'I have read books specifically about church planting.','P','yesno'],[3,'I have been to a church-planting training event.','P','yesno'],[4,'I have written a strategy plan for a new church plant.','P','yesno'],[5,'I have spoken at a large-group evangelistic event.','M','yesno'],[6,'I have spoken at a large group evangelistic event and people have become Christians as a result.','M','yesno'],[7,'I have designed and led a large-group evangelistic event or service.','M','yesno'],[8,'I have recruited and equipped a team of five or more people to conduct an evangelistic event or service.','M','yesno'],[9,'I have recruited or overseen a worship leader for a group that I was leading.','P','yesno'],[10,'I have grown a ministry to the point of having to add other staff members.','P','yesno'],[11,'I have been a part of recruiting and interviewing someone for a paid position in a church or in a ministry group.','P','yesno'],[12,'I have raised $1,000 to $10,000 for a church project or ministry.','P','yesno'],[13,'I have raised more than $10,000 for a church project or ministry.','P','yesno'],[14,'I have promoted a ministry or event that drew more than 25 first-time people.','P','yesno'],[15,'I have promoted a ministry or event that drew more than 100 first-time people.','P','yesno'],[16,'I have turned over a ministry that I started to someone else.','P','yesno'],[17,'A ministry that I turned over to someone else grew larger than when I was leading it.','P','yesno'],[18,'I have coached someone who has successfully started a ministry.','P','yesno'],[19,'I have led a ministry where I was responsible for supervising others.','P','yesno'],[20,'I have started from scratch a ministry team.','E','yesno'],[21,'I have had to discipline someone in a professional work related situation.','E','yesno'],[22,'I have had to discipline someone in a church group that was being divisive.','E','yesno'],[23,'I have asked someone to step down from a leadership position in a church.','E','yesno'],[24,'I have started from scratch an adult small group or Sunday school class.','M','yesno'],[25,'I have led an adult small group or Sunday school class.','M','yesno'],[26,'I have led an adult small group or Sunday school class that doubled in size.','M','yesno'],[27,'I have led an adult small group or Sunday school class that successfully multiplied into two groups.','M','yesno'],[28,'I have recruited and trained a small group, Sunday school, or ministry leader.','M','yesno'],[29,'I have coached several small group, Sunday school, or ministry leaders.','M','yesno'],[30,'I have started from scratch a youth Sunday School class or youth discipleship group.','M','yesno'],[31,'I have led a youth Sunday School class or youth discipleship group.','M','yesno'],[32,'A group or ministry in which I was the main speaker grew by 10 people in a year.','M','yesno'],[33,'A group or ministry in which I was the main speaker grew by 50 people in a year.','M','yesno'],[34,'A group or ministry in which I was the main speaker grew by 100 or more people in a year.','M','yesno'],[35,'I have been responsible for a ministry department, including curriculum, training, supervision of staff or volunteers, or similar responsibility.','M','yesno'],[36,'I have run a ministry team that I did not originally start.','M','yesno'],[37,'I have started a Bible study or small group from scratch.','P','yesno'],[38,'I have started a Bible study or small group that included unchurched people.','P','yesno'],[39,'I have started a Bible study or small group that included unchurched people and grew to more than 10 people.','P','yesno'],[40,'I have started a Bible study or small group that grew and multiplied or birthed a new group.','P','yesno'],[41,'I started a Bible study or small group that lasted for a year after I left it.','P','yesno'],[42,'I have been part of a team that started a Bible study, small group, or other ministry.','P','yesno'],[43,'I have shared my faith with this many people in the last year.','R','count'],[44,'I have led this many adults over 18 years old to salvation.','R','count'],[45,'I have led this many adults to salvation that I did not first meet through church.','R','count'],[46,'I have led this many adults over 18 years old to salvation in the last year.','R','count'],[47,'I have led this many teens ages 13 to 18 to salvation in the last year.','R','count'],[48,'I have trained this many people in evangelism.','R','count'],[49,'I have planned and done something socially with this many non-Christians who were not family members in the past year.','R','count'],[50,'I have served this many non-Christians who were not family members in the past year.','R','count'],[51,'I have spent this many hours of recreational time with unchurched people this year.','R','count'],[52,'I have made friends with this many unchurched people this year.','R','count'],[53,'I have done follow up with this many new Christians.','R','count'],[54,'I have done follow up with this many new Christians that I led to Christ.','R','count'],[55,'I have equipped this many people to do follow up with new Christians.','R','count'],[56,'I have individually discipled this many people who continue to walk with God today.','R','count'],[57,'I have motivated this many people to move from nominal church involvement to active involvement in a ministry.','P','count'],[58,'I have helped this many people discover and utilize their spiritual gifts.','P','count'],[59,'I have directly instilled the desire to begin tithing in this many people I was leading or discipling.','P','count'],[60,'An organization that I was the founder or primary leader grew by this many people within a year.','P','count'],[61,'I like creating new things that involve finding new ways of solving problems.','E','agree'],[62,'I am a risk taker.','E','agree'],[63,'I like to explore new territory.','E','agree'],[64,'I have the reputation for being a really hard worker.','E','agree'],[65,'The thought of starting and owning my own company excites me.','E','agree'],[66,'While in school, I started and ran an athletic team, special interest group, or student club.','E','agree'],[67,'I have started and ran a business before.','E','agree'],[68,'I tend to be competitive.','E','agree'],[69,'I seem to be really good at envisioning something in my mind before it is actually taking place or built.','E','agree'],[70,'I tend to set goals and stretch myself to meet them even when others are not encouraging me to do so.','E','agree'],[71,'I tend to challenge the status quo while looking for better ways of doing things.','E','agree'],[72,'People say that I do not give up easily.','E','agree'],[73,'When I have a project to do, I tend to recruit a team rather than do it alone.','E','agree'],[74,"I feel that in life you can't rely upon good fortune. You have to make things happen.",'E','agree'],[75,'It is easy for me to pick up my work flow after I have been interrupted.','E','agree'],[76,"It's important to me to make a mark in this life.",'E','agree'],[77,'Making decisions comes easily to me.','E','agree'],[78,'I tend to take charge of situations where there is no leadership and something needs to be done.','E','agree'],[79,'I have led multiple groups to forge consensus and accomplish an outcome.','E','agree'],[80,'I consider it more of a challenge than a chore to deal with or lead cautious, skeptical, or unexcited people.','E','agree'],[81,"I enjoy appraising others' performance and giving them feedback.",'E','agree'],[82,'I take responsibility for my actions.','E','agree'],[83,'I find that I can recruit or gather a group of people together for an event or project quite well.','E','agree'],[84,'I have been told by others that I would be a good church planter.','E','agree'],[85,'I think I would make a very good lead pastor.','E','agree']
].map(([id,text,group,type])=>({id,text,group,type}));

let current=0, answers={};
let isaAutosaveReady=false;
function isaDraftKey(){
 const email=(document.querySelector('[name=email]')?.value||'anonymous').trim().toLowerCase();
 return `discernment_isa_draft_${email}`;
}
function saveIsaDraft(){
 if(!isaAutosaveReady)return;
 const form=document.getElementById('isaForm');
 const draft={answers,current,phone:form.phone.value,state:form.state.value,updatedAt:new Date().toISOString()};
 localStorage.setItem(isaDraftKey(),JSON.stringify(draft));
 showIsaAutosaveStatus('Progress saved');
}
function loadIsaDraft(){
 try{
  const raw=localStorage.getItem(isaDraftKey());
  if(!raw)return;
  const draft=JSON.parse(raw);
  if(draft && draft.answers){
   answers=draft.answers||{};
   current=Number(draft.current||0);
   const form=document.getElementById('isaForm');
   if(!form.phone.value && draft.phone)form.phone.value=draft.phone;
   if(!form.state.value && draft.state)form.state.value=draft.state;
  }
 }catch(_){}
}
function clearIsaDraft(){try{localStorage.removeItem(isaDraftKey())}catch(_){}}
function showIsaAutosaveStatus(text){
 let el=document.getElementById('isaAutosaveStatus');
 if(!el){
  el=document.createElement('p');
  el.id='isaAutosaveStatus';
  el.className='muted autoSaveStatus';
  document.getElementById('isaForm').insertBefore(el,document.getElementById('isaQuestions'));
 }
 el.textContent=text;
}
function optionsFor(type){return type==='yesno'?YESNO:type==='count'?COUNT:AGREE}
function valueFor(q,ans){if(q.type==='yesno')return ans==='Yes'?1:0;if(q.type==='count')return {None:0,'1-2':.25,'3-6':.5,'7-15':.75,'16+':1}[ans]??0;return {'Strongly Disagree':0,Disagree:.25,Neutral:.5,Agree:.75,'Strongly Agree':1}[ans]??0}
function labelFor(p){if(p>=85)return 'Very Strong';if(p>=70)return 'Strong';if(p>=50)return 'Developing';return 'Needs Development'}
function pct(n){return Math.round(n)}
function calculate(){const sums={P:0,E:0,M:0,R:0}, counts={P:0,E:0,M:0,R:0}; let total=0; ISA_QUESTIONS.forEach(q=>{const v=valueFor(q,answers[q.id]); sums[q.group]+=v; counts[q.group]++; total+=v}); const cats={}; Object.keys(sums).forEach(k=>cats[k]=pct((sums[k]/counts[k])*100)); const overall=pct((total/ISA_QUESTIONS.length)*100); return {assessmentType:'isa_readiness',assessmentTitle:'Ministry Readiness Inventory',overall,overallLabel:labelFor(overall),categories:[{key:'P',name:'Church Planting',score:cats.P,benchmark:ISA_BENCHMARKS.P,median:ISA_MEDIANS.P,label:labelFor(cats.P),description:ISA_DESCRIPTIONS.P},{key:'E',name:'Entrepreneurial Leadership',score:cats.E,benchmark:ISA_BENCHMARKS.E,median:ISA_MEDIANS.E,label:labelFor(cats.E),description:ISA_DESCRIPTIONS.E},{key:'M',name:'Ministry Experience',score:cats.M,benchmark:ISA_BENCHMARKS.M,median:ISA_MEDIANS.M,label:labelFor(cats.M),description:ISA_DESCRIPTIONS.M},{key:'R',name:'Relational Evangelism',score:cats.R,benchmark:ISA_BENCHMARKS.R,median:ISA_MEDIANS.R,label:labelFor(cats.R),description:ISA_DESCRIPTIONS.R}]}}
function renderQuestion(){
 const container=document.getElementById('isaQuestions');
 const q=ISA_QUESTIONS[current];
 const progress=Math.round(((current+1)/ISA_QUESTIONS.length)*100);
 const opts=optionsFor(q.type);
 container.innerHTML=`<div class="card assessmentShell isaAssessmentShell">
   <h2>Assessment Questions</h2>
   <div class="progressWrap">
     <div class="progressMeta"><span>Question ${current+1} of ${ISA_QUESTIONS.length}</span><span>${progress}% complete</span></div>
     <div class="progressTrack"><div class="progressBar" style="width:${progress}%"></div></div>
   </div>
   <div class="questionSlide tone${(current%3)+1}">
     <div class="questionText isaQuestionText"><span class="qnum">${current+1}</span><strong>${q.text}</strong></div>
     <div class="isaChoiceList ${q.type}">${opts.map((opt,i)=>`<button type="button" class="isaChoice ${answers[q.id]===opt?'selected':''}" data-answer="${opt}"><span class="scaleNum">${i+1}</span><strong>${opt}</strong></button>`).join('')}</div>
   </div>
   <div class="slideActions"><button type="button" class="secondaryBtn" id="prevQuestion" ${current===0?'disabled':''}>Previous Question</button></div>
 </div>`;
 container.querySelectorAll('.isaChoice').forEach(btn=>btn.addEventListener('click',()=>{
   answers[q.id]=btn.dataset.answer;
   saveIsaDraft();
   btn.classList.add('selected');
   setTimeout(()=>{
     if(current<ISA_QUESTIONS.length-1){current++;renderQuestion()}
     else{document.getElementById('generateIsaBtn').classList.remove('hidden');container.innerHTML='<div class="card assessmentCompleteCard"><h2>Assessment Complete</h2><p class="muted">All required questions have been answered. Click Finish Assessment to view and save the report.</p></div>'}
   },90);
 }));
 document.getElementById('prevQuestion')?.addEventListener('click',()=>{if(current>0){current--;saveIsaDraft();renderQuestion()}})
}
function bar(v,color){return `<div class="isaBar"><span style="width:${v}%;background:${color}"></span><em>${v}%</em></div>`}
function reportHtml(scores){return `<div class="reportHeader"><h2>Ministry Readiness Inventory Report</h2><p>${document.querySelector('[name=name]').value} · ${document.querySelector('[name=state]').value} · ${dcAuth.regionForState(document.querySelector('[name=state]').value)} Region</p><div class="overallCard"><span>Overall Readiness</span><strong>${scores.overall}%</strong><em>${scores.overallLabel}</em></div></div><section class="reportSection"><h3>Readiness Profile</h3><p class="muted">This assessment summarizes practical ministry experience and leadership readiness. Benchmark and median lines are based on the sample ISA report format.</p>${scores.categories.map(c=>`<div class="isaCompareRow"><strong>${c.name}</strong>${bar(c.score,'#2a9d8f')}<small>Benchmark: ${c.benchmark}% · Median: ${c.median}%</small></div>`).join('')}</section><section class="reportSection"><h3>Category Descriptions</h3><div class="qualityGrid">${scores.categories.map(c=>`<article class="qualityCard"><div class="qualityCardTop"><h4>${c.name}</h4><span class="qualityScore scoreAbove">${c.score}% <em>${c.label}</em></span></div><p>${c.description}</p></article>`).join('')}</div></section>`}
async function init(){dcAuth.setupLogout(); const user=await dcAuth.requireUser(); if(!user)return; const profile=await dcAuth.getProfile(user.id).catch(()=>null); dcAuth.renderRoleNavigation(profile,'pathway'); const form=document.getElementById('isaForm'); dcAuth.fillStateSelect(form.state); if(profile){form.name.value=profile.full_name||''; form.email.value=profile.email||user.email||''; form.phone.value=profile.phone||''; form.state.value=profile.state||''} else form.email.value=user.email||''; loadIsaDraft(); isaAutosaveReady=true; showIsaAutosaveStatus(Object.keys(answers).length ? 'Progress restored and auto-save is on.' : 'Auto-save is on.'); renderQuestion(); form.addEventListener('input',saveIsaDraft); form.addEventListener('change',saveIsaDraft); form.addEventListener('submit',async e=>{e.preventDefault(); if(Object.keys(answers).length<ISA_QUESTIONS.length){alert('Please complete all questions.');return} const scores=calculate();
 clearIsaDraft(); const payload={assessmentType:'isa_readiness',candidate:{name:form.name.value,email:form.email.value,phone:form.phone.value,state:form.state.value,region:dcAuth.regionForState(form.state.value)},scores,answers:Object.fromEntries(ISA_QUESTIONS.map(q=>[q.id,{question:q.text,answer:answers[q.id],group:q.group,type:q.type}]))}; const report=document.getElementById('report'); report.classList.remove('hidden'); report.innerHTML=reportHtml(scores)+'<p class="muted">Saving report...</p>'; const session=await dcAuth.getCurrentSession(); const res=await fetch('/.netlify/functions/submit-isa-assessment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(payload)}); const data=await res.json().catch(()=>({})); if(!res.ok||!data.ok){report.innerHTML+=`<p class="warningText">${data.error||'Could not save report.'}</p>`;return} report.innerHTML=reportHtml(scores)+`<div class="actions"><a class="buttonLink" href="report.html?id=${encodeURIComponent(data.submissionId)}">Open Saved Report</a></div>`; window.scrollTo({top:report.offsetTop-10,behavior:'smooth'});});}
init();
