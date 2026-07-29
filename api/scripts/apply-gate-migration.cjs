const fs = require('fs');
const { Client } = require('pg');

function loadEnv() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

(async () => {
  loadEnv();
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('supabase/migrations/20260729140000_gate_qr_visitors.sql', 'utf8');
  await c.query(sql);
  console.log('gate migration OK');
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
