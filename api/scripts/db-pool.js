const { Pool } = require('pg');
const { URL } = require('url');
require('dotenv').config();

function createPool() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  return new Pool({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX) || 5,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS) || 30_000,
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT_MS) || 30_000,
  });
}

module.exports = { createPool };

if (require.main === module) {
  const p = createPool();
  p.query('select current_user as u, current_database() as d')
    .then(async (r) => {
      console.log(r.rows[0]);
      const t = await p.query(
        "select tablename from pg_tables where schemaname='public' order by 1",
      );
      console.log('tables', t.rows.length);
      console.log(t.rows.map((x) => x.tablename).join(', ') || '(none)');
      await p.end();
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
