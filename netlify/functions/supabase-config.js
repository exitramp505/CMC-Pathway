exports.handler = async () => {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-store' },
      body: JSON.stringify({
        ok: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.'
      })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type':'application/json',
      'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'
    },
    body: JSON.stringify({
      ok: true,
      url,
      anonKey
    })
  };
};
