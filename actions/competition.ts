'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertUser } from '@/lib/authz';
import { run, UserError, type ActionResult } from '@/lib/action';
import { competitionPassed, sessionsOf } from '@/lib/utils';

function refresh(competitionId: string) {
  revalidatePath(`/competitions/${competitionId}`);
  revalidatePath('/competitions');
  revalidatePath(`/head/${competitionId}`);
}

// רישום עצמי. ה-judgeId נלקח תמיד מהמשתמש/ת המחובר/ת, לעולם לא מהטופס.
export async function saveRegistration(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const competitionId = String(fd.get('competitionId') ?? '');
    const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new UserError('התחרות לא נמצאה');
    if (competitionPassed(comp.date)) throw new UserError('התחרות כבר התקיימה, הרישום סגור');

    const valid = sessionsOf(comp.sessions).map((s) => s.id);
    const sessions = fd.getAll('sessions').map(String).filter((s) => valid.includes(s));
    // תחרות בלי הצגות מוגדרות: רישום לכל התחרות (רשימת הצגות ריקה)
    if (valid.length && !sessions.length) throw new UserError('יש לבחור לפחות הצגה אחת');
    const lodging = fd.get('lodging') === 'on';

    await prisma.registration.upsert({
      where: { competitionId_judgeId: { competitionId, judgeId: me.id } },
      update: { sessions, lodging },
      create: { competitionId, judgeId: me.id, sessions, lodging },
    });
    refresh(competitionId);
    return 'נרשמת בהצלחה. ניתן לעדכן או לבטל בכל שלב עד יום התחרות';
  });
}

// ביטול רישום עצמי (גם השיבוצים של השופט/ת בתחרות הזו מתפנים)
export async function cancelRegistration(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const competitionId = String(fd.get('competitionId') ?? '');
    const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new UserError('התחרות לא נמצאה');
    if (competitionPassed(comp.date)) throw new UserError('התחרות כבר התקיימה, לא ניתן לבטל רישום');
    await prisma.$transaction([
      prisma.assignment.deleteMany({ where: { competitionId, judgeId: me.id } }),
      prisma.registration.deleteMany({ where: { competitionId, judgeId: me.id } }),
    ]);
    refresh(competitionId);
    return 'הרישום בוטל';
  });
}
