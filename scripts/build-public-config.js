#!/usr/bin/env node
'use strict';
// Only these two values are ever intentionally published. Never include the
// service-role key or other build environment variables in this file.
const fs = require('node:fs');
const path = require('node:path');

function buildPublicConfig(directory, env = process.env) {
  const destination = path.join(directory, 'cmc-public-config.json');
  const url = String(env.SUPABASE_URL || '').trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) {
    // A preview/local build without these two public values must never
    // accidentally ship configuration from an earlier build.
    fs.rmSync(destination, { force: true });
    return false;
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('SUPABASE_URL must be an HTTPS address without credentials.');
  }
  if (/\s/.test(anonKey)) throw new Error('SUPABASE_ANON_KEY must not contain whitespace.');
  fs.writeFileSync(destination, JSON.stringify({url, anonKey}) + '\n', {encoding:'utf8', mode:0o644});
  return true;
}
if (require.main === module) {
  const ok = buildPublicConfig(path.resolve(__dirname,'..'));
  console.log(ok
    ? 'Generated deployment-specific public Supabase configuration (values not logged).'
    : 'Public Supabase build values unavailable; retaining runtime function fallback.');
}
module.exports = { buildPublicConfig };
