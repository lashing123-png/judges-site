'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { UserError } from '@/lib/action';
import { FIELD_LABELS, IMPORT_EXTENSIONS, IMPORT_MAX_BYTES, parseJudgeFile, type ImportRow } from '@/lib/judgeImport';

export type ImportPreviewRow = { line: number; name: string; email: string; action: 'new' | 'update' | 'same'; fields: string[] };

export type ImportState = {
  ok: boolean;
  message: string;
  mode?: 'preview' | 'import';
  columns?: string[]; // "שדה ← כותרת בקובץ"
  counts?: { new: number; update: number; same: number; skipped: number };
  rows?: ImportPreviewRow[];
  skipped?: { line: number; reason: string }[];
};

const FILL_FIELDS = ['phone', 'club', 'seniorityYear', 'seniorityMonth'] as const;
const FILL_LABELS: Record<(typeof FILL_FIELDS)[number], string> = {
  phone: 'טלפון',
  club: 'אגודה',
  seniorityYear: 'ותק',
  seniorityMonth: 'ותק',
};

// שופט/ת קיים/ת: ממלאים רק שדות ריקים, אף פעם לא דורסים מידע קיים.
function fillEmpty(row: ImportRow, existing: Record<string, unknown>) {
  const data: Record<string, string | number> = {};
  for (const f of FILL_FIELDS) {
    const incoming = row[f];
    const current = existing[f];
    const empty = current === null || current === undefined || current === '';
    if (empty && incoming !== null && incoming !== '') data[f] = incoming;
  }
  return data;
}

export async function importJudges(_prev: ImportState, fd: FormData): Promise<ImportState> {
  try {
    const me = await assertAdmin();
    const mode = fd.get('mode') === 'import' ? 'import' : 'preview';
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) throw new UserError('יש לבחור קובץ');
    const name = file.name.toLowerCase();
    if (!IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))) throw new UserError(`סוג קובץ לא נתמך. אפשר: ${IMPORT_EXTENSIONS.join(', ')}`);
    if (file.size > IMPORT_MAX_BYTES) throw new UserError('הקובץ גדול מדי (עד 4MB)');

    let parsed;
    try {
      parsed = parseJudgeFile(Buffer.from(await file.arrayBuffer()), name.endsWith('.csv'));
    } catch (e: any) {
      if (e?.message === 'NO_EMAIL_COLUMN') throw new UserError('לא נמצאה בקובץ עמודת מייל (Email / מייל). המייל משמש לזיהוי השופט/ת.');
      if (e?.message === 'TOO_MANY_ROWS') throw new UserError('יותר מדי שורות בקובץ (עד 3000)');
      throw new UserError('לא ניתן לקרוא את הקובץ. ודאו שזה קובץ Excel או CSV תקין.');
    }

    const existing = await prisma.user.findMany({
      where: { email: { in: parsed.rows.map((r) => r.email) } },
      select: { id: true, email: true, phone: true, club: true, seniorityYear: true, seniorityMonth: true },
    });
    const byEmail = new Map(existing.map((u) => [u.email, u]));

    const plan = parsed.rows.map((row) => {
      const u = byEmail.get(row.email);
      if (!u) return { row, action: 'new' as const, data: {} as Record<string, string | number>, userId: null as string | null };
      const data = fillEmpty(row, u);
      return { row, action: Object.keys(data).length ? ('update' as const) : ('same' as const), data, userId: u.id };
    });

    const counts = {
      new: plan.filter((p) => p.action === 'new').length,
      update: plan.filter((p) => p.action === 'update').length,
      same: plan.filter((p) => p.action === 'same').length,
      skipped: parsed.skipped.length,
    };
    const base: ImportState = {
      ok: true,
      message: '',
      mode,
      columns: Object.entries(parsed.columns).map(([f, h]) => `${FIELD_LABELS[f as keyof typeof FIELD_LABELS]} ← ${h}`),
      counts,
      rows: plan.map((p) => ({
        line: p.row.line,
        name: `${p.row.firstName} ${p.row.lastName}`,
        email: p.row.email,
        action: p.action,
        fields: Array.from(new Set(Object.keys(p.data).map((k) => FILL_LABELS[k as keyof typeof FILL_LABELS]))),
      })),
      skipped: parsed.skipped,
    };

    if (mode === 'preview') {
      return { ...base, message: `תצוגה מקדימה: ${counts.new} חדשים, ${counts.update} יעודכנו, ${counts.same} ללא שינוי, ${counts.skipped} דולגו. שום דבר עדיין לא נשמר.` };
    }

    // חשבונות חדשים נוצרים פעילים עם סיסמה אקראית שאף אחד לא יודע.
    // כדי לתת גישה לשופט/ת: "איפוס סיסמה" בעמוד הניהול.
    const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
    await prisma.$transaction(
      [
        prisma.user.createMany({
          data: plan
            .filter((p) => p.action === 'new')
            .map((p) => ({
              email: p.row.email,
              firstName: p.row.firstName,
              lastName: p.row.lastName,
              phone: p.row.phone,
              club: p.row.club,
              seniorityYear: p.row.seniorityYear,
              seniorityMonth: p.row.seniorityMonth,
              status: 'ACTIVE' as const,
              passwordHash: lockedHash,
            })),
          skipDuplicates: true,
        }),
        ...plan.filter((p) => p.action === 'update').map((p) => prisma.user.update({ where: { id: p.userId! }, data: p.data })),
      ],
    );

    await audit(me.id, 'ייבוא שופטים מקובץ', `${file.name}: ${counts.new} חדשים, ${counts.update} עודכנו, ${counts.skipped} דולגו`);
    revalidatePath('/admin');
    return { ...base, message: `הייבוא הושלם: נוספו ${counts.new} שופטים, עודכנו ${counts.update}, ${counts.same} ללא שינוי, ${counts.skipped} דולגו.` };
  } catch (e: any) {
    if (e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: 'אירעה שגיאה בייבוא. שום דבר לא נשמר.' };
  }
}
