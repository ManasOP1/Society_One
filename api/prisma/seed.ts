/**
 * Seed demo tenant/society/admin/resident for local development.
 * Mirrors scripts/build-enterprise-db.js seedDemo() but via Prisma Client.
 * Usage: npm run prisma:seed
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const adminHash = await bcrypt.hash('admin123', 12);
  const residentHash = await bcrypt.hash('resident123', 12);
  const superHash = await bcrypt.hash('superadmin123', 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'societyone-demo' },
    update: {},
    create: { name: 'SocietyOne Demo Tenant', slug: 'societyone-demo' },
  });

  const society = await prisma.society.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'green-valley' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Green Valley Residency',
      slug: 'green-valley',
      address: 'Baner Road, Pune 411045',
      totalFlats: 150,
      occupiedFlats: 128,
      registrationNo: 'MH/PUNE/HSG/1234',
      panNumber: 'AABCG1234A',
      wings: { create: [{ tenantId: tenant.id, code: 'A' }, { tenantId: tenant.id, code: 'B' }] },
      settings: {
        create: {
          tenantId: tenant.id,
          logoText: 'GV',
          bankName: 'HDFC Bank',
          bankAccount: '50200012345678',
          bankIfsc: 'HDFC0001234',
          upiId: 'greenvalley@hdfcbank',
          invoicePrefix: 'GV-INV',
          receiptPrefix: 'GV-REC',
          maintenanceAmount: 9984,
          municipalDues: 2500,
          adminExpenses: 1800,
          sinkingFunds: 1200,
          buildingMaintenance: 2800,
          parkingCharges: 684,
          lateFeeAmount: 500,
          dueDay: 10,
        },
      },
    },
    include: { wings: true },
  });

  const wingA =
    society.wings?.[0] ??
    (await prisma.wing.upsert({
      where: { societyId_code: { societyId: society.id, code: 'A' } },
      update: {},
      create: { tenantId: tenant.id, societyId: society.id, code: 'A' },
    }));

  const flat = await prisma.flat.upsert({
    where: { societyId_wingId_flatNo: { societyId: society.id, wingId: wingA.id, flatNo: '203' } },
    update: { isOccupied: true },
    create: {
      tenantId: tenant.id,
      societyId: society.id,
      wingId: wingA.id,
      flatNo: '203',
      floor: 2,
      parking: 'P-12',
      isOccupied: true,
    },
  });

  const member = await prisma.member.findFirst({
    where: { societyId: society.id, email: 'rahul.patil@email.com' },
  });
  const resolvedMember =
    member ??
    (await prisma.member.create({
      data: {
        tenantId: tenant.id,
        societyId: society.id,
        ownerName: 'Rahul Patil',
        phone: '9876543210',
        email: 'rahul.patil@email.com',
        isActive: true,
      },
    }));

  const existingLink = await prisma.memberFlat.findFirst({
    where: { memberId: resolvedMember.id, flatId: flat.id, deletedAt: null },
  });
  if (!existingLink) {
    await prisma.memberFlat.create({
      data: {
        tenantId: tenant.id,
        societyId: society.id,
        memberId: resolvedMember.id,
        flatId: flat.id,
        relation: 'OWNER',
        isPrimary: true,
      },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@greenvalley.in' },
    update: { passwordHash: adminHash, societyId: society.id },
    create: {
      tenantId: tenant.id,
      societyId: society.id,
      email: 'admin@greenvalley.in',
      passwordHash: adminHash,
      name: 'Jonathan Smith',
      phone: '9876500000',
    },
  });
  await ensureRole(admin.id, tenant.id, society.id, 'SOCIETY_ADMIN');

  const resident = await prisma.user.upsert({
    where: { email: 'rahul.patil@email.com' },
    update: { passwordHash: residentHash, memberId: resolvedMember.id, societyId: society.id },
    create: {
      tenantId: tenant.id,
      societyId: society.id,
      memberId: resolvedMember.id,
      email: 'rahul.patil@email.com',
      passwordHash: residentHash,
      name: 'Rahul Patil',
      phone: '9876543210',
    },
  });
  await ensureRole(resident.id, tenant.id, society.id, 'RESIDENT');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@societyone.app' },
    update: { passwordHash: superHash },
    create: {
      tenantId: tenant.id,
      email: 'superadmin@societyone.app',
      passwordHash: superHash,
      name: 'Platform Super Admin',
    },
  });
  await ensureRole(superAdmin.id, tenant.id, null, 'SUPER_ADMIN');

  // eslint-disable-next-line no-console
  console.log('Seed complete:', {
    society: society.slug,
    admin: 'admin@greenvalley.in / admin123',
    resident: 'rahul.patil@email.com / resident123',
    superAdmin: 'superadmin@societyone.app / superadmin123',
  });
}

async function ensureRole(
  userId: string,
  tenantId: string,
  societyId: string | null,
  roleCode: string,
) {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, roleCode, societyId, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.userRoleAssignment.create({
    data: { tenantId, societyId, userId, roleCode },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
