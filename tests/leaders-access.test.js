const assert = require('node:assert/strict');
const { _test:{ resolveRoleChange } } = require('../netlify/functions/admin-leaders');

const admin = { id:'admin-1', account_role:'cmc_admin', region:'East' };
const eastLeader = { id:'leader-1', account_role:'regional_leader', region:'East' };
const eastParticipant = { id:'person-1', account_role:'participant', region:'East', archived_at:null };

function expectAccessError(fn, statusCode, pattern) {
  assert.throws(fn, error => error.statusCode === statusCode && pattern.test(error.message));
}

function run() {
  const promoted = resolveRoleChange({
    viewer:admin,
    target:eastParticipant,
    accountRole:'cmc_admin',
    region:''
  });
  assert.equal(promoted.account_role, 'cmc_admin');
  assert.equal('region' in promoted, false);

  const regional = resolveRoleChange({
    viewer:admin,
    target:eastParticipant,
    accountRole:'regional_leader',
    region:'Central'
  });
  assert.equal(regional.account_role, 'regional_leader');
  assert.equal(regional.region, 'Central');

  const demotedAdmin = resolveRoleChange({
    viewer:admin,
    target:{ id:'admin-2', account_role:'cmc_admin', region:'Pacific', archived_at:null },
    accountRole:'participant',
    region:''
  });
  assert.equal(demotedAdmin.account_role, 'participant');

  expectAccessError(
    () => resolveRoleChange({ viewer:eastLeader, target:eastParticipant, accountRole:'cmc_admin', region:'' }),
    403,
    /only a full administrator/i
  );
  expectAccessError(
    () => resolveRoleChange({ viewer:eastLeader, target:{ ...eastParticipant, region:'Central' }, accountRole:'regional_leader', region:'East' }),
    403,
    /own region/i
  );
  expectAccessError(
    () => resolveRoleChange({ viewer:admin, target:eastParticipant, accountRole:'regional_leader', region:'Unknown' }),
    400,
    /valid Open Bible region/i
  );
  expectAccessError(
    () => resolveRoleChange({ viewer:admin, target:{ ...admin, archived_at:null }, accountRole:'participant', region:'' }),
    400,
    /own administrator access/i
  );
  expectAccessError(
    () => resolveRoleChange({ viewer:admin, target:{ ...eastParticipant, archived_at:'2026-01-01' }, accountRole:'regional_leader', region:'East' }),
    400,
    /restore this person/i
  );

  console.log('Leadership access tests passed.');
}

run();
