// Responsive visual review of representative, unauthenticated page shells.
// Signed-in participant/leader/admin content still requires a manual QA pass.
// Executed in GitHub Actions with playwright-core and the runner's Chrome.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts/responsive-css');
fs.mkdirSync(output,{recursive:true});

const families=[
  'login.html','signup.html','profile.html','dashboard.html',
  'course.html','participant.html','leader.html',
  'course-builder.html','task-plan-builder.html','events.html',
  'application.html','website.html'
];
const sizes=[
  {name:'small-phone',width:320,height:760},
  {name:'phone',width:390,height:844},
  {name:'large-phone',width:430,height:932},
  {name:'tablet',width:820,height:1080},
  {name:'desktop',width:1440,height:900}
];
function chromePath(){
  const p=[
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
    '/usr/bin/chromium','/opt/google/chrome/chrome'
  ].find(file=>file&&fs.existsSync(file));
  if(!p)throw new Error('Chrome/Chromium was not found on the visual-test runner.');
  return p;
}
async function main(){
  const browser=await chromium.launch({
    executablePath:chromePath(),headless:true,args:['--no-sandbox']
  });
  const records=[];
  try{
    for(const size of sizes){
      const context=await browser.newContext({
        viewport:{width:size.width,height:size.height},
        javaScriptEnabled:false,reducedMotion:'reduce',colorScheme:'light'
      });
      await context.route('https://**',route=>route.abort());
      for(const filename of families){
        const page=await context.newPage();
        try{
          await page.goto('file://'+path.join(root,filename),{waitUntil:'load',timeout:20000});
          await page.screenshot({
            path:path.join(output,filename.replace('.html','')+'-'+size.name+'.png'),
            fullPage:true,animations:'disabled',timeout:20000
          });
          const metrics=await page.evaluate(()=>{
            const inputs=[...document.querySelectorAll('input:not([type=hidden]),textarea,select')];
            return {
              viewport:document.documentElement.clientWidth,
              pageWidth:document.documentElement.scrollWidth,
              bodyWidth:document.body.scrollWidth,
              inputsBelow16:inputs
                .filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<16)
                .length,
              visibleInputs:inputs.filter(el=>el.getClientRects().length).length
            };
          });
          const overflow=Math.max(metrics.pageWidth,metrics.bodyWidth)-metrics.viewport;
          records.push({page:filename,viewport:size.name,...metrics,
            overflowPx:Math.max(0,overflow)});
        }finally{
          await page.close();
        }
      }
      await context.close();
    }
  }finally{
    await browser.close();
  }
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(records,null,2)+'\n');
  const overflow=records.filter(row=>row.overflowPx>2);
  const tiny=records.filter(row=>row.inputsBelow16>0&&row.viewport!=='desktop');
  console.log('Captured '+records.length+' responsive screenshots across '+families.length+' page families.');
  console.log('Static shell overflow observations: '+overflow.length);
  for(const row of overflow.slice(0,30)){
    console.log('  REVIEW '+row.page+' / '+row.viewport+': '+row.overflowPx+'px overflow');
  }
  console.log('Static shell small input observations: '+tiny.length);
  for(const row of tiny.slice(0,20)){
    console.log('  REVIEW '+row.page+' / '+row.viewport+': '+row.inputsBelow16+' inputs below 16px');
  }
  console.log('Note: JavaScript-disabled shells are not a substitute for signed-in role QA.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
