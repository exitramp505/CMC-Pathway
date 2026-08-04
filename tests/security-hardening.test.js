const assert = require('node:assert/strict');
const {
  scoreCharacterAssessment,
  scoreIsaAssessment,
  scoreMinistryStyle
} = require('../netlify/functions/_assessment-scoring');
const { regionForState, canonicalRegion } = require('../netlify/functions/_regions');
const { _test:{ validateUploadMetadata } } = require('../netlify/functions/application-submit');

function expectValidation(fn, pattern) {
  assert.throws(fn, error => error.statusCode === 400 && pattern.test(error.message));
}

function run() {
  const characterAnswers = {};
  for (let section = 0; section < 15; section += 1) {
    if (section === 1) continue;
    for (let question = 0; question < 5; question += 1) characterAnswers[`q_${section}_${question}`] = 4;
  }
  const character = scoreCharacterAssessment(characterAnswers, 'No');
  assert.equal(character.overall, 4);
  assert.equal(character.results[1].label, 'N/A');
  expectValidation(
    () => scoreCharacterAssessment({ ...characterAnswers, q_0_0:99 }, 'No'),
    /complete every assessment question/i
  );

  const isaAnswers = {};
  for (let id = 1; id <= 85; id += 1) {
    isaAnswers[id] = { answer:id <= 42 ? 'Yes' : id <= 60 ? '16+' : 'Strongly Agree' };
  }
  const isa = scoreIsaAssessment(isaAnswers);
  assert.equal(isa.overall, 100);
  assert.equal(isa.categories.length, 4);

  const styleAnswers = {};
  for (let id = 1; id <= 48; id += 1) {
    styleAnswers[id] = {
      most:'pioneer',
      least:'steward',
      domain:'Church Multiplication'
    };
  }
  const style = scoreMinistryStyle(styleAnswers);
  assert.equal(style.primaryStyle, 'pioneer');
  assert.equal(style.completedSets, 48);

  assert.equal(regionForState('fl'), 'Southeast');
  assert.equal(canonicalRegion('South East'), 'Southeast');

  const photo = validateUploadMetadata({
    kind:'photo', path:'user-1/photo.jpg', fileName:'photo.jpg'
  }, 'user-1', { size:5 * 1024 * 1024, mimeType:'image/jpeg' });
  assert.equal(photo.mimeType, 'image/jpeg');
  expectValidation(
    () => validateUploadMetadata({ kind:'resume', path:'user-1/file.exe' }, 'user-1', { size:10, mimeType:'application/octet-stream' }),
    /PDF, DOC, or DOCX/i
  );
  expectValidation(
    () => validateUploadMetadata({ kind:'resume', path:'user-1/file.pdf' }, 'user-1', { size:16 * 1024 * 1024, mimeType:'application/pdf' }),
    /under 15 MB/i
  );
  expectValidation(
    () => validateUploadMetadata({ kind:'photo', path:'other/photo.jpg' }, 'user-1', { size:100, mimeType:'image/jpeg' }),
    /Invalid upload path/i
  );

  console.log('Security hardening tests passed.');
}

run();
