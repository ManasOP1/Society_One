/**
 * Full enterprise DB build:
 * 1) extensions + lookups
 * 2) (caller runs prisma db push)
 * 3) checks, functions, triggers, views, indexes, RLS
 * 4) seed demo tenant
 */
const fs = require('fs');
const path = require('path');
const { createPool } = require('./db-pool');

const ENTERPRISE = path.join(__dirname, '..', 'supabase', 'migrations', 'enterprise');

async function runFile(client, name) {
  const sql = fs.readFileSync(path.join(ENTERPRISE, name), 'utf8');
  console.log(`\n=== ${name} ===`);
  await client.query(sql);
  console.log(`OK ${name}`);
}

async function runChecks(client) {
  console.log('\n=== check constraints ===');
  const checks = `
ALTER TABLE society_settings DROP CONSTRAINT IF EXISTS chk_settings_due_day;
ALTER TABLE society_settings ADD CONSTRAINT chk_settings_due_day CHECK (due_day BETWEEN 1 AND 28);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_amounts;
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_amounts CHECK (
  total_amount >= 0 AND paid_amount >= 0 AND outstanding >= 0 AND paid_amount <= total_amount + 0.01
);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_amount;
ALTER TABLE payments ADD CONSTRAINT chk_payment_amount CHECK (amount > 0);

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_line_amount;
ALTER TABLE invoice_lines ADD CONSTRAINT chk_line_amount CHECK (amount >= 0);

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS chk_receipt_amounts;
ALTER TABLE receipts ADD CONSTRAINT chk_receipt_amounts CHECK (amount >= 0 AND total_paid >= 0);
`;
  await client.query(checks);
  console.log('OK check constraints');
}

async function attachTriggers(client) {
  console.log('\n=== updated_at triggers ===');
  const tables = [
    'tenants', 'societies', 'users', 'wings', 'flats', 'members',
    'society_settings', 'charge_catalog', 'invoices', 'payments',
    'receipts', 'notices', 'society_events', 'visitors', 'complaints',
    'documents', 'expenses',
  ];
  for (const t of tables) {
    await client.query(`DROP TRIGGER IF EXISTS trg_${t}_updated ON ${t}`);
    await client.query(`
      CREATE TRIGGER trg_${t}_updated
      BEFORE UPDATE ON ${t}
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at()
    `);
  }
  await client.query(`DROP TRIGGER IF EXISTS trg_payments_status ON payments`);
  await client.query(`
    CREATE TRIGGER trg_payments_status
    AFTER UPDATE OF status_code ON payments
    FOR EACH ROW EXECUTE FUNCTION app.on_payment_status_update()
  `);
  await client.query(`DROP TRIGGER IF EXISTS trg_invoice_recalc ON invoices`);
  await client.query(`
    CREATE TRIGGER trg_invoice_recalc
    BEFORE UPDATE OF paid_amount, total_amount, arrears_subtotal, late_fee, previous_outstanding, advance ON invoices
    FOR EACH ROW EXECUTE FUNCTION app.recalc_invoice_totals()
  `);
  console.log('OK triggers');
}

async function ensureUpdatedAtDefaults(client) {
  const tables = [
    'tenants', 'societies', 'users', 'wings', 'flats', 'members',
    'society_settings', 'charge_catalog', 'number_sequences', 'invoices',
    'payments', 'receipts', 'notices', 'society_events', 'visitors',
    'complaints', 'documents', 'expenses',
  ];
  for (const t of tables) {
    await client.query(
      `ALTER TABLE ${t} ALTER COLUMN updated_at SET DEFAULT now()`,
    ).catch(() => {});
  }
}

async function seedDemo(client) {
  console.log('\n=== seed demo tenant/society ===');
  await ensureUpdatedAtDefaults(client);
  const bcrypt = require('bcryptjs');
  const adminHash = await bcrypt.hash('admin123', 12);
  const residentHash = await bcrypt.hash('resident123', 12);
  const superHash = await bcrypt.hash('superadmin123', 12);

  await client.query('BEGIN');
  try {
    const tenant = await client.query(
      `INSERT INTO tenants (id, name, slug, status_code, created_at, updated_at)
       VALUES (gen_random_uuid(), 'SocietyOne Demo Tenant', 'societyone-demo', 'ACTIVE', now(), now())
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
    );
    const tenantId = tenant.rows[0].id;

    const society = await client.query(
      `INSERT INTO societies (
         id, tenant_id, name, slug, address, registration_no, pan_number,
         total_flats, occupied_flats, status_code, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, 'Green Valley Residency', 'green-valley',
         'Baner Road, Pune 411045', 'MH/PUNE/HSG/1234', 'AABCG1234A',
         150, 128, 'ACTIVE', now(), now()
       )
       ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [tenantId],
    );
    const societyId = society.rows[0].id;

    await client.query(
      `INSERT INTO society_settings (
         id, tenant_id, society_id, logo_text, bank_name, bank_account, bank_ifsc, upi_id,
         invoice_prefix, receipt_prefix, maintenance_amount, municipal_dues, admin_expenses,
         sinking_funds, building_maintenance, parking_charges, late_fee_amount, due_day,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, 'GV', 'HDFC Bank', '50200012345678', 'HDFC0001234',
         'greenvalley@hdfcbank', 'GV-INV', 'GV-REC', 9984, 2500, 1800, 1200, 2800, 684, 500, 10,
         now(), now()
       )
       ON CONFLICT (society_id) DO NOTHING`,
      [tenantId, societyId],
    );

    const wing = await client.query(
      `INSERT INTO wings (id, tenant_id, society_id, code, name, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'A', 'Wing A', now(), now())
       ON CONFLICT (society_id, code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [tenantId, societyId],
    );
    const wingId = wing.rows[0].id;

    const flat = await client.query(
      `INSERT INTO flats (id, tenant_id, society_id, wing_id, flat_no, floor, is_occupied, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, '203', 2, true, now(), now())
       ON CONFLICT (society_id, wing_id, flat_no) DO UPDATE SET is_occupied = true, updated_at = now()
       RETURNING id`,
      [tenantId, societyId, wingId],
    );
    const flatId = flat.rows[0].id;

    let memberId;
    const existingMember = await client.query(
      `SELECT id FROM members WHERE society_id = $1 AND email = $2 LIMIT 1`,
      [societyId, 'rahul.patil@email.com'],
    );
    if (existingMember.rows[0]) {
      memberId = existingMember.rows[0].id;
    } else {
      const member = await client.query(
        `INSERT INTO members (id, tenant_id, society_id, owner_name, phone, email, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'Rahul Patil', '9876543210', 'rahul.patil@email.com', true, now(), now())
         RETURNING id`,
        [tenantId, societyId],
      );
      memberId = member.rows[0].id;
    }

    await client.query(
      `INSERT INTO member_flats (id, tenant_id, society_id, member_id, flat_id, relation, is_primary)
       SELECT gen_random_uuid(), $1, $2, $3, $4, 'OWNER', true
       WHERE NOT EXISTS (
         SELECT 1 FROM member_flats WHERE member_id = $3 AND flat_id = $4 AND deleted_at IS NULL
       )`,
      [tenantId, societyId, memberId, flatId],
    );

    const adminU = await client.query(
      `INSERT INTO users (id, tenant_id, society_id, email, password_hash, name, phone, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'admin@greenvalley.in', $3, 'Jonathan Smith', '9999999999', true, now(), now())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, society_id = EXCLUDED.society_id, updated_at = now()
       RETURNING id`,
      [tenantId, societyId, adminHash],
    );
    await client.query(
      `INSERT INTO user_role_assignments (id, tenant_id, society_id, user_id, role_code)
       SELECT gen_random_uuid(), $1, $2, $3, 'SOCIETY_ADMIN'
       WHERE NOT EXISTS (
         SELECT 1 FROM user_role_assignments WHERE user_id = $3 AND role_code = 'SOCIETY_ADMIN' AND society_id = $2 AND deleted_at IS NULL
       )`,
      [tenantId, societyId, adminU.rows[0].id],
    );

    const resUser = await client.query(
      `INSERT INTO users (id, tenant_id, society_id, member_id, email, password_hash, name, phone, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'rahul.patil@email.com', $4, 'Rahul Patil', '9876543210', true, now(), now())
       ON CONFLICT (email) DO UPDATE SET member_id = EXCLUDED.member_id, password_hash = EXCLUDED.password_hash, updated_at = now()
       RETURNING id`,
      [tenantId, societyId, memberId, residentHash],
    );
    await client.query(
      `INSERT INTO user_role_assignments (id, tenant_id, society_id, user_id, role_code)
       SELECT gen_random_uuid(), $1, $2, $3, 'RESIDENT'
       WHERE NOT EXISTS (
         SELECT 1 FROM user_role_assignments WHERE user_id = $3 AND role_code = 'RESIDENT' AND society_id = $2 AND deleted_at IS NULL
       )`,
      [tenantId, societyId, resUser.rows[0].id],
    );

    const superU = await client.query(
      `INSERT INTO users (id, tenant_id, society_id, email, password_hash, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, NULL, 'superadmin@societyone.app', $2, 'Platform Super Admin', true, now(), now())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
       RETURNING id`,
      [tenantId, superHash],
    );
    await client.query(
      `INSERT INTO user_role_assignments (id, tenant_id, society_id, user_id, role_code)
       SELECT gen_random_uuid(), $1, NULL, $2, 'SUPER_ADMIN'
       WHERE NOT EXISTS (
         SELECT 1 FROM user_role_assignments WHERE user_id = $2 AND role_code = 'SUPER_ADMIN' AND deleted_at IS NULL
       )`,
      [tenantId, superU.rows[0].id],
    );

    await client.query('COMMIT');
    console.log('OK seed', { tenantId, societyId, memberId });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function phaseSql(step) {
  const p = createPool();
  const client = await p.connect();
  try {
    if (step === 'pre') {
      await runFile(client, '01_extensions_types.sql');
      await runFile(client, '02_lookup_tables.sql');
    } else if (step === 'post') {
      await runChecks(client);
      await runFile(client, '06_partitioned_ledgers.sql');
      await runFile(client, '10_functions_triggers.sql');
      await attachTriggers(client);
      await runFile(client, '09_views_matviews.sql');
      const idx = fs
        .readFileSync(path.join(ENTERPRISE, '12_indexes.sql'), 'utf8')
        .replace(/CONCURRENTLY /gi, '');
      console.log('\n=== 12_indexes.sql ===');
      await client.query(idx);
      console.log('OK indexes');
      await runFile(client, '11_rls_policies.sql');
      await seedDemo(client);
    } else if (step === 'seed') {
      await seedDemo(client);
    }
  } finally {
    client.release();
    await p.end();
  }
}

const step = process.argv[2] || 'pre';
phaseSql(step).catch((e) => {
  console.error(e);
  process.exit(1);
});
