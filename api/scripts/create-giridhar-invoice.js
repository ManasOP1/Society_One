require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const BHK_LABELS = { ONE_BHK: '1 BHK', TWO_BHK: '2 BHK', THREE_BHK: '3 BHK' };

function toNumber(v) {
  if (v == null) return 0;
  return Number(v.toString());
}

function defaultMaintenanceForBhk(settings, bhkType) {
  if (!bhkType) return undefined;
  if (bhkType === 'ONE_BHK') return toNumber(settings.maintenanceAmount1Bhk);
  if (bhkType === 'TWO_BHK') return toNumber(settings.maintenanceAmount2Bhk);
  if (bhkType === 'THREE_BHK') return toNumber(settings.maintenanceAmount3Bhk);
  return undefined;
}

function resolveFlatMaintenanceAmount(settings, flat) {
  if (flat?.maintenanceAmount != null) return toNumber(flat.maintenanceAmount);
  const bhkDefault = defaultMaintenanceForBhk(settings, flat?.bhkType);
  if (bhkDefault != null && bhkDefault > 0) return bhkDefault;
  return toNumber(settings.maintenanceAmount);
}

function buildMaintenanceItems(settings, flatMaintenanceAmount, bhkType) {
  const items = [];
  const push = (description, amount) => {
    const n = toNumber(amount);
    if (n > 0) items.push({ description, amount: n });
  };
  const bhkLabel = bhkType && BHK_LABELS[bhkType] ? BHK_LABELS[bhkType] : null;
  push(
    bhkLabel ? `Maintenance Charges (${bhkLabel})` : 'Maintenance Charges',
    flatMaintenanceAmount,
  );
  push('All Municipal Dues', settings.municipalDues);
  push('Administration and general Expenses', settings.adminExpenses);
  push('Sinking Funds', settings.sinkingFunds);
  push('Periodic Building Maintenance', settings.buildingMaintenance);
  push('Common Area Utilization / Parking', settings.parkingCharges);
  push('Non Occupancy Charges / Miscellaneous', settings.nonOccupancyCharges);
  return items;
}

function makePrisma() {
  const raw = process.env.DATABASE_URL;
  const connectionString = raw.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function main() {
  const { prisma, pool } = makePrisma();
  const month = '2026-07';
  const issueDate = new Date('2026-07-20T00:00:00.000Z');
  const dueDate = new Date('2026-07-19T00:00:00.000Z');

  try {
    const member = await prisma.member.findFirst({
      where: { deletedAt: null, ownerName: { contains: 'Giridhar', mode: 'insensitive' } },
      include: { society: true },
    });
    if (!member) throw new Error('Giridhar Gadge not found');

    const settings = await prisma.societySettings.findUnique({
      where: { societyId: member.societyId },
    });
    if (!settings) throw new Error('Settings not found');

    // Use A-702 — 1 BHK with ₹2 maintenance from your rules
    const flat = await prisma.flat.findFirst({
      where: {
        societyId: member.societyId,
        flatNo: '702',
        deletedAt: null,
        wing: { code: 'A' },
      },
      include: { wing: true },
    });
    if (!flat) throw new Error('Flat A-702 not found');

    await prisma.flat.update({
      where: { id: flat.id },
      data: {
        bhkType: 'ONE_BHK',
        maintenanceAmount: toNumber(settings.maintenanceAmount1Bhk),
      },
    });

    await prisma.memberFlat.updateMany({
      where: { memberId: member.id, deletedAt: null },
      data: { isPrimary: false },
    });

    const link = await prisma.memberFlat.findFirst({
      where: { memberId: member.id, flatId: flat.id, deletedAt: null },
    });
    if (link) {
      await prisma.memberFlat.update({ where: { id: link.id }, data: { isPrimary: true } });
    } else {
      await prisma.memberFlat.create({
        data: {
          tenantId: member.society.tenantId,
          societyId: member.societyId,
          memberId: member.id,
          flatId: flat.id,
          isPrimary: true,
        },
      });
    }

    const flatFresh = await prisma.flat.findUnique({
      where: { id: flat.id },
      include: { wing: true },
    });

    const flatMaintenance = resolveFlatMaintenanceAmount(settings, flatFresh);
    const maintenanceItems = buildMaintenanceItems(
      settings,
      flatMaintenance,
      flatFresh.bhkType,
    );
    const totalAmount = maintenanceItems.reduce((s, i) => s + i.amount, 0);
    const tenantId = member.society.tenantId;

    const existing = await prisma.invoice.findFirst({
      where: { societyId: member.societyId, memberId: member.id, billingMonth: month },
    });
    if (!existing) throw new Error('July invoice not found');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });
      return tx.invoice.update({
        where: { id: existing.id },
        data: {
          flatId: flat.id,
          issueDate,
          dueDate,
          deletedAt: null,
          statusCode: 'OVERDUE',
          maintenanceSubtotal: flatMaintenance,
          arrearsSubtotal: 0,
          lateFee: 0,
          previousOutstanding: 0,
          advance: 0,
          totalAmount,
          paidAmount: 0,
          outstanding: totalAmount,
          lines: {
            create: maintenanceItems.map((item, idx) => ({
              tenantId,
              societyId: member.societyId,
              lineNo: idx + 1,
              description: item.description,
              amount: item.amount,
              isDeduction: false,
            })),
          },
        },
      });
    });

    console.log(
      JSON.stringify(
        {
          invoiceNo: updated.invoiceNo,
          flat: `${flatFresh.wing.code}-${flatFresh.flatNo}`,
          bhk: flatFresh.bhkType,
          flatMaintenanceFromRules: toNumber(settings.maintenanceAmount1Bhk),
          totalAmount,
          breakdown: maintenanceItems,
          note: 'Total = 1 BHK maintenance + society-wide charges from Maintenance Rules',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
