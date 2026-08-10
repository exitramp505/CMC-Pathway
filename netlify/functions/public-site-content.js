const { adminClient, json } = require('./_auth');

const KEYS = new Set(['team', 'resources', 'models', 'discern']);

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const key = String(event.queryStringParameters?.key || '').trim();
    if (key && key !== 'all' && !KEYS.has(key)) return json(400, { ok:false, error:'Unknown content section.' });
    const supabase = adminClient();
    if (!supabase) throw new Error('Content service is not configured.');
    let query = supabase.from('cmc_public_content').select('content_key,published_data,published_at');
    if (key && key !== 'all') query = query.eq('content_key', key);
    const { data, error } = await query;
    if (error) throw error;
    const content = Object.fromEntries((data || []).map(row => [row.content_key, row.published_data]));
    return {
      statusCode:200,
      headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60, s-maxage=300, stale-while-revalidate=86400','Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({ok:true, content})
    };
  } catch (error) {
    return json(500, { ok:false, error:'Published website content is temporarily unavailable.' });
  }
};
