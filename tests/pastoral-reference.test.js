const assert = require('assert');
const {
  hashReferenceToken,
  participantStatus,
  validateRequest,
  validateResponse
} = require('../netlify/functions/_pastoral-reference');

const token = 'a-secure-reference-token';
assert.strictEqual(hashReferenceToken(token), hashReferenceToken(token), 'Token hashing should be deterministic.');
assert.notStrictEqual(hashReferenceToken(token), token, 'The raw token must not be stored.');

assert.deepStrictEqual(participantStatus(null), { status:'not_requested' });
const safeStatus = participantStatus({
  pastor_name:'Pastor Example', pastor_email:'pastor@example.org', submitted_at:'2026-08-06T12:00:00Z',
  response:{ concerns:'This must never reach the participant.' }
});
assert.strictEqual(safeStatus.status, 'received');
assert.strictEqual(Object.prototype.hasOwnProperty.call(safeStatus, 'response'), false, 'Participant status must exclude the private response.');

assert.deepStrictEqual(validateRequest({ pastor_name:' Pastor Example ', pastor_email:'PASTOR@EXAMPLE.ORG' }), {
  pastorName:'Pastor Example', pastorEmail:'pastor@example.org'
});
assert.throws(() => validateRequest({ pastor_name:'P', pastor_email:'bad' }), /pastor/i);

const response = validateResponse({
  relationship:'Senior pastor and direct supervisor', known_for:'Five years',
  spiritual_maturity:'5', character_integrity:'5', teachability:'4', relational_health:'4', leadership:'4', ministry_readiness:'4',
  strengths:'Demonstrates clear pastoral care and integrity.', growth_areas:'Continue developing delegation and team leadership.',
  recommendation:'recommend', may_contact:true
});
assert.strictEqual(response.ratings.spiritual_maturity, '5');
assert.strictEqual(response.recommendation, 'recommend');
assert.strictEqual(response.may_contact, true);
assert.throws(() => validateResponse({ recommendation:'recommend' }), /relationship/i);

console.log('Pastoral reference tests passed.');

