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
  const cols = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visitors'
    ORDER BY ordinal_position
  `);
  console.log(cols.rows);
  await c.query(`
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS entry_at timestamptz;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS exit_at timestamptz;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS category_code varchar(32) DEFAULT 'GUEST';
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS pass_id uuid;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS expected_time text;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS vehicle text;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS status_code varchar(32) DEFAULT 'LOGGED';
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS row_version int DEFAULT 1;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_by_id uuid;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_by_id uuid;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS deleted_by_id uuid;
  `);
  const after = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='visitors' AND column_name IN ('entry_at','exit_at','pass_id','category_code','status_code')
    ORDER BY 1
  `);
  console.log('patched', after.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
