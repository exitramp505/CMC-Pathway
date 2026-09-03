const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const {REGIONS}=require('../netlify/functions/_coaching');

assert.deepEqual(REGIONS,['Central','East','Mountain Plains','Pacific','Southeast']);
const schema=root('supabase_coaching_schema.sql');
assert.match(schema,/add column if not exists is_coach boolean/);
assert.match(schema,/primary key \(coach_id, region\)/);
assert.match(schema,/unique index if not exists cmc_coach_assignments_one_active_participant_idx/);
assert.match(schema,/where ended_at is null/);
assert.match(schema,/revoke all on table public\.cmc_coach_assignments from anon, authenticated/);

const auth=root('auth.js');
assert.match(auth,/label:'Team'/);
assert.match(auth,/label:'My People'/);
assert.match(auth,/profile\?\.is_coach/);
const record=root('netlify/functions/participant-record.js');
assert.match(record,/coachMode && recordType !== 'assessment'/);
const progress=root('netlify/functions/task-plan-progress.js');
assert.match(progress,/activeCoachAssignment/);
assert.match(progress,/actor_role:coachAssignment\?'coach':'participant'/);
const plan=root('task-plan.js');
assert.match(plan,/const coachMode/);
assert.match(plan,/Coaching overview/);
const accessPage=root('manage-leaders.html');
const coachingPage=root('coaching.html');
for(const page of [accessPage,coachingPage]){
  assert.match(page,/cmcWebsiteTabs cmcTeamSectionTabs/);
  assert.doesNotMatch(page,/cmcLeaderScopeCard/);
  assert.ok(page.indexOf('cmcAdminPageHero')<page.indexOf('cmcTeamSectionTabs'));
}
assert.match(accessPage,/aria-current="page"[^>]*><span>01<\/span>Access/);
assert.match(coachingPage,/aria-current="page"[^>]*><span>02<\/span>Coaching/);
const styles=root('style.css');
assert.match(styles,/\.cmcTeamSectionTabs a\.active/);
console.log('Coaching integration tests passed.');
