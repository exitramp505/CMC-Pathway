// Browser verification of actual safe reflection renderer plus served CMC CSS.
// Runs in the existing responsive-visual GitHub workflow with Chrome.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const codec=require('../lesson-content');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts/responsive-css');
const sizes=[
  {name:'small-phone',width:320,height:760},
  {name:'phone',width:390,height:844},
  {name:'large-phone',width:430,height:932},
  {name:'tablet',width:820,height:1080},
  {name:'desktop',width:1440,height:900}
];
function chromePath(){
  const found=[
    process.env.CHROME_PATH,'/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable','/usr/bin/chromium',
    '/opt/google/chrome/chrome'
  ].find(p=>p&&fs.existsSync(p));
  if(!found)throw Error('Chrome/Chromium is required for responsive reflection validation.');
  return found;
}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const prompt=[
    '**Before you begin:**',
    '',
    'Think about *the people* around you.',
    'Where might God be asking you to serve?',
    '',
    '**One practical next step:** Talk with your community this week.',
    '',
    'Long text must wrap on phones: '+('community'.repeat(14))
  ].join('\n');
  const rendered=codec.renderReflectionPrompt(prompt);
  const browser=await chromium.launch({
    executablePath:chromePath(),headless:true,args:['--no-sandbox']
  });
  const metrics=[];
  try{
    for(const size of sizes){
      const context=await browser.newContext({
        viewport:{width:size.width,height:size.height},
        javaScriptEnabled:false,reducedMotion:'reduce',colorScheme:'light'
      });
      await context.route('https://**',route=>route.abort());
      const page=await context.newPage();
      try{
        await page.goto('file://'+path.join(root,'course.html'),{waitUntil:'load',timeout:20000});
        await page.evaluate(safeHtml=>{
          const app=document.getElementById('courseApp');
          app.innerHTML=
            '<section class="cmcLessonWorkspace" style="grid-column:1/-1">'+
            '<article class="cmcLessonContent">'+
            '<header class="cmcLessonHeader"><h1 class="cmcLessonHeading">A Question Worth Considering</h1></header>'+
            '<div class="cmcLessonMain"><aside class="cmcReflection">'+
            '<p class="cmcEyebrow">REFLECT</p>'+
            '<div class="cmcReflectionPrompt">'+safeHtml+'</div>'+
            '<label class="cmcReflectionResponse"><span>Your response</span>'+
            '<textarea id="lessonResponse" rows="5">A saved answer remains.</textarea>'+
            '<small>Your response will be saved with your course progress.</small></label>'+
            '</aside></div></article></section>';
        },rendered);
        const result=await page.evaluate(()=>{
          const prompt=document.querySelector('.cmcReflectionPrompt');
          const strong=prompt.querySelector('strong');
          const em=prompt.querySelector('em');
          const answer=document.querySelector('#lessonResponse');
          const style=getComputedStyle(prompt);
          return {
            viewport:document.documentElement.clientWidth,
            scrollWidth:document.documentElement.scrollWidth,
            fontSize:parseFloat(style.fontSize),
            fontWeight:Number(style.fontWeight),
            whiteSpace:style.whiteSpace,
            strongWeight:Number(getComputedStyle(strong).fontWeight),
            italic:getComputedStyle(em).fontStyle,
            responseSize:parseFloat(getComputedStyle(answer).fontSize),
            responseValue:answer.value,
            left:prompt.getBoundingClientRect().left,
            right:prompt.getBoundingClientRect().right,
            lineBreaks:(prompt.textContent.match(/\n/g)||[]).length,
            text:prompt.textContent
          };
        });
        assert.equal(result.fontSize,16,size.name+': prompt should be body size');
        assert.equal(result.fontWeight,500,size.name+': prompt should not be a heading');
        assert.equal(result.whiteSpace,'pre-wrap',size.name+': preserve all authored blank lines');
        assert.ok(result.strongWeight>=700,size.name+': bold is selective');
        assert.equal(result.italic,'italic');
        assert.ok(result.responseSize>=16,size.name+': response field must not trigger iOS zoom');
        assert.equal(result.responseValue,'A saved answer remains.');
        assert.equal(result.lineBreaks,7,size.name+': all authored line breaks remain');
        assert.ok(result.text.includes('Before you begin:'));
        assert.ok(!result.text.includes('**'),size.name+': Markdown markers must not be visible');
        assert.ok(result.scrollWidth<=result.viewport+2,size.name+': horizontal document overflow');
        assert.ok(result.left>=-1&&result.right<=result.viewport+2,size.name+': prompt fits viewport');
        metrics.push({width:size.width,name:size.name,overflow:Math.max(0,result.scrollWidth-result.viewport),
          fontSize:result.fontSize,responseFontSize:result.responseSize,whiteSpace:result.whiteSpace});
        await page.screenshot({path:path.join(output,'course-reflection-'+size.name+'.png'),
          fullPage:true,animations:'disabled',timeout:20000});
      }finally{await page.close();await context.close();}
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(output,'reflection-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  console.log('Reflection rendering passes for 320/390/430/820/1440px; saved response, spacing and safe Markdown preserved.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
