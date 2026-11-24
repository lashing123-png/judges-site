'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { UserError } from '@/lib/action';
import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES } from '@/lib/judgeImport';
import { judgeNameIndex, parseHistoryFile, relinkHistory, replaceHistory, summarize } from '@/lib/historyImport';

export type HistoryImportState = {
  ok: boolean;
  message: string;
  mode?: 'preview' | 'import' | 'relink';
  unlinked?: { name: string; rows: number }[];
};

export async function importHistory(_prev: HistoryImportState, fd: FormData): Promise<HistoryImportState> {
  try {
    const me = await assertAdmin();
    const mode = fd.get('mode');

    if (mode === 'relink') {
      const n = await relinkHistory();
      await audit(me.id, 'קישור היסטוריית שיפוט לשופטים', `${n} שורות קושרו`);
      revalidatePath('/admin');
      return { ok: true, mode: 'relink', message: n ? `${n} שורות היסטוריה קושרו לשופטים לפי שם.` : 'לא נמצאו שורות חדשות לקישור.' };
    }

    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) throw new UserError('יש לבחור קובץ');
    const name = file.name.toLowerCase();
    if (!IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))) throw new UserError(`סוג קובץ לא נתמך. אפשר: ${IMPORT_EXTENSIONS.join(', ')}`);
    if (file.size > IMPORT_MAX_BYTES) throw new UserError('הקובץ גדול מדי (עד 4MB)');

    let parsed;
    try {
      parsed = parseHistoryFile(Buffer.from(await file.arrayBuffer()), name.endsWith('.csv'));
    } catch (e: any) {
      if (e?.message === 'NO_HEADER') throw new UserError('לא נמצאו בקובץ העמודות "שם השופט", "תפקיד" ו"שם התחרות".');
      throw new UserError('לא ניתן לקרוא את הקובץ. ודאו שזה קובץ Excel או CSV תקין.');
    }
    if (parsed.records.length > 50_000) throw new UserError('יותר מדי שורות בקובץ (עד 50,000)');
    const match = await judgeNameIndex();
    const s = summarize(parsed.records, match);
    const desc =
      `${s.rows} שורות, ${s.competitions} תחרויות, עונות ${s.seasons[0] ?? '?'}–${s.seasons[s.seasons.length - 1] ?? '?'}. ` +
      `${s.linkedRows} שורות (${s.judges} שופטים) מקושרות לשופטים באתר; ${s.unlinked.length} שמות לא נמצאו באתר ויישמרו לפי שם בלבד.` +
      (parsed.skipped ? ` ${parsed.skipped} שורות ריקות דולגו.` : '');

    if (mode !== 'import') return { ok: true, mode: 'preview', message: `תצוגה מקדימה: ${desc} שום דבר עדיין לא נשמר.`, unlinked: s.unlinked };

    await replaceHistory(parsed.records, match);
    await audit(me.id, 'ייבוא היסטוריית שיפוט', `${file.name}: ${desc}`);
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { ok: true, mode: 'import', message: `הייבוא הושלם (ההיסטוריה הקודמת הוחלפה): ${desc}`, unlinked: s.unlinked };
  } catch (e: any) {
    if (e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: 'אירעה שגיאה בייבוא. שום דבר לא נשמר.' };
  }
}
