const PDFDocument = require('pdfkit');

function safe(v){ return String(v ?? ''); }
function num(v){ return Number(v) || 0; }
function escFile(v){ return safe(v).replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase() || 'ministry-readiness-report'; }
function firstName(candidate){ return safe(candidate.name || 'Candidate').trim().split(/\s+/)[0] || 'Candidate'; }
function labelFor(p){ if(p>=85)return 'Very Strong'; if(p>=70)return 'Strong'; if(p>=50)return 'Developing'; return 'Needs Development'; }
function categoryColor(v){ v=num(v); if(v>=70)return '#34d848'; if(v>=50)return '#f3d421'; return '#e21d2f'; }
function overallColor(v){ v=num(v); if(v>=85)return '#6c9f3f'; if(v>=70)return '#9bbf2f'; if(v>=50)return '#e0b83e'; return '#b44b4b'; }
function wrapText(text, max){ const s=safe(text); return s.length>max ? s.slice(0,max-3)+'...' : s; }

const PAGE_W = 612, PAGE_H = 792;
const M = 36;
const CONTENT_W = PAGE_W - (M*2);

function drawFooter(doc, page){
  doc.font('Helvetica').fontSize(8).fillColor('#7b8494')
    .text('Ministry Readiness Inventory Report', M, PAGE_H-30, {width:360});
  doc.text(`Page ${page}`, PAGE_W-96, PAGE_H-30, {width:60, align:'right'});
}

function addPage(doc, pageRef){
  doc.addPage();
  pageRef.page++;
  drawFooter(doc, pageRef.page);
}

function card(doc, x, y, w, h, fill='#ffffff', stroke='#d9e2ec', r=14){
  doc.roundedRect(x,y,w,h,r).fillAndStroke(fill, stroke);
}

function sectionTitle(doc, title, x, y){
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1f2933').text(title, x, y);
}

function paragraph(doc, text, x, y, w, size=9.5, color='#52617a', lineGap=2){
  doc.font('Helvetica').fontSize(size).fillColor(color);
  doc.text(text, x, y, {width:w, lineGap});
  return doc.y;
}

function drawHeader(doc, candidate, scores){
  card(doc, M, 42, CONTENT_W, 104, '#ffffff', '#d9e2ec', 16);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('MINISTRY READINESS INVENTORY', M+18, 60, {characterSpacing:1.2});
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#1e88c9').text(`${safe(candidate.name || 'Candidate')} ISA-Style Score`, M+18, 76, {width:350});
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(`${safe(candidate.email||'')} · ${safe(candidate.state||'')} / ${safe(candidate.region||'')} Region`, M+18, 108, {width:370});

  const overall = num(scores.overall);
  doc.roundedRect(PAGE_W-132, 62, 78, 68, 14).fillAndStroke('#fffdf5', overallColor(overall));
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#0f172a').text(`${overall}%`, PAGE_W-124, 78, {width:62, align:'center'});
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#52617a').text(safe(scores.overallLabel || labelFor(overall)), PAGE_W-124, 110, {width:62, align:'center'});
}

function drawScoreStrip(doc, scores, y){
  const cats = scores.categories || [];
  card(doc, M, y, CONTENT_W, 78, '#ffffff', '#d9e2ec', 14);
  const gap = 10;
  const itemW = (CONTENT_W - 30 - gap*3)/4;
  cats.forEach((cat,i)=>{
    const x = M+15+i*(itemW+gap);
    card(doc, x, y+14, itemW, 50, '#fbfdff', '#eef2f6', 10);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(wrapText(cat.name, 28), x+8, y+22, {width:itemW-16});
    doc.roundedRect(x+8, y+40, itemW-54, 6, 3).fill('#edf2f7');
    doc.roundedRect(x+8, y+40, Math.max(3,(itemW-54)*num(cat.score)/100), 6, 3).fill(categoryColor(cat.score));
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(`${cat.score}%`, x+itemW-40, y+35, {width:32, align:'right'});
  });
}

function drawHowToRead(doc, y){
  card(doc, M, y, CONTENT_W, 270, '#ffffff', '#d9e2ec', 14);
  sectionTitle(doc, 'How to Read This Report', M+18, y+18);
  let ty = paragraph(doc, "This report is designed to help reviewers understand a candidate's ministry readiness profile. It does not determine calling, character, or final approval by itself. It gives CMC leaders a starting point for better conversation, coaching, and discernment.", M+18, y+42, CONTENT_W-36, 9.4);

  const colW = (CONTENT_W-48)/2;
  const leftX = M+18, rightX = leftX+colW+12;
  card(doc, leftX, y+88, colW, 118, '#fbfdff', '#eef2f6', 10);
  card(doc, rightX, y+88, colW, 118, '#fbfdff', '#eef2f6', 10);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2933').text('What This Report Measures', leftX+12, y+102);
  const defs = [
    ['Church Planting','Starting new ministry works, gathering people, building teams, raising support, and helping new efforts take shape.'],
    ['Entrepreneurial Leadership','Initiative, risk tolerance, problem solving, vision, ownership, resilience, and leading in uncertain environments.'],
    ['Ministry Experience','Hands-on leadership experience in ministry settings, teaching, team leadership, group development, and ministry systems.'],
    ['Relational Evangelism','Intentional engagement with people who do not yet know Jesus, sharing faith, relationships, discipleship, and evangelism.']
  ];
  let dy = y+121;
  defs.forEach(([name,desc])=>{
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(name, leftX+12, dy, {width:75});
    doc.font('Helvetica').fontSize(7.1).fillColor('#52617a').text(desc, leftX+90, dy, {width:colW-102, lineGap:0});
    dy += 21;
  });

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2933').text('How to Read the Comparison Chart', rightX+12, y+102);
  const legends = [
    ['Planter',"The candidate's actual score based on their answers."],
    ['Benchmark','A target readiness marker. It is not a pass/fail line.'],
    ['Median','The middle reference point from the comparison profile.']
  ];
  dy = y+123;
  legends.forEach(([name,desc])=>{
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(name, rightX+12, dy);
    doc.font('Helvetica').fontSize(7.4).fillColor('#52617a').text(desc, rightX+12, dy+9, {width:colW-24, lineGap:0});
    dy += 30;
  });

  const boxW = (CONTENT_W-56)/3;
  const boxes = [
    ['Above the Benchmark','Likely strength. These areas may point to experience, confidence, or gifting.','#fbfffd','#bee8cf'],
    ['Near the Benchmark','Solid potential with room for further development. Worth discussing.','#fbfdff','#cfe1fa'],
    ['Below the Median','Conversation area. A lower score does not automatically disqualify someone.','#fffdf5','#f8e3a2']
  ];
  boxes.forEach(([title,body,fill,stroke],i)=>{
    const x=M+18+i*(boxW+10);
    card(doc,x,y+218,boxW,38,fill,stroke,9);
    doc.font('Helvetica-Bold').fontSize(7.9).fillColor('#1f2933').text(title,x+8,y+226,{width:boxW-16});
    doc.font('Helvetica').fontSize(6.6).fillColor('#52617a').text(body,x+8,y+238,{width:boxW-16,lineGap:0});
  });
}

function drawComparison(doc, scores, candidate, y){
  const first = firstName(candidate);
  card(doc, M, y, CONTENT_W, 174, '#ffffff', '#d9e2ec', 14);
  sectionTitle(doc, 'Comparison Chart', M+18, y+18);
  paragraph(doc, `${first}'s score is shown in the Planter row. Benchmark and Median are static reference lines for comparison, not additional scores for ${first}.`, M+18, y+42, CONTENT_W-36, 8.8);

  const cats = scores.categories || [];
  const tableX=M+18, tableY=y+72;
  const widths=[92,108,128,108,108];
  const headers=['Profiles',...cats.map(c=>c.name)];
  let x=tableX;
  headers.forEach((h,i)=>{
    doc.rect(x,tableY,widths[i],24).fill('#0f172a');
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('white').text(wrapText(h,26),x+6,tableY+8,{width:widths[i]-12});
    x+=widths[i];
  });
  const rows=[
    {name:'Planter', note:'Candidate Result', key:'score', fill:'#ffffff', muted:false},
    {name:'Benchmark', note:'Static Reference', key:'benchmark', fill:'#f8fafc', muted:true},
    {name:'Median', note:'Static Reference', key:'median', fill:'#f8fafc', muted:true}
  ];
  rows.forEach((row,ri)=>{
    const ry=tableY+24+ri*26;
    doc.rect(tableX,ry,widths.reduce((a,b)=>a+b,0),26).fill(row.fill);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(row.muted?'#64748b':'#0f172a').text(row.name,tableX+6,ry+5,{width:80});
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#64748b').text(row.note.toUpperCase(),tableX+6,ry+16,{width:84});
    cats.forEach((cat,ci)=>{
      const val = num(row.key==='score'?cat.score:cat[row.key]);
      const cx=tableX+widths[0]+widths.slice(1,ci+1).reduce((a,b)=>a+b,0)+8;
      const barW=widths[ci+1]-46;
      doc.roundedRect(cx,ry+10,barW,6,3).fill('#e5e7eb');
      doc.roundedRect(cx,ry+10,Math.max(3,barW*val/100),6,3).fill(categoryColor(val));
      if(row.muted) doc.fillOpacity(.58).rect(cx,ry+10,Math.max(3,barW*val/100),6).fill(categoryColor(val)).fillOpacity(1);
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#0f172a').text(`${val}%`,cx+barW+5,ry+7,{width:30,align:'right'});
    });
  });
}

function drawSuggestions(doc, scores, candidate, y){
  const first = firstName(candidate);
  const cats = scores.categories || [];
  const above = cats.filter(c=>num(c.score)>=num(c.benchmark)).map(c=>c.name);
  const belowMedian = cats.filter(c=>num(c.score)<num(c.median)).map(c=>c.name);
  const belowBenchmark = cats.filter(c=>num(c.score)<num(c.benchmark) && num(c.score)>=num(c.median)).map(c=>c.name);

  card(doc, M, y, CONTENT_W, 198, '#ffffff', '#d9e2ec', 14);
  sectionTitle(doc, `What ${first}'s Results Suggest`, M+18, y+18);
  paragraph(doc, 'These observations are not a verdict. They are prompts for discernment conversations with the candidate, spouse, assessors, coaches, and regional leadership.', M+18, y+42, CONTENT_W-36, 8.8);

  const cards=[
    ['Likely Strength', above.length?above.join(' and '):'No Category Above Benchmark', above.length?`${first} shows stronger scores in ${above.join(' and ')}, suggesting existing experience or readiness that may be leveraged in church multiplication.`:`${first} does not currently score above the benchmark in any category.`, '#fbfffd','#bee8cf'],
    ['Conversation Area', belowMedian.length?belowMedian.join(' and '):'No Category Below Median', belowMedian.length?`${belowMedian.join(' and ')} ${belowMedian.length===1?'is':'are'} below the median. This should become an important conversation area for assessors and coaches.`:`${first} does not have any category below the median.`, '#fffdf5','#f8e3a2'],
    ['Development Area', belowBenchmark.length?belowBenchmark.join(' and '):'Continued Discernment', belowBenchmark.length?`${belowBenchmark.join(' and ')} ${belowBenchmark.length===1?'is':'are'} below the benchmark but at or above the median. This may indicate developing readiness.`:`Areas below benchmark are either already noted as conversation areas or ${first} is above benchmark across the remaining categories.`, '#fbfdff','#cfe1fa'],
    ['Next Conversation','Recommended Follow-Up','Reviewers should ask where these scores confirm lived experience, where the candidate may need coaching, and what support would strengthen readiness before or during the next step.', '#fbfdff','#eef2f6']
  ];
  const cardW=(CONTENT_W-48)/2;
  cards.forEach((c,i)=>{
    const x=M+18+(i%2)*(cardW+12);
    const yy=y+72+Math.floor(i/2)*58;
    card(doc,x,yy,cardW,50,c[3],c[4],10);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#52617a').text(c[0].toUpperCase(),x+10,yy+8);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(c[1],x+10,yy+18,{width:cardW-20});
    doc.font('Helvetica').fontSize(6.9).fillColor('#52617a').text(wrapText(c[2],128),x+10,yy+31,{width:cardW-20,lineGap:0});
  });
}

function normalizeAnswers(answers){
  const list = Object.keys(answers||{}).map(k=>({id:Number(k), ...(answers[k]||{})})).filter(x=>x.id);
  list.sort((a,b)=>a.id-b.id);
  return list;
}

function drawInDepth(doc, answers, candidate, pageRef){
  addPage(doc,pageRef);
  const first=firstName(candidate);
  let y=54;
  sectionTitle(doc,'ISA in Depth',M,y);
  y=paragraph(doc,`These are ${first}'s item-by-item answers. They should be used for context when discussing category scores, strengths, and possible development areas.`,M,y+24,CONTENT_W,9.2)+12;

  const rows=normalizeAnswers(answers);
  const col=[36,342,74,40];
  const drawHead=()=>{
    doc.rect(M,y,col[0],22).fill('#0f172a');
    doc.rect(M+col[0],y,col[1],22).fill('#0f172a');
    doc.rect(M+col[0]+col[1],y,col[2],22).fill('#0f172a');
    doc.rect(M+col[0]+col[1]+col[2],y,col[3],22).fill('#0f172a');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white').text('No.',M+7,y+7,{width:24});
    doc.text('Question',M+col[0]+8,y+7,{width:col[1]-16});
    doc.text('Answer',M+col[0]+col[1]+8,y+7,{width:col[2]-16});
    doc.text('Group',M+col[0]+col[1]+col[2]+7,y+7,{width:col[3]-14});
    y+=22;
  };
  drawHead();
  rows.forEach((r,idx)=>{
    const q=safe(r.question);
    const qH=doc.heightOfString(q,{width:col[1]-16});
    const rowH=Math.max(24,qH+12);
    if(y+rowH>PAGE_H-44){ addPage(doc,pageRef); y=54; drawHead(); }
    doc.rect(M,y,CONTENT_W,rowH).fill(idx%2?'#ffffff':'#f8fafc');
    doc.strokeColor('#e7edf5').lineWidth(.5).moveTo(M+col[0],y).lineTo(M+col[0],y+rowH).stroke();
    doc.moveTo(M+col[0]+col[1],y).lineTo(M+col[0]+col[1],y+rowH).stroke();
    doc.moveTo(M+col[0]+col[1]+col[2],y).lineTo(M+col[0]+col[1]+col[2],y+rowH).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text(String(r.id),M+7,y+8,{width:24});
    doc.font('Helvetica').fontSize(7.4).fillColor('#334155').text(q,M+col[0]+8,y+7,{width:col[1]-16,lineGap:1});
    doc.font('Helvetica-Bold').fontSize(7.3).fillColor('#334155').text(safe(r.answer),M+col[0]+col[1]+8,y+8,{width:col[2]-16});
    doc.font('Helvetica-Bold').fontSize(7.3).fillColor('#334155').text(safe(r.group),M+col[0]+col[1]+col[2]+7,y+8,{width:col[3]-14,align:'center'});
    y+=rowH;
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode:405, body:'Method not allowed' };
  try {
    const data=JSON.parse(event.body||'{}');
    const candidate=data.candidate||{};
    const scores=data.scores||{};
    const answers=data.answers||{};
    const doc=new PDFDocument({size:'LETTER', margin:0});
    const chunks=[];
    doc.on('data', c=>chunks.push(c));
    const done=new Promise(resolve=>doc.on('end',resolve));
    const pageRef={page:1};

    drawFooter(doc,pageRef.page);
    drawHeader(doc,candidate,scores);
    drawScoreStrip(doc,scores,162);
    drawHowToRead(doc,256);
    addPage(doc,pageRef);
    drawComparison(doc,scores,candidate,54);
    drawSuggestions(doc,scores,candidate,248);
    drawInDepth(doc,answers,candidate,pageRef);

    doc.end();
    await done;
    const buffer=Buffer.concat(chunks);
    const name=escFile(`${safe(candidate.name||'candidate')}-ministry-readiness-report`);
    return {
      statusCode:200,
      headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name}.pdf"`},
      body:buffer.toString('base64'),
      isBase64Encoded:true
    };
  } catch(e) {
    return {statusCode:500, headers:{'Content-Type':'application/json'}, body:JSON.stringify({error:e.message||'Could not generate PDF'})};
  }
};
