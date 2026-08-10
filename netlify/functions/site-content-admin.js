const { requireLeader, json, httpError } = require('./_auth');

const KEYS = new Set(['team', 'resources', 'models', 'discern']);
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ITEMS = 100;

function text(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

function url(value) {
  const candidate = text(value, 2000);
  if (!candidate) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const parsed = new URL(candidate);
    if (['https:', 'http:'].includes(parsed.protocol)) return parsed.toString();
  } catch {}
  throw httpError(400, 'Links must use a website address beginning with https:// or a site path beginning with /.');
}

function imageUrl(value) {
  const candidate = url(value);
  if (candidate && !candidate.startsWith('/') && !candidate.startsWith('https://')) {
    throw httpError(400, 'Images must use a secure https:// address.');
  }
  return candidate;
}

function items(value) {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_ITEMS) throw httpError(400, `A website section can contain up to ${MAX_ITEMS} items.`);
  return value;
}

function percentage(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw httpError(400, 'The website content request is not valid JSON.');
  }
}

function normalize(key, raw) {
  if (key === 'team') return {
    team:items(raw.team).map(member => ({
      region:text(member.region, 120), name:text(member.name, 120), title:text(member.title, 160),
      image:imageUrl(member.image),
      imagePositionX:percentage(member.imagePositionX, 50),
      imagePositionY:percentage(member.imagePositionY, 30)
    }))
  };
  if (key === 'resources') return {
    heroEyebrow:text(raw.heroEyebrow, 120), heroTitle:text(raw.heroTitle, 240), heroDescription:text(raw.heroDescription),
    featuredTitle:text(raw.featuredTitle, 240), featuredDescription:text(raw.featuredDescription),
    resources:items(raw.resources).map(item => ({
      title:text(item.title, 240), category:text(item.category, 120), description:text(item.description),
      buttonText:text(item.buttonText, 120), buttonUrl:url(item.buttonUrl), featured:Boolean(item.featured)
    }))
  };
  if (key === 'models') return {
    models:items(raw.models).map(item => ({
      title:text(item.title, 240), movement:text(item.movement, 240), summary:text(item.summary),
      bestSuitedFor:text(item.bestSuitedFor), whatStrengthensIt:text(item.whatStrengthensIt)
    }))
  };
  return {
    heroEyebrow:text(raw.heroEyebrow, 120), heroTitle:text(raw.heroTitle, 240), heroDescription:text(raw.heroDescription),
    whatToExpectTitle:text(raw.whatToExpectTitle, 240), whatToExpectParagraphOne:text(raw.whatToExpectParagraphOne),
    whatToExpectParagraphTwo:text(raw.whatToExpectParagraphTwo), dates:text(raw.dates, 160),
    location:text(raw.location, 240), applicationUrl:url(raw.applicationUrl)
  };
}

exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, viewer } = await requireLeader(event);
    if (viewer.account_role !== 'cmc_admin') throw httpError(403, 'National administrator access is required.');
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('cmc_public_content').select('*').order('content_key');
      if (error) throw error;
      return json(200, { ok:true, content:data || [] });
    }
    if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) throw httpError(413, 'This website section is too large to save.');
    const body = parseBody(event);
    const key = String(body.content_key || '').trim();
    if (!KEYS.has(key)) throw httpError(400, 'Unknown website content section.');
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw httpError(400, 'Content must be a JSON object.');
    const cleanData = normalize(key, body.data);
    const publish = body.action === 'publish';
    const payload = {
      content_key:key,
      draft_data:cleanData,
      updated_at:new Date().toISOString(),
      updated_by:viewer.id
    };
    if (publish) {
      payload.published_data = cleanData;
      payload.published_at = new Date().toISOString();
      payload.published_by = viewer.id;
    }
    const { data, error } = await supabase.from('cmc_public_content').upsert(payload, { onConflict:'content_key' }).select('*').single();
    if (error) throw error;
    return json(200, { ok:true, item:data, published:publish });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not update website content.' });
  }
};

exports._test = { normalize, parseBody };
