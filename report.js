const KNOCKOUT_QUALITIES=new Set(['Spousal Cooperation','Effectively Builds Relationships','Visionizing Capacity','Relates to the Lost and Unchurched','Creates Ministry Ownership','Intrinsically Motivated']);
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function chartColor(score){if(score===null)return '#94a3b8'; const n=Number(score); if(n<3)return 'rgb(79,120,190)'; if(n===3)return 'rgb(100,116,139)'; return 'rgb(42,157,143)'}
function qualityNameHtml(name){return KNOCKOUT_QUALITIES.has(name)?`<strong class="knockoutQuality">${esc(name)}<span class="knockoutStar">*</span></strong>`:esc(name)}
function visualScoreChart(results){return `<section class="reportSection"><h3>Character Quality Score Profile</h3><p class="muted">The center line is the baseline score of 3.0. Each dot shows where that quality landed in relation to the baseline.</p><div class="profileLegend"><span>Lower</span><span>Baseline: 3.0</span><span>Higher</span></div><div class="profileChart">${results.map(r=>{const hasScore=!(r.score===null||r.score===undefined); const point=hasScore?((Number(r.score)-1)/4)*100:50; const width=hasScore?Math.abs(point-50):0; const left=hasScore?Math.min(point,50):50; const color=chartColor(r.score); return `<div class="profileRow"><div class="profileName">${qualityNameHtml(r.name)}</div><div class="profileTrack"><span class="baselineMarker"></span>${hasScore?`<span class="deviationBar" style="left:${left}%;width:${width}%;background:${color};"></span><span class="scoreDot" style="left:${point}%;background:${color};"></span>`:`<span class="naDot">N/A</span>`}</div><div class="profileValue"><strong>${esc(r.score??'N/A')}</strong><span>${esc(r.label)}</span></div></div>`}).join('')}</div></section>`}
function scoreColor(v){v=Number(v)||0; if(v>=85)return '#6c9f3f'; if(v>=70)return '#9bbf2f'; if(v>=50)return '#e0b83e'; return '#b44b4b'}
function barColor(v){v=Number(v)||0; if(v>=70)return '#34d848'; if(v>=50)return '#f3d421'; return '#e21d2f'}

function firstNameOf(candidate){
  const full = (candidate && (candidate.name || candidate.full_name || candidate.fullName)) || 'Candidate';
  return String(full).trim().split(/\s+/)[0] || 'Candidate';
}
function isaSoftBar(v){
  return `<div class="isaMiniBar"><span style="width:${Number(v)||0}%;background:${barColor(v)}"></span><em>${esc(v)}%</em></div>`;
}
function isaReferenceBar(v){
  return `<div class="isaMiniBar isaSoftReferenceBar"><span style="width:${Number(v)||0}%;background:${barColor(v)}"></span><em>${esc(v)}%</em></div>`;
}
function isaScoreCard(cat){
  return `<div class="isaScoreCard">
    <strong>${esc(cat.name)}</strong>
    <div class="isaScoreTrack"><span style="width:${Number(cat.score)||0}%;background:${barColor(cat.score)}"></span></div>
    <em>${esc(cat.score)}%</em>
  </div>`;
}
function isaHowToReadHtml(){
  return `<section class="reportSection isaReportBlock isaGuideBlock">
    <h3>How to Read This Report</h3>
    <p class="isaSectionLead">This report helps reviewers understand a participant's ministry readiness profile. It does not determine calling, character, or final approval by itself. It gives CMC leaders a starting point for better conversation, coaching, and discernment.</p>

    <div class="isaGuideGrid">
      <div class="isaGuideCard">
        <h4>What This Report Measures</h4>
        <div class="isaDefinitionList">
          <div><strong>Church Planting</strong><p>Experience and exposure related to starting new ministry works, gathering people, building teams, raising support, and helping new ministry efforts take shape.</p></div>
          <div><strong>Entrepreneurial Leadership</strong><p>Initiative, risk tolerance, problem solving, vision, ownership, resilience, and leading in uncertain or undeveloped environments.</p></div>
          <div><strong>Ministry Experience</strong><p>Hands-on leadership experience in ministry settings, including teaching, team leadership, group development, supervising others, and building ministry systems.</p></div>
          <div><strong>Relational Evangelism</strong><p>Intentional engagement with people who do not yet know Jesus, including sharing faith, building relationships, discipling new believers, and helping others engage evangelistically.</p></div>
        </div>
      </div>

      <div class="isaGuideCard">
        <h4>How to Read the Comparison Chart</h4>
        <div class="isaLegendList">
          <div><strong>Planter</strong><p>This is the candidate's actual score based on their answers.</p></div>
          <div><strong>Benchmark</strong><p>This is a target readiness marker. It is not a pass/fail line. It helps show what stronger readiness may look like in each category.</p></div>
          <div><strong>Median</strong><p>This is the middle reference point from the comparison profile. It helps show whether the candidate is above, near, or below the typical comparison point.</p></div>
        </div>
      </div>
    </div>

    <div class="isaInterpretGrid">
      <div class="isaInterpretCard green"><strong>Above the Benchmark</strong><p>Likely strength. These areas may point to existing experience, confidence, or gifting that can be leveraged in church multiplication.</p></div>
      <div class="isaInterpretCard blue"><strong>Near the Benchmark</strong><p>Solid potential with room for further development. These areas may not be concerns, but they are worth discussing.</p></div>
      <div class="isaInterpretCard gold"><strong>Below the Median</strong><p>Conversation area. A lower score does not automatically disqualify someone, but it should not be ignored.</p></div>
    </div>

    <div class="isaReflectionBox">
      <strong>The best way to use this report is to ask:</strong>
      <ul>
        <li>What does this confirm?</li>
        <li>What does this raise questions about?</li>
        <li>What needs to be developed before or during the candidate's next step?</li>
      </ul>
    </div>
  </section>`;
}
function isaComparisonTable(categories, candidate){
  const first = firstNameOf(candidate);
  return `<section class="reportSection isaReportBlock">
    <h3>Comparison Chart</h3>
    <p class="muted isaReferenceNote"><strong>${esc(first)}'s score</strong> is shown in the Planter row. <strong>Benchmark</strong> and <strong>Median</strong> are static reference lines for comparison, not additional scores for ${esc(first)}.</p>
    <div class="isaComparisonWrap">
      <div class="isaComparisonGrid isaComparisonGridV44">
        <div class="isaGridHeader">Profiles</div>
        ${categories.map(c=>`<div class="isaGridHeader">${esc(c.name)}</div>`).join('')}

        <div class="isaRowLabel planterRow">Planter <span>Candidate Result</span></div>
        ${categories.map(c=>`<div class="isaGridCell planterCell">${isaSoftBar(c.score)}</div>`).join('')}

        <div class="isaRowLabel referenceRow">Benchmark <span>Static Reference</span></div>
        ${categories.map(c=>`<div class="isaGridCell referenceCell">${isaReferenceBar(c.benchmark)}</div>`).join('')}

        <div class="isaRowLabel referenceRow">Median <span>Static Reference</span></div>
        ${categories.map(c=>`<div class="isaGridCell referenceCell">${isaReferenceBar(c.median)}</div>`).join('')}
      </div>
    </div>
  </section>`;
}
function isaCandidateSuggestion(cats, candidate){
  const first = firstNameOf(candidate);
  const above = cats.filter(c=>Number(c.score)>=Number(c.benchmark)).map(c=>c.name);
  const belowMedian = cats.filter(c=>Number(c.score)<Number(c.median)).map(c=>c.name);
  const belowBenchmark = cats.filter(c=>Number(c.score)<Number(c.benchmark) && Number(c.score)>=Number(c.median)).map(c=>c.name);

  const strengthText = above.length
    ? `${first} shows stronger scores in ${above.join(' and ')}, suggesting existing experience or readiness that may be leveraged in church multiplication.`
    : `${first} does not currently score above the benchmark in any category. This does not disqualify the candidate, but it does suggest that readiness should be explored carefully through conversation and coaching.`;

  const conversationText = belowMedian.length
    ? `${belowMedian.join(' and ')} ${belowMedian.length===1?'is':'are'} below the median. This should become an important conversation area for assessors and coaches.`
    : `${first} does not have any category below the median. Reviewers should still explore the story behind the scores and look for development needs.`;

  const developmentText = belowBenchmark.length
    ? `${belowBenchmark.join(' and ')} ${belowBenchmark.length===1?'is':'are'} below the benchmark but at or above the median. This may indicate developing readiness with room for coaching and additional experience.`
    : `Areas below benchmark are either already noted as conversation areas or ${first} is above benchmark across the remaining categories.`;

  return `<section class="reportSection isaReportBlock">
    <h3>What ${esc(first)}'s Results Suggest</h3>
    <p class="isaSectionLead">These observations are not a verdict. They are prompts for discernment conversations with the candidate, spouse, assessors, coaches, and regional leadership.</p>
    <div class="isaSuggestionGrid">
      <article class="isaSuggestionCard strength"><span class="isaTag green">Likely Strength</span><h4>${above.length ? esc(above.join(' and ')) : 'No Category Above Benchmark'}</h4><p>${esc(strengthText)}</p></article>
      <article class="isaSuggestionCard conversation"><span class="isaTag gold">Conversation Area</span><h4>${belowMedian.length ? esc(belowMedian.join(' and ')) : 'No Category Below Median'}</h4><p>${esc(conversationText)}</p></article>
      <article class="isaSuggestionCard development"><span class="isaTag blue">Development Area</span><h4>${belowBenchmark.length ? esc(belowBenchmark.join(' and ')) : 'Continued Discernment'}</h4><p>${esc(developmentText)}</p></article>
      <article class="isaSuggestionCard"><span class="isaTag blue">Next Conversation</span><h4>Recommended Follow-Up</h4><p>Reviewers should ask where these scores confirm lived experience, where the candidate may need coaching, and what support would strengthen readiness before or during the next step.</p></article>
    </div>
  </section>`;
}
function isaInDepth(answers, candidate){
  const first = firstNameOf(candidate);
  const rows=Object.keys(answers||{}).map(k=>({id:Number(k),...(answers[k]||{})})).filter(x=>x.id).sort((a,b)=>a.id-b.id);
  return `<section class="reportSection isaReportBlock">
    <h3>ISA in Depth</h3>
    <p class="isaSectionLead">These are ${esc(first)}'s item-by-item answers. They should be used for context when discussing category scores, strengths, and possible development areas.</p>
    <table class="isaDepthTable isaDepthTableV44">
      <thead><tr><th>No.</th><th>Question</th><th>Answer</th><th>Group</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.question)}</td><td>${esc(r.answer)}</td><td>${esc(r.group)}</td></tr>`).join('')}</tbody>
    </table>
  </section>`;
}


function isaReportHtml(record){
  const c=record.candidate||{};
  const s=record.scores||{};
  const cats=s.categories||[];
  const pct=s.overall||record.overall||0;
  const first=firstNameOf(c);
  return `<div class="reportPrintActions noPrint"><button type="button" onclick="window.print()">Print / Save as PDF</button></div><div class="isaReport isaReportV44">
    <div class="isaReportTitle isaReportHeroV44">
      <div>
        <div class="eyebrow">Ministry Readiness Inventory</div>
        <h2>${esc(c.name||'Candidate')} ISA-Style Score</h2>
        <p class="muted">${esc(c.email||'')} · ${esc(c.phone||'')} · ${esc(c.state||'')} / ${esc(c.region||record.region||'')} Region</p>
      </div>
      <div class="isaOverall" style="border-color:${scoreColor(pct)}"><strong>${esc(pct)}%</strong><span>${esc(s.overallLabel||record.overallLabel||'')}</span></div>
    </div>
    <div class="isaScoreStripV44">${cats.map(isaScoreCard).join('')}</div>
    ${isaHowToReadHtml()}
    ${isaComparisonTable(cats, c)}
    ${isaCandidateSuggestion(cats, c)}
    <section class="reportSection isaReportBlock"><h3>Category Interpretation</h3><div class="isaCategoryCards">${cats.map(cat=>`<article class="isaCategoryCard"><div class="isaCategoryAccent" style="background:${barColor(cat.score)}"></div><div><h4>${esc(cat.name)} <span>${esc(cat.score)}% · ${esc(cat.label)}</span></h4><p>${esc(cat.description||'')}</p><small>Benchmark ${esc(cat.benchmark)}% · Median ${esc(cat.median)}%</small></div></article>`).join('')}</div></section>
    ${isaInDepth(record.answers||{}, c)}
  </div>`;
}



// v82: Ministry Style report helper loaded through ministry-style-report.js for candidate reports.
