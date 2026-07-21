const { createPool } = require('./db-pool');

async function main() {
  const pool = createPool();
  try {
    const idx = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('invoices', 'members', 'payments', 'receipts', 'visitors', 'audit_logs')
      ORDER BY tablename, indexname
    `);
    console.log('indexes:', idx.rows.length);
    for (const r of idx.rows) console.log(`  ${r.tablename}.${r.indexname}`);

    const ext = await pool.query(`
      SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'citext', 'pg_trgm')
    `);
    console.log('extensions:', ext.rows.map((r) => r.extname).join(', ') || '(none)');

    const fn = await pool.query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
      ORDER BY 1
    `);
    console.log('app functions:', fn.rows.map((r) => r.proname).join(', ') || '(none)');

    const trg = await pool.query(`
      SELECT tgname, relname
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
      ORDER BY relname, tgname
    `);
    console.log('triggers:', trg.rows.length);
    for (const r of trg.rows) console.log(`  ${r.relname}.${r.tgname}`);

    const checks = await pool.query(`
      SELECT conname, conrelid::regclass::text AS tbl
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid::regclass::text IN ('invoices', 'payments', 'society_settings', 'invoice_lines', 'receipts')
      ORDER BY tbl, conname
    `);
    console.log('check constraints:', checks.rows.length);
    for (const r of checks.rows) console.log(`  ${r.tbl}.${r.conname}`);

    const rls = await pool.query(`
      SELECT relname FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      ORDER BY 1
    `);
    console.log('RLS tables:', rls.rows.length);

    const hardening = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('ix_member_flats_primary', 'ix_flats_society_wing', 'ix_users_email_active')
      ORDER BY 1
    `);
    console.log('production hardening indexes:', hardening.rows.map((r) => r.indexname).join(', ') || '(none)');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
