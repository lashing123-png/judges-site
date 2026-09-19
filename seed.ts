import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { defaultPositions } from '../lib/poolLayout';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) throw new Error('יש להגדיר ADMIN_EMAIL ו-ADMIN_PASSWORD (לפחות 8 תווים)');

  await prisma.user.upsert({
    where: { email },
    update: { isAdmin: true, status: 'ACTIVE' },
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: process.env.ADMIN_FIRST_NAME || 'מנהל/ת',
      lastName: process.env.ADMIN_LAST_NAME || 'מערכת',
      status: 'ACTIVE',
      isAdmin: true,
    },
  });

  if ((await prisma.poolLayout.count()) === 0) {
    await prisma.poolLayout.create({
      data: {
        name: 'בריכת 10 מסלולים (ברירת מחדל)',
        laneCount: 10,
        isDefault: true,
        positions: defaultPositions(10) as any,
      },
    });
  }
  console.log('Seed done. Admin:', email);
}

main().finally(() => prisma.$disconnect());
