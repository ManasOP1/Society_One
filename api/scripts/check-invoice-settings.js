require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

function makePrisma() {
  const raw = process.env.DATABASE_URL;
  const connectionString = raw.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function main() {
  const { prisma, pool } = makePrisma();
  try {
    const societyId = '73f40846-8670-4209-8621-d398a850ca15';
    const settings = await prisma.societySettings.findUnique({ where: { societyId } });
    const invoice = await prisma.invoice.findFirst({
      where: { societyId, invoiceNo: 'GV-INV-2026-07-0001' },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    console.log('SETTINGS', {
      bhk1: settings?.maintenanceAmount1Bhk?.toString(),
      municipal: settings?.municipalDues?.toString(),
      admin: settings?.adminExpenses?.toString(),
      sinking: settings?.sinkingFunds?.toString(),
      building: settings?.buildingMaintenance?.toString(),
      parking: settings?.parkingCharges?.toString(),
    });
    console.log('INVOICE', {
      total: invoice?.totalAmount?.toString(),
      outstanding: invoice?.outstanding?.toString(),
      lines: invoice?.lines?.map((l) => ({ d: l.description, a: l.amount.toString() })),
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
