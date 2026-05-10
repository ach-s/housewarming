// Smoke test the Supabase RSVP setup using the credentials in data/config.json.
// Run: node scripts/smoke_test.mjs

import { readFileSync } from 'node:fs';

const { supabaseUrl: url, supabaseAnonKey: key } = JSON.parse(
  readFileSync(new URL('../data/config.json', import.meta.url), 'utf8')
);
if(!url || !key){ console.error('Missing supabaseUrl or supabaseAnonKey in data/config.json'); process.exit(1); }

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const sel = await fetch(`${url}/rest/v1/attendees?select=name&limit=1`, { headers });
console.log('SELECT', sel.status, sel.ok ? 'ok' : await sel.text());

const ins = await fetch(`${url}/rest/v1/attendees`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ name: `__smoke_test ${new Date().toISOString()}`, answer: 'yes' }),
});
console.log('INSERT', ins.status, ins.ok ? 'ok' : await ins.text());

if(!sel.ok || !ins.ok) process.exit(1);
console.log('OK - delete the __smoke_test row from the Supabase dashboard when done.');
