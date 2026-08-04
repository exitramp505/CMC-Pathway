const PDFDocument = require('pdfkit');

const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico'};
const STATE_REGIONS={WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',FL:'Southeast',GA:'Southeast',AL:'Southeast',MS:'Southeast',LA:'Southeast',SC:'Southeast',NC:'Southeast',PR:'Southeast'};
const KNOCKOUT_QUALITIES=new Set(['Spousal Cooperation','Effectively Builds Relationships','Visionizing Capacity','Relates to the Lost and Unchurched','Creates Ministry Ownership','Intrinsically Motivated']);
const SECTION_ORDER=['Resilience','Spousal Cooperation','Financial Responsibility','Builds Group Cohesiveness','Effectively Builds Relationships','Flexible and Adaptable','Exercises Faith','Cultural Agility','Visionizing Capacity','Utilizes Giftedness of Others','Relates to the Lost and Unchurched','Responsive to Community','Creates Ministry Ownership','Committed to Kingdom Growth','Intrinsically Motivated'];
const QUALITY_DEFINITIONS={
 "Resilience":"Resilience reflects the candidate's capacity to keep moving faithfully when ministry becomes difficult. It includes emotional steadiness under pressure, the ability to recover after disappointment or criticism, and the maturity to learn from setbacks without becoming defeated, reactive, or withdrawn.",
 "Spousal Cooperation":"For married candidates, Spousal Cooperation reflects the health of shared calling and family alignment. It looks at whether ministry expectations are openly discussed, whether roles and boundaries are clear, and whether the couple can protect family life while serving together through the demands of ministry.",
 "Financial Responsibility":"Financial Responsibility reflects the candidate's stewardship, discipline, and credibility with resources. It includes managing personal finances wisely, avoiding unnecessary financial pressure, living within realistic limits, and demonstrating the trustworthiness needed to handle church or ministry funds with integrity.",
 "Builds Group Cohesiveness":"Builds Group Cohesiveness reflects the ability to gather people into a unified ministry community. It includes helping newcomers belong, keeping a group focused on mission, building morale, encouraging collaboration, and addressing conflict in ways that preserve trust and move people forward together.",
 "Effectively Builds Relationships":"Effectively Builds Relationships reflects the candidate's ability to form genuine, trust-building connections with people. It includes taking initiative relationally, listening well, responding to needs with compassion, helping others feel safe and valued, and relating wisely across different personalities and backgrounds.",
 "Flexible and Adaptable":"Flexible and Adaptable reflects the candidate's ability to adjust without losing mission clarity. It includes handling ambiguity, changing methods when circumstances require it, responding creatively to challenges, and adapting leadership priorities through different seasons of ministry growth and pressure.",
 "Exercises Faith":"Exercises Faith reflects a pattern of leadership rooted in dependence on God rather than anxiety, control, or self-reliance. It includes conviction about calling, prayerful decision-making, expectancy that God is at work, willingness to obey before outcomes are guaranteed, and patience to wait on God's timing.",
 "Cultural Agility":"Cultural Agility reflects the candidate's ability to understand and serve people whose background, assumptions, or lived experience differ from their own. It includes humility, curiosity, cultural awareness, and the ability to adapt communication and ministry approaches to the actual people being reached.",
 "Visionizing Capacity":"Visionizing Capacity reflects the ability to see and communicate a compelling ministry future. It includes forming a clear picture of what God may be building, translating vision into practical next steps, helping others see beyond present limitations, and treating challenges as opportunities rather than dead ends.",
 "Utilizes Giftedness of Others":"Utilizes Giftedness of Others reflects the candidate's ability to recognize, develop, and release the gifts of people around them. It includes matching people to meaningful opportunities, delegating wisely, equipping before assigning responsibility, and building ministry that does not depend entirely on one leader.",
 "Relates to the Lost and Unchurched":"Relates to the Lost and Unchurched reflects the candidate's ability to build authentic connection with people outside the church. It includes communicating faith naturally, understanding questions and barriers unchurched people carry, creating welcoming pathways, and moving toward spiritually curious or disconnected people with confidence and care.",
 "Responsive to Community":"Responsive to Community reflects the candidate's attentiveness to the real life, needs, culture, and pulse of the surrounding community. It includes listening before acting, identifying practical ways to serve, adapting ministry to the local context, and blessing the neighborhood rather than only serving insiders.",
 "Creates Ministry Ownership":"Creates Ministry Ownership reflects the ability to move people from attendance into shared responsibility. It includes helping people buy into the vision, giving away meaningful responsibility, equipping teams, building shared identity, and creating systems where ministry continues without everything depending on the primary leader.",
 "Committed to Kingdom Growth":"Committed to Kingdom Growth reflects a deep commitment to discipleship, mission, outreach, and multiplication. It includes resisting maintenance-only ministry, valuing growth as spiritual and relational transformation, celebrating Kingdom fruit beyond one organization, and seeking more and better disciples for the sake of God's mission.",
 "Intrinsically Motivated":"Intrinsically Motivated reflects the candidate's inner drive, initiative, and perseverance. It includes working from a sense of call rather than recognition, following through without constant external pressure, anticipating needed work, persisting through slow seasons, and being willing to build from little or nothing."
};

function clean(v){return String(v ?? '').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-');}
function money(v){return v === null || v === undefined ? 'N/A' : String(v);}
function rgb(hex){const h=hex.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function chartColor(score){if(score===null||score===undefined)return '#94a3b8'; const n=Number(score); if(n<3){const k=Math.max(0,Math.min(1,(n-1)/2)); const r=Math.round(79+(37-79)*k); const g=Math.round(120+(99-120)*k); const b=Math.round(190+(235-190)*k); return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`} const k=Math.max(0,Math.min(1,(n-3)/2)); const r=Math.round(42+(22-42)*k); const g=Math.round(157+(22-157)*k); const b=Math.round(143+(90-143)*k); return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`}
function softColor(score){if(score===null||score===undefined)return '#f1f5f9'; if(Number(score)<3)return '#eef5ff'; if(Number(score)===3)return '#f8fafc'; return '#edf8f3';}
function formatDate(value){try{return new Date(value || Date.now()).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}catch(_){return ''}}
function regionForState(st){return STATE_REGIONS[st] || 'Unassigned'}
function normalizeResults(results){const map=Object.fromEntries((results||[]).map(x=>[x.name,x])); return SECTION_ORDER.map(name=>map[name]||{name,score:null,label:'N/A'});}

function buildPdfBuffer(data, opts={}){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'LETTER',margin:42,bufferPages:true,info:{Title:'CMC Pathway Character Qualities Report'}});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);
    drawReport(doc,data,opts);
    doc.end();
  });
}

function drawReport(doc,data,opts={}){
  const c=data.candidate||{};
  const s=data.scores||{};
  const results=normalizeResults(s.results||[]);
  const stateName=STATES[c.state]||c.state||'';
  const region=regionForState(c.state);
  const submitted=data.submittedAt||data.generatedAt||new Date().toISOString();
  let page=1;
  const navy='#17233b', muted='#5b667a', light='#eef2f7', border='#d8dee9', green='#15945f', blue='#4267b2';
  function footer(){doc.fontSize(8).fillColor('#7b8495').text(`CMC Pathway Character Qualities Report | Page ${page}`,42,730,{align:'center',width:528});}
  function newPage(){footer(); doc.addPage(); page++;}
  function pill(x,y,w,h,text,fill,stroke,color=navy){doc.roundedRect(x,y,w,h,10).fillAndStroke(fill,stroke); doc.fillColor(color).font('Helvetica-Bold').fontSize(9).text(clean(text),x+9,y+7,{width:w-18,align:'center'});}
  function sectionTitle(text,y){doc.fillColor(navy).font('Helvetica-Bold').fontSize(16).text(text,42,y); doc.moveTo(42,y+24).lineTo(570,y+24).strokeColor(border).lineWidth(1).stroke(); return y+40;}

  // Page 1
  doc.rect(0,0,612,792).fill('#f8fafc');
  doc.roundedRect(36,36,540,700,18).fillAndStroke('#ffffff',border);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(23).text('CMC Pathway Participant',62,66);
  doc.fontSize(23).text('Assessment Report',62,94);
  doc.fillColor(muted).font('Helvetica').fontSize(10).text('Confidential assessment summary prepared for CMC leadership review.',62,128);
  doc.roundedRect(62,164,300,118,12).fillAndStroke('#f8fafc',border);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('Candidate',82,184);
  doc.fillColor('#0f172a').fontSize(15).text(clean(c.name||'Candidate'),82,202,{width:250});
  doc.fillColor(muted).font('Helvetica').fontSize(9).text(clean(c.email||''),82,228,{width:250});
  if(c.phone) doc.text(clean(c.phone),82,243,{width:250});
  doc.text(`${clean(stateName)} / ${clean(region)} Region`,82,258,{width:250});
  doc.roundedRect(386,164,132,118,12).fillAndStroke('#eef7f1','#c9e7d4');
  doc.fillColor(green).font('Helvetica-Bold').fontSize(10).text('Overall Readiness',404,184,{width:96,align:'center'});
  doc.fillColor(navy).fontSize(30).text(String(s.overall||''),404,204,{width:96,align:'center'});
  doc.fillColor(muted).font('Helvetica-Bold').fontSize(10).text(clean(s.overallLabel||''),404,240,{width:96,align:'center'});
  let y=326;
  y=sectionTitle('Understanding the Character Qualities',y);
  doc.fillColor('#334155').font('Helvetica').fontSize(11).text('The fifteen character qualities give CMC leaders a shared language for discussing readiness, strengths, and growth areas. This report is not designed as a pass-or-fail scorecard. A score of 3.0 represents the baseline, meaning the quality is evident at a normal and expected level for this stage of discernment.',62,y,{width:488,lineGap:4});
  y+=88;
  doc.fillColor('#334155').fontSize(11).text('Scores below 3.0 point to areas for further development. Scores above 3.0 point to relative strengths. Categories marked with an asterisk (*) are knock-out factors from the assessment model and should receive special attention in discernment conversations.',62,y,{width:488,lineGap:4});
  y+=86;
  doc.roundedRect(62,y,488,76,12).fillAndStroke('#fbfcfe',border);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(11).text('Report Contents',82,y+18);
  doc.fillColor(muted).font('Helvetica').fontSize(10).text('1. Character Quality Score Profile\n2. Character Quality Descriptions\n3. Report note and review guidance',82,y+38,{lineGap:3});
  doc.fillColor(muted).fontSize(9).text(`Submitted: ${formatDate(submitted)}${opts.leaderEmail?`   |   Routed Leader: ${clean(opts.leaderEmail)}`:''}`,62,696,{width:488});
  newPage();

  // Page 2 profile
  doc.rect(0,0,612,792).fill('#ffffff');
  y=sectionTitle('Character Quality Score Profile',56);
  doc.fillColor(muted).font('Helvetica').fontSize(10).text('The center line is the baseline score of 3.0. Each row shows how the quality landed in relation to that baseline. Blue indicates below baseline; green indicates above baseline.',62,y,{width:488,lineGap:3});
  y+=52;
  const chartX=62, nameW=190, trackX=chartX+nameW+12, trackW=230, scoreX=trackX+trackW+16, rowH=34;
  doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('LOWER',trackX,y-14,{width:60});
  doc.text('BASELINE 3.0',trackX+92,y-14,{width:90,align:'center'});
  doc.text('HIGHER',trackX+trackW-60,y-14,{width:60,align:'right'});
  const topY=y;
  doc.moveTo(trackX+trackW/2,topY-4).lineTo(trackX+trackW/2,topY+rowH*results.length-2).strokeColor('#7b8495').dash(3,3).lineWidth(1.4).stroke().undash();
  results.forEach((r,i)=>{
    const ry=topY+i*rowH;
    doc.moveTo(chartX,ry+rowH-1).lineTo(550,ry+rowH-1).strokeColor('#edf1f6').lineWidth(.8).stroke();
    doc.fillColor(navy).font(KNOCKOUT_QUALITIES.has(r.name)?'Helvetica-BoldOblique':'Helvetica-Bold').fontSize(9.4).text(clean(r.name+(KNOCKOUT_QUALITIES.has(r.name)?' *':'')),chartX,ry+10,{width:nameW});
    doc.roundedRect(trackX,ry+10,trackW,11,5).fill('#f1f5f9');
    if(r.score!==null&&r.score!==undefined){
      const p=((Number(r.score)-1)/4)*trackW;
      const center=trackW/2;
      const x=trackX+Math.min(p,center);
      const w=Math.abs(p-center);
      const color=chartColor(r.score);
      doc.roundedRect(x,ry+10,w||2,11,5).fill(color);
      doc.circle(trackX+p,ry+15.5,5.5).fillAndStroke(color,'#ffffff');
    } else {
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('N/A', trackX + trackW / 2 - 10, ry + 7, {width:20,align:'center'});
    }
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text(money(r.score),scoreX,ry+6,{width:48,align:'center'});
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.2).text(clean(r.label||''),scoreX-4,ry+20,{width:56,align:'center'});
  });
  doc.fillColor(muted).font('Helvetica-BoldOblique').fontSize(9).text('* Knock-out Factor',62,704);
  newPage();

  // Description pages
  let idx=0;
  while(idx<results.length){
    doc.rect(0,0,612,792).fill('#ffffff');
    y=sectionTitle(idx===0?'Character Quality Descriptions':'Character Quality Descriptions, continued',56);
    doc.fillColor(muted).font('Helvetica').fontSize(9.5).text('Each description explains what the category is intended to surface in the discernment process. The score badge reflects the candidate\'s current self-assessment pattern for that quality.',62,y,{width:488,lineGap:3});
    y+=42;
    const colW=238, gap=18, cardH=128;
    const positions=[];
    for(let r=0;r<4;r++){for(let c2=0;c2<2;c2++){positions.push([62+c2*(colW+gap),y+r*(cardH+14)]);}}
    for(let p=0;p<positions.length && idx<results.length;p++,idx++){
      const r=results[idx]; const [x,cy]=positions[p];
      doc.roundedRect(x,cy,colW,cardH,10).fillAndStroke('#ffffff',border);
      if(KNOCKOUT_QUALITIES.has(r.name)) doc.rect(x,cy,4,cardH).fill('#2f6f68');
      doc.fillColor(navy).font(KNOCKOUT_QUALITIES.has(r.name)?'Helvetica-BoldOblique':'Helvetica-Bold').fontSize(10).text(clean(r.name+(KNOCKOUT_QUALITIES.has(r.name)?' *':'')),x+14,cy+14,{width:142});
      if(KNOCKOUT_QUALITIES.has(r.name)) pill(x+14,cy+34,85,18,'Knock-Out', '#eef7f1','#c9e7d4','#246b58');
      const bx=x+174, by=cy+14;
      doc.roundedRect(bx,by,46,38,9).fillAndStroke(softColor(r.score),border);
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(13).text(money(r.score),bx+5,by+7,{width:36,align:'center'});
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(6.6).text(clean(r.label||''),bx+4,by+23,{width:38,align:'center'});
      const textY=KNOCKOUT_QUALITIES.has(r.name)?cy+59:cy+46;
      doc.fillColor('#475569').font('Helvetica').fontSize(8.8).text(clean(QUALITY_DEFINITIONS[r.name]||''),x+14,textY,{width:206,lineGap:2,height:cardH-(textY-cy)-12,ellipsis:true});
    }
    if(idx<results.length)newPage();
  }
  doc.fillColor(muted).fontSize(8.5).text('This report is a discernment tool and should be reviewed alongside interviews, coach observations, and the broader CMC pathway.',62,708,{width:488,align:'center'});
  footer();
}

function safeFileName(value){return String(value||'candidate').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'candidate';}

module.exports={buildPdfBuffer,safeFileName,QUALITY_DEFINITIONS,KNOCKOUT_QUALITIES,STATES,STATE_REGIONS,chartColor,clean};
