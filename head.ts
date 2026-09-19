'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertManage, assertUser } from '@/lib/authz';
import { run, UserError, type ActionResult } from '@/lib/action';
import { ROLE_OPTIONS } from '@/lib/constants';
import { sessionsOf } from '@/lib/utils';
import { layoutForCompetition } from '@/lib/layouts';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = (competitionId: string) => revalidatePath(`/head/${competitionId}`);

// כל הפעולות כאן דורשות: אדמין, או שופט/ת ראשי/ת של אותה תחרות (assertManage)

export async function addWalkIn(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const competitionId = str(fd, 'competitionId');
    const judgeId = str(fd, 'judgeId');
    await assertManage(competitionId);
    const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new UserError('התחרות לא נמצאה');
    const valid = sessionsOf(comp.sessions).map((s) => s.id);
    const sessions = fd.getAll('sessions').map(String).filter((s) => valid.includes(s));
    if (!judgeId || !sessions.length) throw new UserError('יש לבחור שופט/ת ולפחות הצגה אחת');
    const judge = await prisma.user.findFirst({ where: { id: judgeId, status: 'ACTIVE' } });
    if (!judge) throw new UserError('השופט/ת לא נמצא/ה');

    const ex = await prisma.registration.findUnique({ where: { competitionId_judgeId: { competitionId, judgeId } } });
    if (ex)
      await prisma.registration.update({
        where: { id: ex.id },
        data: { sessions: Array.from(new Set([...ex.sessions, ...sessions])), noShow: false },
      });
    else await prisma.registration.create({ data: { competitionId, judgeId, sessions, walkIn: true } });
    refresh(competitionId);
    return 'השופט/ת נוסף/ה לתחרות';
  });
}

export async function toggleNoShow(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const competitionId = str(fd, 'competitionId');
    const judgeId = str(fd, 'judgeId');
    await assertManage(competitionId);
    const reg = await prisma.registration.findUnique({ where: { competitionId_judgeId: { competitionId, judgeId } } });
    if (!reg) throw new UserError('ההרשמה לא נמצאה');
    await prisma.registration.update({ where: { id: reg.id }, data: { noShow: !reg.noShow } });
    refresh(competitionId);
    return reg.noShow ? 'סומן/ה כהגיע/ה' : 'סומן/ה כלא הגיע/ה';
  });
}

export async function deleteRegistration(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const competitionId = str(fd, 'competitionId');
    const judgeId = str(fd, 'judgeId');
    await assertManage(competitionId);
    await prisma.$transaction([
      prisma.assignment.deleteMany({ where: { competitionId, judgeId } }),
      prisma.registration.deleteMany({ where: { competitionId, judgeId } }),
    ]);
    refresh(competitionId);
    return 'ההרשמה נמחקה';
  });
}

export async function addNote(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const competitionId = str(fd, 'competitionId');
    const me = await assertManage(competitionId);
    const text = str(fd, 'text');
    if (!text) throw new UserError('יש להזין טקסט');
    if (text.length > 2000) throw new UserError('ההערה ארוכה מדי');
    await prisma.note.create({ data: { competitionId, authorId: me.id, text } });
    refresh(competitionId);
    return 'ההערה נוספה';
  });
}

export async function assignPosition(input: {
  competitionId: string;
  sessionId: string;
  positionId: string;
  judgeId: string | null;
  role: string;
}): Promise<ActionResult> {
  return run(async () => {
    const { competitionId, sessionId, positionId, judgeId, role } = input;
    await assertManage(competitionId);
    const me = await assertUser();
    const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new UserError('התחרות לא נמצאה');
    if (!sessionsOf(comp.sessions).some((s) => s.id === sessionId)) throw new UserError('ההצגה לא נמצאה');
    const layout = await layoutForCompetition(comp.poolLayoutId);
    const pos = layout?.positions.find((p) => p.id === positionId);
    if (!pos) throw new UserError('העמדה לא נמצאה');

    if (!judgeId) {
      await prisma.assignment.deleteMany({ where: { competitionId, sessionId, positionId } });
      refresh(competitionId);
      return 'העמדה פונתה';
    }
    if (!ROLE_OPTIONS.includes(role)) throw new UserError('תפקיד לא תקין');
    const reg = await prisma.registration.findUnique({ where: { competitionId_judgeId: { competitionId, judgeId } } });
    if (!reg || !reg.sessions.includes(sessionId) || reg.noShow) throw new UserError('השופט/ת אינו/ה רשום/ה ונוכח/ת בהצגה זו');

    await prisma.assignment.upsert({
      where: { competitionId_sessionId_positionId: { competitionId, sessionId, positionId } },
      update: { judgeId, role, positionLabel: pos.label, assignedById: me.id },
      create: { competitionId, sessionId, positionId, positionLabel: pos.label, role, judgeId, assignedById: me.id },
    });
    refresh(competitionId);
    return 'השיבוץ נשמר';
  });
}
