const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL;
console.log('URL present:', Boolean(url));
console.log('URL host snippet:', url ? url.replace(/:[^:@]+@/, ':****@').slice(0, 120) : 'missing');

// Prefer explicit pooler credentials (Session mode)
const p = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.twgbhmzxwwxcnkhckkup',
  password: 'ManasGadge0307',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const r = await p.query('select current_database() as d, current_user as u');
  console.log(r.rows[0]);
  const t = await p.query(
    "select tablename from pg_tables where schemaname = 'public' order by 1",
  );
  console.log('table_count', t.rows.length);
  console.log(t.rows.map((x) => x.tablename).join('\n') || '(none)');
  await p.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
