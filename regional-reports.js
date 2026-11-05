(async function(){
 const $=id=>document.getElementById(id);
 const session=await dcAuth.getCurrentSession().catch(()=>null);
 if(!session?.user){location.replace('login.html');return;}
 const token=session.access_token;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const REGIONS=['Central','East','Mountain Plains','Pacific','Southeast'];
 let config,data,year=new Date().getFullYear()<=2026?new Date().getFullYear():new Date().getFullYear()-1;
 const score=s=>typeof s==='number'&&Number.isFinite(s)&&s>=0&&s<=25?s:null;
 const sum=entry=>config.sections.reduce((n,s)=>n+(score(entry.scores?.[s.id])||0),0);
 const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 const fmt=value=>value===null?'—':value.toFixed(1).replace(/\.0$/,'');
 const percent=(n,d)=>d?Math.round(n/d*100):null;
 const date=iso=>iso?new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(iso)):'';
 const current=()=>data?.entries?.filter(x=>x.reporting_year===year)||[];
 const previous=()=>data?.entries?.filter(x=>x.reporting_year===year-1)||[];
 async function api(query){
   const response=await fetch('/.netlify/functions/regional-assessments'+query,{headers:{Authorization:'Bearer '+token}});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.ok)throw new Error(result.error||'Could not load assessment reports.');
   return result;
 }
 function status(s,error=false){
   $('reportMessage').textContent=s||'';$('reportMessage').classList.toggle('error',error);
   $('reportMessage').classList.toggle('hidden',!s);
 }
 function renderSummary(){
   const rows=current(),roster=data.roster||[];
   const completed=new Set(rows.map(x=>x.director_id));
   const matched=rows.filter(x=>previous().some(p=>p.director_id===x.director_id));
   const matchedPrior=matched.map(x=>previous().find(p=>p.director_id===x.director_id));
   const avg=mean(rows.map(sum));
   const change=matched.length?mean(matched.map(sum))-mean(matchedPrior.map(sum)):null;
   $('submissionCount').textContent=String(rows.length);
   $('submissionDetail').textContent=rows.length===1?'One regional director submitted':'Regional director submissions';
   $('completionRate').textContent=roster.length?percent(roster.filter(r=>completed.has(r.id)).length,roster.length)+'%':'—';
   $('nationalAverage').textContent=avg===null?'—':fmt(avg);
   $('nationalChange').textContent=change===null?'—':(change>0?'+':'')+fmt(change);
 }
 function renderSystems(){
   const rows=current();
   if(!rows.length){$('systemsChart').innerHTML='<p class="cmcHealthEmpty">No submissions for this year yet. The system comparison will appear as assessments arrive.</p>';return;}
   $('systemsChart').innerHTML=config.sections.map(s=>{
     const v=mean(rows.map(x=>score(x.scores?.[s.id])).filter(x=>x!==null));
     const pct=v===null?0:v/25*100;
     return '<div class="cmcHealthBarItem"><div><strong>'+esc(s.name)+'</strong><span>'+fmt(v)+' / 25</span></div>'+
       '<div class="cmcHealthBarTrack" role="meter" aria-label="'+esc(s.name)+' average score" aria-valuemin="0" aria-valuemax="25" aria-valuenow="'+(v===null?0:v)+'"><span style="width:'+pct.toFixed(1)+'%"></span></div></div>';
   }).join('');
 }
 function renderCoverage(){
   const rows=current();
   $('regionCoverage').innerHTML=REGIONS.map(region=>{
     const directors=(data.roster||[]).filter(r=>r.region===region);
     const done=new Set(rows.filter(r=>r.region===region).map(x=>x.director_id));
     const count=directors.filter(d=>done.has(d.id)).length;
     const pct=percent(count,directors.length);
     return '<div class="cmcHealthCoverageItem"><div><strong>'+esc(region)+'</strong><span>'+count+' / '+directors.length+' directors submitted</span></div>'+
       '<div class="cmcHealthCoverageTrack"><span style="width:'+(pct||0)+'%"></span></div></div>';
   }).join('');
 }
 function renderMatrix(){
   const rows=current();
   $('regionMatrix').querySelector('thead').innerHTML='<tr><th scope="col">Region</th>'+
       config.sections.map(s=>'<th scope="col"><abbr title="'+esc(s.name)+'">'+esc(s.name)+'</abbr></th>').join('')+
       '<th scope="col">Total / 200</th></tr>';
   $('regionMatrix').querySelector('tbody').innerHTML=REGIONS.map(region=>{
     const subset=rows.filter(x=>x.region===region);
     return '<tr><th scope="row">'+esc(region)+'<small>'+subset.length+' submission'+(subset.length===1?'':'s')+'</small></th>'+
       config.sections.map(s=>{
         const avg=mean(subset.map(r=>score(r.scores?.[s.id])).filter(x=>x!==null));
         const shade=avg===null?'':avg>=18?' strong':avg>=12?' medium':' low';
         return '<td class="'+shade.trim()+'">'+fmt(avg)+'</td>';
       }).join('')+
       '<td class="cmcHealthTotalCell">'+fmt(mean(subset.map(sum)))+'</td></tr>';
   }).join('');
 }
 function renderList(){
   const region=$('reportRegion').value,rows=current().filter(x=>!region||x.region===region);
   $('reportsList').innerHTML=rows.length?rows.map(x=>
     '<button type="button" class="cmcHealthReportRow" data-report="'+esc(x.id)+'">'+
     '<span><strong>'+esc(x.director_name)+'</strong><small>'+esc(x.region)+' · Submitted '+esc(date(x.submitted_at))+'</small></span>'+
     '<span class="cmcHealthReportScore">'+sum(x)+' <small>/ 200</small></span>'+
     '<span class="cmcHealthReportArrow" aria-hidden="true">→</span></button>').join(''):
     '<p class="cmcHealthEmpty">No submitted assessments'+(region?' for '+esc(region):'')+' in '+year+'.</p>';
   $('reportsList').querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.report)));
 }
 function render(){renderSummary();renderSystems();renderCoverage();renderMatrix();renderList();$('exportReports').disabled=!current().length;}
 async function showMyRegion(){
   const viewer=data?.viewer;
   const allowed=viewer?.account_role==='cmc_admin'&&
     ['Central','East','Mountain Plains','Pacific','Southeast'].includes(viewer.region);
   $('myRegionAssessment').classList.toggle('hidden',!allowed);
   $('regionalHealthViews').classList.toggle('hidden',!allowed);
   if(!allowed)return;
   $('myRegionTitle').textContent=viewer.region+' Region · '+year+' Annual Systems Assessment';
   const link=$('myRegionAssessmentAction');
   link.href='regional-assessment.html?year='+year;
   $('myRegionAssessmentStatus').textContent='Checking assessment progress…';
   try{
     const mine=await api('?mode=mine&year='+year);
     const record=mine.record;
     const status=record?.status||'not_started';
     if(status==='submitted'){
       $('myRegionAssessmentStatus').textContent='Submitted '+date(record.submitted_at)+' · Available in national reporting.';
       link.textContent='View submitted assessment →';
     }else if(status==='draft'){
       $('myRegionAssessmentStatus').textContent='Draft saved · Continue where you left off.';
       link.textContent='Continue Assessment →';
     }else{
       $('myRegionAssessmentStatus').textContent='Your region can start this assessment at any time.';
       link.textContent='Start Assessment →';
     }
   }catch(err){
     $('myRegionAssessmentStatus').textContent='You can open the assessment here. '+err.message;
     link.textContent='Open Assessment →';
   }
 }
 async function load(){
   status('Loading '+year+' national assessment results…');$('reportDashboard').classList.add('hidden');
   try{
     data=await api('?mode=reports&year='+year);
     dcAuth.renderRoleNavigation(data.viewer,'health');
     render();
     status('');$('reportDashboard').classList.remove('hidden');
     await showMyRegion();
   }catch(err){status(err.message,true);}
 }
 function sectionDetail(section,answers,scores){
   return '<section class="cmcHealthReportDetailSection"><h3>'+esc(section.name)+'<span>'+ (score(scores?.[section.id])===null?'—':scores[section.id])+' / 25</span></h3>'+
     section.questions.map(q=>'<div class="cmcHealthDetailAnswer"><strong>'+esc(q.label)+'</strong><p>'+esc(answers?.[q.id]||'No response recorded.')+'</p></div>').join('')+'</section>';
 }
 async function openDetail(id){
   $('detailTitle').textContent='Loading assessment…';
   $('detailSubtitle').textContent='';
   $('detailContent').textContent='';
   $('reportDetailDialog').showModal();
   try{
     const res=await api('?mode=detail&id='+encodeURIComponent(id));
     const report=res.record;
     $('detailTitle').textContent=report.director_name;
     $('detailSubtitle').textContent=report.region+' Region · '+report.reporting_year+' · Submitted '+date(report.submitted_at)+' · Total '+sum(report)+' / 200';
     $('detailContent').innerHTML=config.sections.map(s=>sectionDetail(s,report.answers,report.scores)).join('')+
       '<section class="cmcHealthReportDetailSection"><h3>Reflective coaching questions</h3>'+
       config.reflections.map(q=>'<div class="cmcHealthDetailAnswer"><strong>'+esc(q.label)+'</strong><p>'+esc(report.reflections?.[q.id]||'No response recorded.')+'</p></div>').join('')+'</section>';
   }catch(err){$('detailContent').textContent=err.message;}
 }
 function csvCell(v){const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"';}
 function exportCsv(){
   const rows=current();
   const headers=['Year','Region','Director','Submitted','Total / 200',...config.sections.map(s=>s.name+' / 25')];
   const lines=[headers,...rows.map(x=>[x.reporting_year,x.region,x.director_name,x.submitted_at,sum(x),...config.sections.map(s=>x.scores?.[s.id]??'')])];
   const csv='\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='CMC-Regional-Systems-'+year+'.csv';
   document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 }
 $('reportRegion').addEventListener('change',renderList);
 $('exportReports').addEventListener('click',exportCsv);
 $('reportYear').addEventListener('change',()=>{year=Number($('reportYear').value);load();});
 $('closeDetail').addEventListener('click',()=>$('reportDetailDialog').close());
 try{
   config=await fetch('/regional-assessment-config.json').then(r=>{if(!r.ok)throw Error('Could not load assessment definitions.');return r.json();});
   $('reportYear').innerHTML=Array.from({length:Math.min(5,year-2021)},(_,i)=>year-i).map(y=>'<option value="'+y+'">'+y+'</option>').join('');
   await load();
 }catch(err){status(err.message,true);}
})();