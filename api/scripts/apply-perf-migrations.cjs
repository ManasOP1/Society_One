/**
 * Probe + apply performance migrations on the SocietyOne DATABASE_URL.
 * Usage: node scripts/apply-perf-migrations.mjs
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function probe(client) {
  const { rows } = await client.query(`
    SELECT
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipts') AS has_receipts,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rpt_society_daily') AS has_rpt_daily,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rpt_society_monthly') AS has_rpt_monthly,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stg_member_import') AS has_stg,
      EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname='mv_dashboard_summary') AS has_mv_dashboard,
      EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname='mv_monthly_collection') AS has_mv_monthly,
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='refresh_reporting_matviews') AS has_refresh_fn,
      EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ix_receipts_society_created') AS has_hot_ix,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='pass_id') AS has_pass_id
  `);
  return rows[0];
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  // Pooler URLs often embed sslmode=require which conflicts with Node TLS.
  const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('=== BEFORE ===');
  const before = await probe(client);
  console.log(before);

  if (!before.has_receipts) {
    console.error('Wrong DB or schema missing core tables — aborting');
    await client.end();
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = [
    '20260729120000_hot_list_indexes.sql',
    '20260729130000_rpt_tables_and_staging.sql',
  ];

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`\nApplying ${file}...`);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (e) {
      console.error('FAILED:', e.message);
    }
  }

  // Matviews — require app schema + base tables
  const mvPath = path.join(migrationsDir, 'enterprise', '09_views_matviews.sql');
  if (fs.existsSync(mvPath)) {
    console.log('\nApplying enterprise/09_views_matviews.sql...');
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS app`);
      await client.query(fs.readFileSync(mvPath, 'utf8'));
      console.log('OK');
    } catch (e) {
      console.error('Matview apply FAILED (may need earlier enterprise deps):', e.message);
    }
  }

  console.log('\n=== AFTER ===');
  const after = await probe(client);
  console.log(after);

  // Smoke: try refresh + sample reads
  if (after.has_refresh_fn) {
    try {
      await client.query('SELECT app.refresh_reporting_matviews()');
      console.log('refresh_reporting_matviews: OK');
    } catch (e) {
      console.error('refresh failed:', e.message);
    }
  }

  if (after.has_mv_dashboard) {
    const { rows } = await client.query(
      'SELECT society_id, outstanding_total, pending_invoices FROM mv_dashboard_summary LIMIT 3',
    );
    console.log('mv_dashboard_summary sample:', rows);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
