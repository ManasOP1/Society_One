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
  const t = await c.query(
    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='visitor_passes') AS has_passes",
  );
  console.log('visitor_passes', t.rows[0]);
  await c.query('ALTER TABLE visitors ADD COLUMN IF NOT EXISTS pass_id uuid');
  await c.query("ALTER TABLE visitors ADD COLUMN IF NOT EXISTS category_code varchar(32) DEFAULT 'GUEST'");
  if (t.rows[0].has_passes) {
    await c.query(`
      DO $$ BEGIN
        ALTER TABLE visitors
          ADD CONSTRAINT visitors_pass_id_fkey
          FOREIGN KEY (pass_id) REFERENCES visitor_passes(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }
  const cols = await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='visitors' AND column_name IN ('pass_id','category_code') ORDER BY 1",
  );
  console.log('visitor cols', cols.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
