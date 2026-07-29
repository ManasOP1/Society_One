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
  const tables = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%role%' OR table_name ILIKE '%user%'
    ORDER BY 1
  `);
  console.log('tables', tables.rows.map((r) => r.table_name));
  const users = await c.query(`
    SELECT email, is_active, society_id, id
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY created_at
    LIMIT 15
  `);
  console.log('users', users.rows);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
