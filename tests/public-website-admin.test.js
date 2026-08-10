const assert = require('node:assert/strict');
const { _test:{ normalize, parseBody } } = require('../netlify/functions/site-content-admin');
const { _test:{ matchesFileType } } = require('../netlify/functions/site-media-upload');

function run() {
  const team = normalize('team', {
    team:[{
      region:' East Region ',
      name:' George Williams ',
      title:' Director ',
      image:'https://example.com/george.jpg',
      imagePositionX:140,
      imagePositionY:-10
    }]
  });
  assert.deepEqual(team.team[0], {
    region:'East Region',
    name:'George Williams',
    title:'Director',
    image:'https://example.com/george.jpg',
    imagePositionX:100,
    imagePositionY:0
  });
  assert.throws(
    () => normalize('resources', { resources:[{ buttonUrl:'javascript:alert(1)' }] }),
    error => error.statusCode === 400 && /website address/i.test(error.message)
  );
  assert.throws(
    () => normalize('team', { team:[{ image:'http://example.com/photo.jpg' }] }),
    error => error.statusCode === 400 && /secure/i.test(error.message)
  );
  assert.throws(
    () => parseBody({ body:'{' }),
    error => error.statusCode === 400 && /valid JSON/i.test(error.message)
  );

  assert.equal(matchesFileType(Buffer.from([0xff,0xd8,0xff,0x00]), 'image/jpeg'), true);
  assert.equal(matchesFileType(Buffer.from('not-an-image'), 'image/jpeg'), false);
  assert.equal(matchesFileType(
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    'image/png'
  ), true);

  console.log('Public website administration tests passed.');
}

run();
