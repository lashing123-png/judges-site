'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertUser } from '@/lib/authz';
import { run, UserError, type ActionResult } from '@/lib/action';
import { sessionsOf } from '@/lib/utils';

// רישום עצמי. ה-judgeId נלקח תמיד מהמשתמש/ת המחובר/ת, לעולם לא מהטופס.
export async function saveRegistration(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const competitionId = String(fd.get('competitionId') ?? '');
    const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new UserError('התחרות לא נמצאה');

    const valid = sessionsOf(comp.sessions).map((s) => s.id);
    const sessions = fd.getAll('sessions').map(String).filter((s) => valid.includes(s));
    if (!sessions.length) throw new UserError('יש לבחור לפחות הצגה אחת');
    const lodging = fd.get('lodging') === 'on';

    await prisma.registration.upsert({
      where: { competitionId_judgeId: { competitionId, judgeId: me.id } },
      update: { sessions, lodging },
      create: { competitionId, judgeId: me.id, sessions, lodging },
    });
    revalidatePath(`/competitions/${competitionId}`);
    return 'נשמר בהצלחה. ניתן לערוך שוב בכל שלב';
  });
}
