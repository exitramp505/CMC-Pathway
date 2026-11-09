/* Versioned CMC Ministry Style report; legacy reports remain rendered by ministry-style-report.js. */
(function(root){
 const META={
 pioneer:{name:'Pioneer',color:'#bd5050',strength:'moving from possibility to practical action',caution:'moving faster than trust and shared ownership can develop',pressure:'may become more decisive or impatient under pressure',partner:'people who bring patient listening, reliable follow-through, and detail awareness',growth:'Ask two people for their perspective before a high-impact decision.'},
 mobilizer:{name:'Mobilizer',color:'#be922f',strength:'building energy and inviting people into a compelling vision',caution:'assuming enthusiasm is the same as commitment',pressure:'may lean harder on encouragement and avoid uncomfortable realities',partner:'people who translate vision into accountable steps and honest feedback',growth:'Turn one inspiring vision into clear owners, milestones, and follow-up.'},
 shepherd:{name:'Shepherd',color:'#347fa7',strength:'building belonging, trust, patient relationships, and care',caution:'deferring necessary decisions to preserve comfort',pressure:'may carry too much emotional weight or postpone hard conversations',partner:'people who bring timely decisions, initiative, and structural clarity',growth:'Practice a caring but clear conversation about a delayed decision.'},
 steward:{name:'Steward',color:'#4e956b',strength:'organizing responsibilities, tracking details, and evaluating risks',caution:'waiting for certainty when a thoughtful first step is possible',pressure:'may become increasingly analytical or controlling of details',partner:'people who move ideas forward and create relational energy',growth:'Identify a small, responsible experiment rather than waiting for a perfect plan.'}
 };
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function buildReportHtml(record,opts={}){
  const s=record?.scores||{};
  if(s.instrumentVersion!==2)return '';
  const primary=META[s.primaryStyle]||META.pioneer,secondary=META[s.secondaryStyle]||META.mobilizer;
  const names=Object.keys(META),audience=opts.audience||'candidate',coach=audience==='coach'||audience==='admin';
  const bars=names.map(k=>'<div class="msv2Bar"><span>'+META[k].name+'</span><div class="msv2BarTrack" role="img" aria-label="'+META[k].name+' agreement index '+Math.round(s.agreement?.[k]||0)+' out of 100"><span style="width:'+Math.max(0,Math.min(100,Number(s.agreement?.[k])||0))+'%;background:'+META[k].color+'"></span></div></div>').join('');
  const easeRows=names.map(k=>'<li><strong>'+META[k].name+':</strong> '+Math.round(s.ease?.[k]||0)+' / 100 ease index</li>').join('');
  const gap=Number(s.primarySecondaryGap||0);
  const close=gap<=8?'Your two leading styles are close, so your preferences may shift considerably with context.':'Your leading style appears more pronounced than the next, while both may shape your ministry.';
  const questions=[
    'Where do these patterns resemble your lived ministry experience?',
    'When has your leading strength helped a team flourish?',
    'Where might this strength become overused?',
    'Who helps supply strengths that do not come as naturally to you?',
    'What is one practical action you can take in the next month?'
  ];
  return '<div class="msv2Report"><section class="msv2ReportIntro"><p class="msv2Eyebrow">CMC PATHWAY · MINISTRY STYLE REPORT · VERSION 2</p><h2>'+esc(primary.name)+' + '+esc(secondary.name)+'</h2><p>'+esc(record?.candidate?.name||'Participant')+' · Your current self-reported leadership tendencies</p><p>'+esc(close)+'</p><div class="msv2Bars">'+bars+'</div><p class="msv2Subtle">These bars describe a response index within this inventory, not a percentile or a validated personality score.</p></section>'+
  '<section class="msv2ReportSection"><h3>How you may contribute</h3><div class="msv2ReportGrid"><article><h4>'+esc(primary.name)+'</h4><p>Your strongest pattern suggests a natural preference for '+esc(primary.strength)+'.</p></article><article><h4>'+esc(secondary.name)+'</h4><p>Your next strongest pattern may add '+esc(secondary.strength)+'.</p></article></div></section>'+
  '<section class="msv2ReportSection"><h3>When your strengths are stretched</h3><p>A possible caution for your '+esc(primary.name)+' pattern is '+esc(primary.caution)+'. Under pressure, this style '+esc(primary.pressure)+'. These are conversation starters, not predictions.</p><p>Your secondary pattern may also be stretched by '+esc(secondary.caution)+'.</p></section>'+
  '<section class="msv2ReportSection"><h3>What feels easier in ministry?</h3><p>This separate set of ratings reflects how approachable particular ministry activities feel right now; it does not measure competency or effectiveness.</p><ul class="msv2List">'+easeRows+'</ul></section>'+
  '<section class="msv2ReportSection"><h3>Teams and church multiplication</h3><p>You may be most fruitful when paired with '+esc(primary.partner)+'. Different styles can contribute to pioneering, gathering, discipling, and sustaining healthy churches. A style preference is not a measure of calling or readiness.</p></section>'+
  '<section class="msv2ReportSection"><h3>One next step</h3><p>'+esc(primary.growth)+'</p></section>'+
  '<section class="msv2ReportSection"><h3>'+(coach?'CMC coach conversation':'Reflect on your results')+'</h3><ul class="msv2List">'+questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>'+(coach?'<p>Explore these impressions in conversation and observation. Do not use this inventory by itself to make a credentialing, placement, or church-planting decision.</p>':'')+'</section>'+
  '<section class="msv2ReportSection"><h3>How to understand this report</h3><p>This original CMC self-report inventory is a developmental coaching tool. It has not been normed, independently validated, or licensed as an Everything DiSC assessment. Results are preferences, not proof of abilities, spiritual maturity, calling, or suitability for ministry.</p></section>'+
  '<div class="msv2ReportActions noPrint"><button type="button" class="cmcSecondaryButton" onclick="window.print()">Print / Save as PDF</button></div></div>';
 }
 root.MinistryStyleV2Report={buildReportHtml,META};
})(typeof window!=='undefined'?window:globalThis);
