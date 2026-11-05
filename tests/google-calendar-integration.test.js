const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseGoogleIcal}=require('../netlify/functions/_calendar-ics');
const {loadCalendar,validatePrivateIcal}=require('../netlify/functions/_national-calendar-events');
const calendarId='team@group.calendar.google.com';
const ics=[
  'BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',
  'UID:cmc-recurrence@google.com',
  'SUMMARY:CMC National Leadership Meeting',
  'DESCRIPTION:Online\\nNotes: https://pathway.openbiblecmc.org/leadership-home.html#meetings',
  'LOCATION:https://zoom.us/j/123456789',
  'DTSTART;TZID=America/New_York:20261203T120000',
  'DTEND;TZID=America/New_York:20261203T130000',
  'RRULE:FREQ=MONTHLY;BYDAY=1TH;COUNT=6',
  'END:VEVENT','END:VCALENDAR'
].join('\r\n');
const parsed=parseGoogleIcal(ics,calendarId,new Date('2026-11-01T00:00:00Z'),new Date('2027-06-01T00:00:00Z'));
assert.equal(parsed.length,6);
assert.deepEqual(parsed.map(x=>x.starts_at),[
  '2026-12-03T17:00:00.000Z',
  '2027-01-07T17:00:00.000Z',
  '2027-02-04T17:00:00.000Z',
  '2027-03-04T17:00:00.000Z',
  '2027-04-01T16:00:00.000Z',
  '2027-05-06T16:00:00.000Z'
]);
assert.ok(parsed.every(x=>x.ends_at!==x.starts_at));
assert.ok(parsed[0].description.includes('Notes:'));
assert.ok(parsed[0].event_url.startsWith('https://calendar.google.com/'));
assert.equal(parseGoogleIcal(ics.replace('RRULE:FREQ=MONTHLY;BYDAY=1TH;COUNT=6','RRULE:FREQ=MONTHLY;BYDAY=1TH;COUNT=6\r\nEXDATE;TZID=America/New_York:20270204T120000'),calendarId,new Date('2026-11-01'),new Date('2027-06-01')).length,5);
const good='https://calendar.google.com/calendar/ical/team%40group.calendar.google.com/private-Abc123_77/basic.ics';
assert.equal(validatePrivateIcal(good,calendarId),true);
assert.equal(validatePrivateIcal(good,'someone-else@group.calendar.google.com'),false);
assert.equal(validatePrivateIcal('https://evil.example/calendar/ical/team%40group.calendar.google.com/private-Abc123_77/basic.ics',calendarId),false);
assert.equal(validatePrivateIcal('http://calendar.google.com/calendar/ical/team%40group.calendar.google.com/private-Abc123_77/basic.ics',calendarId),false);
const root=path.resolve(__dirname,'..');
for(const [script,page] of [['leadership-home.js','leadership-home.html'],['national-calendar.js','national-calendar.html'],['national-settings.js','national-settings.html']]){
  new vm.Script(fs.readFileSync(path.join(root,script),'utf8'));
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/calendar-settings\.css\?v=2/);
}
const dashboard=fs.readFileSync(path.join(root,'leadership-home.html'),'utf8');
for(const id of ['calendarSyncLabel','eventJoinLink','eventMeetingNotesLink'])assert.ok(dashboard.includes('id="'+id+'"'));
function query(data){
  return {select(){return this},eq(){return this},gte(){return this},order(){return this},limit(){return this},
    async maybeSingle(){return {data,error:null}},
    then(resolve,reject){return Promise.resolve({data:Array.isArray(data)?data:[],error:null}).then(resolve,reject)}};
}
const settings={calendar_id:calendarId,label:'Open Bible CMC Leadership',secret_ical_url:null};
const cache=[{...parsed[0],synced_at:'2026-11-05T20:00:00Z'}];
const supabase={from(name){if(name==='cmc_national_calendar_settings')return query(settings);
  if(name==='cmc_calendar_events_cache')return query(cache);
  throw Error('Unexpected table '+name);
}};
loadCalendar(supabase,{now:new Date('2026-11-05T20:30:00Z')}).then(x=>{
  assert.equal(x.calendar.calendar_id,calendarId);
  assert.equal(x.calendar.feed_enabled,false);
  assert.equal(x.events.length,1);
  assert.equal(x.events[0].source,'google_calendar');
  assert.equal(x.events[0].join_url,'https://zoom.us/j/123456789');
  assert.ok(!JSON.stringify(x).includes('secret_ical_url'));
  console.log('Private CMC calendar parsing, DST, cache, links, and security checks passed.');
}).catch(err=>{console.error(err);process.exitCode=1;});
