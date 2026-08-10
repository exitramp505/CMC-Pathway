const crypto = require('crypto');
const { requireLeader, json, httpError } = require('./_auth');

// Base64 adds roughly one third to the request size. Four megabytes keeps the
// complete request below Netlify's synchronous function payload ceiling.
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/avif', 'avif']
]);

function matchesFileType(file, contentType) {
  if (contentType === 'image/jpeg') return file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  if (contentType === 'image/png') return file.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (contentType === 'image/webp') return file.subarray(0, 4).toString() === 'RIFF' && file.subarray(8, 12).toString() === 'WEBP';
  if (contentType === 'image/avif') return file.subarray(4, 12).toString().includes('ftypavif');
  return false;
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, viewer } = await requireLeader(event);
    if (viewer.account_role !== 'cmc_admin') throw httpError(403, 'National administrator access is required.');
    const body = JSON.parse(event.body || '{}');
    const contentType = String(body.content_type || '').toLowerCase();
    const extension = TYPES.get(contentType);
    if (!extension) throw httpError(400, 'Use a JPG, PNG, WebP, or AVIF image.');
    const encoded = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
    let file;
    try { file = Buffer.from(encoded, 'base64'); } catch { throw httpError(400, 'The image could not be read.'); }
    if (!file.length) throw httpError(400, 'Choose an image to upload.');
    if (file.length > MAX_BYTES) throw httpError(413, 'The image is larger than 4 MB. Please choose a smaller file.');
    if (!matchesFileType(file, contentType)) throw httpError(400, 'The selected file does not match its image type.');
    const path = `team/${Date.now()}-${crypto.randomBytes(10).toString('hex')}.${extension}`;
    const { error } = await supabase.storage.from('cmc-public-media').upload(path, file, { contentType, cacheControl:'31536000', upsert:false });
    if (error) throw error;
    const { data } = supabase.storage.from('cmc-public-media').getPublicUrl(path);
    return json(200, { ok:true, url:data.publicUrl, path });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not upload this image.' });
  }
};

exports._test = { matchesFileType };
