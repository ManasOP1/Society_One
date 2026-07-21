/**
 * Applies production hardening migration (indexes + check constraints).
 * Idempotent — safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const { createPool } = require('./db-pool');

async function main() {
  const sqlPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20260720220000_production_hardening.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = createPool();
  try {
    console.log('Applying production hardening migration...');
    await pool.query(sql);
    console.log('OK — production hardening applied.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
