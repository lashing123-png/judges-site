import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { authOptions } from './auth';
import { prisma } from './prisma';
import { UserError } from './action';

/*
 * מודל ההרשאות (מקור האמת בשרת):
 *  - אדמין: User.isAdmin (גלובלי)
 *  - שופט/ת ראשי/ת: רק דרך טבלת CompetitionHeadJudge, ספציפי לתחרות
 *  - כל השאר: שופט/ת רגיל/ה
 * המשתמש/ת נטען/ת מהמסד בכל בקשה, כך שהשבתה או שינוי הרשאה נכנסים לתוקף מיד.
 */

export async function getCurrentUser(): Promise<User | null> {
  const s = await getServerSession(authOptions);
  const id = s?.user?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id } });
  return u && u.status === 'ACTIVE' ? u : null;
}

// לשימוש בעמודים: מפנה להתחברות אם אין משתמש/ת
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdminPage(): Promise<User> {
  const u = await requireUser();
  if (!u.isAdmin) redirect('/profile');
  return u;
}

// לשימוש ב-Server Actions ו-API: זורק שגיאה במקום להפנות
export async function assertUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new UserError('יש להתחבר מחדש');
  return u;
}

export async function assertAdmin(): Promise<User> {
  const u = await assertUser();
  if (!u.isAdmin) throw new UserError('אין הרשאה לפעולה זו');
  return u;
}

export async function isHeadOf(userId: string, competitionId: string) {
  const r = await prisma.competitionHeadJudge.findUnique({
    where: { competitionId_judgeId: { competitionId, judgeId: userId } },
  });
  return !!r;
}

export async function canManage(user: User, competitionId: string) {
  return user.isAdmin || (await isHeadOf(user.id, competitionId));
}

export async function assertManage(competitionId: string): Promise<User> {
  const u = await assertUser();
  if (!(await canManage(u, competitionId))) throw new UserError('אין הרשאה לפעולה זו');
  return u;
}

export async function managedCompetitionIds(user: User): Promise<string[]> {
  if (user.isAdmin) return (await prisma.competition.findMany({ select: { id: true } })).map((c) => c.id);
  return (await prisma.competitionHeadJudge.findMany({ where: { judgeId: user.id }, select: { competitionId: true } })).map(
    (r) => r.competitionId,
  );
}
