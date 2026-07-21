const { createPool } = require('./db-pool');

(async () => {
  const p = createPool();
  const tables = await p.query(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1
  `);
  const views = await p.query(`
    SELECT matviewname AS name, 'matview' AS kind FROM pg_matviews WHERE schemaname='public'
    UNION ALL
    SELECT viewname, 'view' FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%'
    ORDER BY 1
  `);
  const counts = await p.query(`
    SELECT 'tenants' t, count(*)::int c FROM tenants
    UNION ALL SELECT 'societies', count(*)::int FROM societies
    UNION ALL SELECT 'users', count(*)::int FROM users
    UNION ALL SELECT 'members', count(*)::int FROM members
    UNION ALL SELECT 'flats', count(*)::int FROM flats
    UNION ALL SELECT 'lk_role', count(*)::int FROM lk_role
    UNION ALL SELECT 'user_role_assignments', count(*)::int FROM user_role_assignments
  `);
  const rls = await p.query(`
    SELECT relname, relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND relkind='r' AND relrowsecurity
    ORDER BY 1
  `);
  const fns = await p.query(`
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app' ORDER BY 1
  `);

  console.log('TABLES', tables.rows.length);
  console.log(tables.rows.map((r) => r.tablename).join(', '));
  console.log('\nVIEWS/MATVIEWS');
  console.log(views.rows.map((r) => `${r.kind}:${r.name}`).join(', '));
  console.log('\nCOUNTS');
  console.table(counts.rows);
  console.log('\nRLS ENABLED', rls.rows.map((r) => r.relname).join(', '));
  console.log('\nAPP FUNCS', fns.rows.map((r) => r.proname).join(', '));
  await p.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
