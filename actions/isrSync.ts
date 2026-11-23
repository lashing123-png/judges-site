'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/authz';
import { run, type ActionResult } from '@/lib/action';
import { syncIsrCompetitions } from '@/lib/isrSync';

// "סנכרון עכשיו" בעמוד ניהול התחרויות (אותו קוד כמו הסנכרון היומי)
export async function syncIsrNow(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertAdmin();
    const s = await syncIsrCompetitions(me.id);
    revalidatePath('/admin/competitions');
    revalidatePath('/competitions');
    return (
      `סנכרון עונה ${s.season} הושלם: נמצאו ${s.found} תחרויות שחייה, ${s.created} חדשות, ${s.updated} עודכנו, ${s.unchanged} ללא שינוי.` +
      (s.sessionsUpdated ? ` הצגות נוצרו או עודכנו ב-${s.sessionsUpdated} תחרויות.` : '') +
      (s.sessionsLocked ? ` ב-${s.sessionsLocked} תחרויות ההצגות באיגוד השתנו אבל כבר יש שיבוצים, ולכן לא שונו.` : '') +
      (s.missingFromIsr ? ` ${s.missingFromIsr} תחרויות שסונכרנו בעבר כבר לא מופיעות באתר האיגוד (לא נמחקו).` : '') +
      (s.ignored ? ` ${s.ignored} תחרויות מוסתרות מהסנכרון דולגו.` : '') +
      (s.detailErrors ? ` ${s.detailErrors} עמודי פרטים לא נטענו, ינסו שוב בסנכרון הבא.` : '')
    );
  });
}
