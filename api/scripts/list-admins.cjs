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
  const { rows } = await c.query(`
    SELECT u.email, u.is_active, ur.role_code, u.society_id
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.deleted_at IS NULL
    WHERE u.deleted_at IS NULL AND ur.role_code IN ('SOCIETY_ADMIN','SUPER_ADMIN')
    ORDER BY u.created_at
    LIMIT 10
  `);
  console.log(rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
