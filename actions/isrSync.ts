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
      (s.missingFromIsr ? ` ${s.missingFromIsr} תחרויות שסונכרנו בעבר כבר לא מופיעות באתר האיגוד (לא נמחקו).` : '') +
      (s.detailErrors ? ` ${s.detailErrors} עמודי פרטים לא נטענו, ינסו שוב בסנכרון הבא.` : '')
    );
  });
}
