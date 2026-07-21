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
    const flats = await prisma.flat.findMany({
      where: { flatNo: { in: ['203', '702'] }, deletedAt: null },
      include: { wing: true, memberFlats: { where: { deletedAt: null }, include: { member: true } } },
    });
    console.log(JSON.stringify(flats.map(f => ({
      id: f.id,
      wing: f.wing.code,
      flatNo: f.flatNo,
      bhk: f.bhkType,
      maintenance: f.maintenanceAmount?.toString(),
      members: f.memberFlats.map(mf => mf.member.ownerName),
    })), null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
