import { prisma } from './prisma';

// כמה פעמים שפט/ה כל שופט/ת בכל תפקיד: שיבוצים באתר + היסטוריה מיובאת
export async function roleCountsByJudge() {
  const [assigned, history] = await Promise.all([
    prisma.assignment.groupBy({ by: ['judgeId', 'role'], _count: { _all: true } }),
    prisma.judgingHistory.groupBy({ by: ['judgeId', 'role'], where: { judgeId: { not: null } }, _count: { _all: true } }),
  ]);
  const out = new Map<string, Record<string, number>>();
  for (const g of [...assigned, ...history]) {
    if (!g.judgeId) continue;
    const m = out.get(g.judgeId) ?? {};
    m[g.role] = (m[g.role] ?? 0) + g._count._all;
    out.set(g.judgeId, m);
  }
  return out;
}
