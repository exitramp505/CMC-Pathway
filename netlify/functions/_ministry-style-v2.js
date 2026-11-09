const bank = require('../../ministry-style-v2-bank.js');
const STYLES = bank.STYLES;
const STYLE_NAMES = {pioneer:'Pioneer',mobilizer:'Mobilizer',shepherd:'Shepherd',steward:'Steward'};
function fail(message){const error=new Error(message);error.statusCode=400;throw error;}
function scoreMinistryStyleV2(input){
  const answers=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const known=new Set(bank.ITEMS.map(item=>item.id));
  if(Object.keys(answers).some(id=>!known.has(id)))fail('The inventory includes an unknown response.');
  const totals=Object.fromEntries(STYLES.map(s=>[s,{agreement:[],ease:[]}]));
  const contexts={};
  for(const item of bank.ITEMS){
    const value=Number(answers[item.id]);
    if(!Number.isInteger(value)||value<1||value>5)fail('Please answer every inventory statement before submitting.');
    const scored=item.reverse?6-value:value;
    totals[item.style][item.kind].push(scored);
    if(item.kind==='agreement'){
      const group=contexts[item.context]||(contexts[item.context]=Object.fromEntries(STYLES.map(style=>[style,{sum:0,count:0}])));
      group[item.style].sum+=scored;
      group[item.style].count++;
    }
  }
  const average=values=>Number((values.reduce((sum,n)=>sum+n,0)/values.length).toFixed(2));
  const index=value=>Math.round(((value-1)/4)*100);
  const agreement=Object.fromEntries(STYLES.map(s=>[s,index(average(totals[s].agreement))]));
  const ease=Object.fromEntries(STYLES.map(s=>[s,index(average(totals[s].ease))]));
  const ranked=STYLES.map(key=>({key,score:agreement[key],ease:ease[key]})).sort((a,b)=>b.score-a.score||STYLES.indexOf(a.key)-STYLES.indexOf(b.key));
  const [primary,secondary]=ranked;
  const domainPatterns=Object.entries(contexts).map(([name,expressions])=>({
    name,
    patterns:Object.fromEntries(STYLES.map(s=>[s,expressions[s].count?index(expressions[s].sum/expressions[s].count):null]))
  }));
  return {
    assessmentType:'ministry_style',assessmentTitle:'Ministry Style Inventory',instrumentVersion:2,
    scoringMethod:'original_cmc_v2_unvalidated_self_report',
    agreement,normalized:agreement,ease,ranked,domainPatterns,
    primaryStyle:primary.key,secondaryStyle:secondary.key,
    lowestStyle:ranked[ranked.length-1].key,
    primarySecondaryGap:primary.score-secondary.score,
    blendName:STYLE_NAMES[primary.key]+' + '+STYLE_NAMES[secondary.key],
    blendDescription:'',overall:primary.score,overallLabel:STYLE_NAMES[primary.key]+' + '+STYLE_NAMES[secondary.key],
    completedSets:bank.ITEMS.length
  };
}
module.exports={scoreMinistryStyleV2};
