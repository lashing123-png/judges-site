'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { run, UserError, type ActionResult } from '@/lib/action';
import { safeUrl, newSessionId, type Session } from '@/lib/utils';
import { validatePositions } from '@/lib/poolLayout';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const uname = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const tempPassword = () => crypto.randomBytes(8).toString('base64url').slice(0, 10);

async function target(fd: FormData) {
  const u = await prisma.user.findUnique({ where: { id: str(fd, 'userId') } });
  if (!u) throw new UserError('המשתמש/ת לא נמצא/ה');
  return u;
}

/* ---------------- ניהול משתמשים ---------------- */

export async function approveUser(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const u = await target(fd);
    await prisma.user.update({ where: { id: u.id }, data: { status: 'ACTIVE' } });
    await audit(me.id, 'אישור הרשמה', uname(u));
    revalidatePath('/admin');
    return 'החשבון אושר';
  });
}

export async function rejectUser(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const u = await target(fd);
    if (u.status !== 'PENDING') throw new UserError('ניתן לדחות רק בקשות ממתינות');
    await prisma.user.delete({ where: { id: u.id } });
    await audit(me.id, 'דחיית הרשמה', `${uname(u)} (${u.email})`);
    revalidatePath('/admin');
    return 'הבקשה נדחתה';
  });
}

export async function createUser(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const email = str(fd, 'email').toLowerCase();
    const firstName = str(fd, 'firstName');
    const lastName = str(fd, 'lastName');
    if (!firstName || !lastName) throw new UserError('יש להזין שם פרטי ושם משפחה');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError('כתובת מייל לא תקינה');
    if (await prisma.user.findUnique({ where: { email } })) throw new UserError('כתובת המייל כבר רשומה');
    const pw = tempPassword();
    await prisma.user.create({
      data: { email, firstName, lastName, club: str(fd, 'club'), phone: str(fd, 'phone'), status: 'ACTIVE', passwordHash: await bcrypt.hash(pw, 12) },
    });
    await audit(me.id, 'יצירת חשבון', `${firstName} ${lastName}`);
    revalidatePath('/admin');
    return `החשבון נוצר. סיסמה זמנית (מוצגת פעם אחת, יש להעביר לשופט/ת): ${pw}`;
  });
}

export async function setAdmin(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const u = await target(fd);
    if (u.id === me.id) throw new UserError('לא ניתן לשנות את ההרשאה של עצמך');
    await prisma.user.update({ where: { id: u.id }, data: { isAdmin: !u.isAdmin } });
    await audit(me.id, u.isAdmin ? 'ביטול הרשאת אדמין' : 'מתן הרשאת אדמין', uname(u));
    revalidatePath('/admin');
    return u.isAdmin ? 'הרשאת האדמין בוטלה' : 'ניתנה הרשאת אדמין';
  });
}

export async function setStatus(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const u = await target(fd);
    if (u.id === me.id) throw new UserError('לא ניתן להשבית את עצמך');
    if (u.status === 'PENDING') throw new UserError('יש לאשר או לדחות בקשה ממתינה');
    const next = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await prisma.user.update({ where: { id: u.id }, data: { status: next } });
    await audit(me.id, next === 'DISABLED' ? 'השבתת חשבון' : 'הפעלת חשבון', uname(u));
    revalidatePath('/admin');
    return next === 'DISABLED' ? 'החשבון הושבת' : 'החשבון הופעל';
  });
}

export async function resetPassword(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const u = await target(fd);
    const pw = tempPassword();
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 12) } });
    await audit(me.id, 'איפוס סיסמה', uname(u));
    return `סיסמה זמנית (מוצגת פעם אחת): ${pw}`;
  });
}

/* ---------------- תחרויות ---------------- */

export async function saveCompetition(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const id = str(fd, 'id');
    const name = str(fd, 'name');
    const dateStr = str(fd, 'date');
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new UserError('יש להזין שם ותאריך תקין');

    let sessions: Session[] = [];
    try {
      const raw = JSON.parse(str(fd, 'sessions') || '[]');
      sessions = (Array.isArray(raw) ? raw : [])
        .filter((s: any) => s && typeof s.label === 'string' && s.label.trim())
        .map((s: any) => ({ id: typeof s.id === 'string' && s.id ? s.id : newSessionId(), label: s.label.trim(), datetime: typeof s.datetime === 'string' ? s.datetime : '' }));
    } catch {
      throw new UserError('רשימת ההצגות אינה תקינה');
    }

    let statuteUrl = '';
    try {
      statuteUrl = safeUrl(str(fd, 'statuteUrl'));
    } catch (e: any) {
      throw new UserError(e.message);
    }

    const layoutId = str(fd, 'poolLayoutId') || null;
    if (layoutId && !(await prisma.poolLayout.findUnique({ where: { id: layoutId } }))) throw new UserError('תבנית המפה לא נמצאה');

    const headIds = Array.from(new Set(fd.getAll('headJudges').map(String)));
    const validHeads = (await prisma.user.findMany({ where: { id: { in: headIds }, status: 'ACTIVE' }, select: { id: true } })).map((u) => u.id);

    const data = {
      number: str(fd, 'number'),
      name,
      date: new Date(dateStr + 'T00:00:00.000Z'),
      location: str(fd, 'location'),
      statuteUrl,
      announcement: String(fd.get('announcement') ?? '').trim(),
      sessions: sessions as any,
      poolLayoutId: layoutId,
    };

    const compId = await prisma.$transaction(async (tx) => {
      const c = id ? await tx.competition.update({ where: { id }, data }) : await tx.competition.create({ data });
      await tx.competitionHeadJudge.deleteMany({ where: { competitionId: c.id } });
      if (validHeads.length)
        await tx.competitionHeadJudge.createMany({ data: validHeads.map((judgeId) => ({ competitionId: c.id, judgeId, assignedById: me.id })) });
      return c.id;
    });
    await audit(me.id, id ? 'עריכת תחרות' : 'יצירת תחרות', name);
    revalidatePath('/admin/competitions');
    revalidatePath('/competitions');
    revalidatePath(`/competitions/${compId}`);
    return 'התחרות נשמרה';
  });
}

export async function deleteCompetition(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const c = await prisma.competition.findUnique({ where: { id: str(fd, 'id') } });
    if (!c) throw new UserError('התחרות לא נמצאה');
    await prisma.competition.delete({ where: { id: c.id } });
    await audit(me.id, 'מחיקת תחרות', c.name);
    revalidatePath('/admin/competitions');
    revalidatePath('/competitions');
    return 'התחרות נמחקה';
  });
}

/* ---------------- תבניות מפת בריכה ---------------- */

export async function saveLayout(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const id = str(fd, 'id');
    const name = str(fd, 'name');
    if (!name) throw new UserError('יש להזין שם לתבנית');
    const laneCount = Math.min(16, Math.max(2, parseInt(str(fd, 'laneCount'), 10) || 10));
    let positions;
    try {
      positions = validatePositions(JSON.parse(str(fd, 'positions')));
    } catch (e: any) {
      throw new UserError(e.message || 'ה-JSON של העמדות אינו תקין');
    }
    const isDefault = fd.get('isDefault') === 'on';
    const data = { name, laneCount, isDefault, positions: positions as any };
    const l = await prisma.$transaction(async (tx) => {
      const saved = id ? await tx.poolLayout.update({ where: { id }, data }) : await tx.poolLayout.create({ data });
      if (isDefault) await tx.poolLayout.updateMany({ where: { id: { not: saved.id } }, data: { isDefault: false } });
      return saved;
    });
    await audit(me.id, id ? 'עריכת תבנית מפה' : 'יצירת תבנית מפה', l.name);
    revalidatePath('/admin/layouts');
    return 'התבנית נשמרה';
  });
}

export async function deleteLayout(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const l = await prisma.poolLayout.findUnique({ where: { id: str(fd, 'id') } });
    if (!l) throw new UserError('התבנית לא נמצאה');
    const used = await prisma.competition.count({ where: { poolLayoutId: l.id } });
    if (used) throw new UserError('התבנית בשימוש בתחרויות. יש להחליף אותה בתחרויות קודם');
    await prisma.poolLayout.delete({ where: { id: l.id } });
    await audit(me.id, 'מחיקת תבנית מפה', l.name);
    revalidatePath('/admin/layouts');
    return 'התבנית נמחקה';
  });
}

export async function duplicateLayout(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const l = await prisma.poolLayout.findUnique({ where: { id: str(fd, 'id') } });
    if (!l) throw new UserError('התבנית לא נמצאה');
    await prisma.poolLayout.create({ data: { name: l.name + ' (עותק)', laneCount: l.laneCount, isDefault: false, positions: l.positions as any } });
    await audit(me.id, 'שכפול תבנית מפה', l.name);
    revalidatePath('/admin/layouts');
    return 'התבנית שוכפלה';
  });
}
