const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers, body:'' };
  if (event.httpMethod !== 'GET') {
    return { statusCode:405, headers, body:JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error('Event feed is not configured.');
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth:{ persistSession:false, autoRefreshToken:false }
    });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('cmc_events')
      .select('id,title,summary,description,starts_at,ends_at,location_name,stage_key,region,public_url')
      .eq('status', 'published')
      .eq('public_listing', true)
      .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`)
      .order('starts_at', { ascending:true });
    if (error) throw error;

    const events = (data || []).map(item => ({
      id:item.id,
      title:item.title,
      summary:item.summary,
      description:item.description,
      startsAt:item.starts_at,
      endsAt:item.ends_at,
      location:item.location_name,
      stage:item.stage_key,
      region:item.region,
      publicUrl:item.public_url
    }));
    return { statusCode:200, headers, body:JSON.stringify({ ok:true, events }) };
  } catch (error) {
    console.error('Public event feed error:', error);
    return { statusCode:500, headers, body:JSON.stringify({ ok:false, error:'Could not load public events.' }) };
  }
};
