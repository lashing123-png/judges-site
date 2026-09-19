import { prisma } from './prisma';
import type { Position } from './poolLayout';

// התבנית של התחרות, ואם אין: תבנית ברירת המחדל, ואם אין: הראשונה שקיימת
export async function layoutForCompetition(poolLayoutId: string | null) {
  const l =
    (poolLayoutId ? await prisma.poolLayout.findUnique({ where: { id: poolLayoutId } }) : null) ??
    (await prisma.poolLayout.findFirst({ where: { isDefault: true } })) ??
    (await prisma.poolLayout.findFirst());
  return l ? { id: l.id, name: l.name, laneCount: l.laneCount, positions: l.positions as unknown as Position[] } : null;
}
