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
    const members = await prisma.member.findMany({
      where: { deletedAt: null, ownerName: { contains: 'Giridhar', mode: 'insensitive' } },
      include: {
        memberFlats: { where: { deletedAt: null }, include: { flat: { include: { wing: true } } } },
        society: true,
      },
    });
    console.log(JSON.stringify(members.map(m => ({
      id: m.id,
      owner: m.ownerName,
      email: m.email,
      phone: m.phone,
      society: m.society.name,
      flats: m.memberFlats.map(mf => ({
        flatNo: mf.flat.flatNo,
        wing: mf.flat.wing.code,
        bhk: mf.flat.bhkType,
        maintenance: mf.flat.maintenanceAmount?.toString(),
        primary: mf.isPrimary,
      })),
    })), null, 2));

    const settings = await prisma.societySettings.findMany();
    console.log('settings', settings.map(s => ({ societyId: s.societyId, name: s.societyName, prefix: s.invoicePrefix })));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
