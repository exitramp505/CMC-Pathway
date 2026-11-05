// Google private iCal feed parser. No browser tokens, public endpoints, or third-party dependencies.
const DAY_NAMES={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
const pad=n=>String(n).padStart(2,'0');
const inUtc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const GOOGLE_UID=/@google\.com$/i;
function unfold(ics){
  const output=[];
  for(const line of String(ics).split(/\r?\n/)){
    if(/^[ \t]/.test(line)&&output.length)output[output.length-1]+=line.slice(1);
    else output.push(line);
  }
  return output;
}
function unescapeValue(v){
  return String(v||'').replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
}
function parseEntries(ics){
  const entries=[];let current=null;
  for(const line of unfold(ics)){
    if(line==='BEGIN:VEVENT'){current={};continue;}
    if(line==='END:VEVENT'){if(current)entries.push(current);current=null;continue;}
    if(!current)continue;
    const colon=line.indexOf(':');
    if(colon<1)continue;
    const left=line.slice(0,colon), value=line.slice(colon+1);
    const key=left.split(';')[0].toUpperCase();
    if(!current[key])current[key]=[];
    current[key].push({params:left.slice(key.length),value});
  }
  return entries;
}
const first=(entry,key)=>entry[key]?.[0]||null;
function getLocalParts(date,timezone){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hourCycle:'h23',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    .formatToParts(new Date(date));
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function zonedDate(year,month,day,hour,minute,second,timezone){
  const target=Date.UTC(year,month-1,day,hour,minute,second);
  if(!timezone||timezone.toUpperCase()==='UTC')return new Date(target);
  let candidate=target;
  for(let i=0;i<4;i++){
    const p=getLocalParts(candidate,timezone);
    const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const difference=target-represented;
    if(!difference)break;
    candidate+=difference;
  }
  return new Date(candidate);
}
function parseStamp(field,fallbackTimezone){
  if(!field)return null;
  const m=String(field.value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if(!m)return null;
  const tz=field.params.match(/(?:^|;)TZID=([^;]+)/i)?.[1]?.replace(/^"|"$/g,'')||fallbackTimezone||'UTC';
  const parts=[+m[1],+m[2],+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0)];
  const d=m[7]?new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5])):zonedDate(...parts,tz);
  return Number.isNaN(d.getTime())?null:d;
}
function nthWeekday(year,month,weekday,nth){
  if(nth>0){
    const firstDay=new Date(Date.UTC(year,month-1,1)).getUTCDay();
    const day=1+(weekday-firstDay+7)%7+(nth-1)*7;
    return day<=new Date(Date.UTC(year,month,0)).getUTCDate()?day:null;
  }
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  const lastWeekday=new Date(Date.UTC(year,month-1,lastDay)).getUTCDay();
  const day=lastDay-(lastWeekday-weekday+7)%7+(nth+1)*7;
  return day>=1?day:null;
}
function ruleOptions(raw){
  return Object.fromEntries(String(raw||'').split(';').filter(Boolean).map(p=>{const i=p.indexOf('=');return[p.slice(0,i).toUpperCase(),p.slice(i+1)];}));
}
function expandStart(entry,from,to){
  const startField=first(entry,'DTSTART');
  const initial=parseStamp(startField);
  if(!initial)return [];
  const rule=first(entry,'RRULE')?.value;
  if(!rule)return initial>=from&&initial<=to?[initial]:[];
  const opts=ruleOptions(rule);
  const freq=opts.FREQ,interval=Math.max(1,Math.min(24,Number(opts.INTERVAL)||1));
  const count=Math.max(1,Math.min(500,Number(opts.COUNT)||500));
  const until=opts.UNTIL?parseStamp({value:opts.UNTIL,params:''}):null;
  const tz=startField.params.match(/(?:^|;)TZID=([^;]+)/i)?.[1]||'UTC';
  const local=getLocalParts(initial,tz);
  const series=[];
  const nthMatch=String(opts.BYDAY||'').match(/^(-?\d)(SU|MO|TU|WE|TH|FR|SA)$/);
  const byMonthDay=Number(opts.BYMONTHDAY)||local.day;
  const maxCandidates=500;
  for(let n=0;n<maxCandidates&&series.length<count;n++){
    let next=null;
    if(freq==='MONTHLY'){
      const monthIndex=local.month-1+n*interval;
      const y=local.year+Math.floor(monthIndex/12),m=monthIndex%12+1;
      const day=nthMatch?nthWeekday(y,m,DAY_NAMES[nthMatch[2]],Number(nthMatch[1])):byMonthDay;
      if(day&&day<=new Date(Date.UTC(y,m,0)).getUTCDate()){
        next=zonedDate(y,m,day,local.hour,local.minute,local.second,tz);
      }
    }else if(freq==='WEEKLY'){
      const base=new Date(Date.UTC(local.year,local.month-1,local.day+n*interval*7));
      next=zonedDate(base.getUTCFullYear(),base.getUTCMonth()+1,base.getUTCDate(),local.hour,local.minute,local.second,tz);
    }else if(freq==='DAILY'){
      const base=new Date(Date.UTC(local.year,local.month-1,local.day+n*interval));
      next=zonedDate(base.getUTCFullYear(),base.getUTCMonth()+1,base.getUTCDate(),local.hour,local.minute,local.second,tz);
    }else if(freq==='YEARLY'){
      next=zonedDate(local.year+n*interval,local.month,local.day,local.hour,local.minute,local.second,tz);
    }else{
      throw new Error('Unsupported Google Calendar recurrence: '+String(freq||'unknown').slice(0,20));
    }
    if(!next||next<initial)continue;
    if(until&&next>until)break;
    series.push(next);
    if(next>to)break;
  }
  return series.filter(d=>d>=from&&d<=to);
}
function parseGoogleIcal(text,calendarId,from=new Date(),to=new Date(Date.now()+400*86400000)){
  const groups=new Map();
  for(const entry of parseEntries(text)){
    const uid=first(entry,'UID')?.value?.replace(GOOGLE_UID,'');
    if(!uid)continue;
    if(!groups.has(uid))groups.set(uid,[]);
    groups.get(uid).push(entry);
  }
  const rows=[];
  for(const [uid,entries] of groups){
    const master=entries.find(e=>!first(e,'RECURRENCE-ID'));
    if(!master)continue;
    const firstStart=parseStamp(first(master,'DTSTART')),firstEnd=parseStamp(first(master,'DTEND'));
    if(!firstStart||!firstEnd||firstEnd<=firstStart)continue;
    const duration=firstEnd.getTime()-firstStart.getTime();
    const excluded=new Set((master.EXDATE||[]).flatMap(x=>x.value.split(',').map(raw=>parseStamp({...x,value:raw}))).filter(Boolean).map(inUtc));
    const starts=expandStart(master,from,to);
    const candidates=starts.filter(d=>!excluded.has(inUtc(d))).map(d=>({entry:master,start:d,idStart:d}));
    for(const override of entries.filter(e=>first(e,'RECURRENCE-ID'))){
      const old=parseStamp(first(override,'RECURRENCE-ID'),first(master,'DTSTART')?.params.match(/TZID=([^;]+)/)?.[1]);
      if(!old)continue;
      for(let i=candidates.length-1;i>=0;i--)if(inUtc(candidates[i].idStart)===inUtc(old))candidates.splice(i,1);
      const replacement=parseStamp(first(override,'DTSTART'));
      if(replacement&&replacement>=from&&replacement<=to&&first(override,'STATUS')?.value!=='CANCELLED'){
        candidates.push({entry:override,start:replacement,idStart:old});
      }
    }
    for(const {entry,start,idStart} of candidates){
      if(first(entry,'STATUS')?.value==='CANCELLED')continue;
      const end=new Date(start.getTime()+duration);
      const occurrenceId=uid+'_'+inUtc(idStart);
      const eventEid=Buffer.from(occurrenceId+' '+calendarId).toString('base64url');
      rows.push({
        calendar_id:calendarId,occurrence_id:occurrenceId,
        title:unescapeValue(first(entry,'SUMMARY')?.value||first(master,'SUMMARY')?.value||'CMC Leadership Event').slice(0,200),
        starts_at:start.toISOString(),ends_at:end.toISOString(),
        description:unescapeValue(first(entry,'DESCRIPTION')?.value||first(master,'DESCRIPTION')?.value||'').slice(0,12000),
        location:unescapeValue(first(entry,'LOCATION')?.value||first(master,'LOCATION')?.value||'').slice(0,2000),
        event_url:'https://calendar.google.com/calendar/event?eid='+encodeURIComponent(eventEid),
        status:'confirmed'
      });
    }
  }
  return rows.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,500);
}
module.exports={parseGoogleIcal,parseEntries,parseStamp,zonedDate,expandStart};
