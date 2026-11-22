import { prisma } from './prisma';
import { audit } from './audit';

// סנכרון תחרויות מאתר איגוד השחייה (isr.org.il): רק תחרויות עם לוגו "שחייה" (swim-olympic.png),
// בלי מים פתוחים, שחייה אמנותית או מאסטרס.

const BASE = 'https://isr.org.il/';
const UA = 'Mozilla/5.0 (compatible; swim-judges-site/1.0; daily competitions schedule sync)';
const SWIM_ICON = 'swim-olympic.png';

// עונה: ספטמבר–אוגוסט. באתר האיגוד העונה מסומנת בשנת הסיום (2026-27 = 2027)
export function currentSeasonYear(now = new Date()) {
  return now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// "9.10.2026", "30-31.7.2027", "30.9-2.10.2026" -> תאריך ההתחלה (12:00 UTC כדי שלא יזוז ביום בגלל אזור זמן)
export function parseIsrDate(s: string): Date | null {
  const [left, right] = s.includes('-') ? s.split('-', 2) : [s, s];
  const end = right.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!end) return null;
  const [, , em, ey] = end;
  const start = left.trim().match(/^(\d{1,2})(?:\.(\d{1,2}))?(?:\.(\d{4}))?$/);
  if (!start) return null;
  const day = Number(start[1]);
  const month = Number(start[2] ?? em);
  let year = Number(start[3] ?? ey);
  if (!start[3] && month > Number(em)) year -= 1; // טווח שחוצה שנה (דצמבר–ינואר)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

// שם בלי סיומת התאריך שהאיגוד מוסיף ("... - 09/10/2026")
const cleanName = (name: string) => name.replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/, '').trim();

export type IsrCompetition = { compId: number; name: string; date: Date; dateText: string };

export function parseCompetitionList(html: string): { swim: IsrCompetition[]; otherTypes: number } {
  const swim: IsrCompetition[] = [];
  let otherTypes = 0;
  for (const row of html.match(/<tr class="row">[\s\S]*?<\/tr>/g) ?? []) {
    const icon = row.match(/<td class="c-icon">[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1] ?? '';
    if (!icon.includes(SWIM_ICON)) {
      otherTypes++;
      continue;
    }
    const dateText = decode(row.match(/<td class="c-date">([\s\S]*?)<\/td>/)?.[1] ?? '');
    const link = row.match(/<td class="rr c-name">\s*<a[^>]*href="comp\.asp\?compID=(\d+)"[^>]*>([\s\S]*?)<\/a>/);
    const date = parseIsrDate(dateText);
    if (!link || !date) continue;
    swim.push({ compId: Number(link[1]), name: cleanName(decode(link[2].replace(/<[^>]+>/g, ''))), date, dateText });
  }
  return { swim, otherTypes };
}

export function parseCompetitionDetails(html: string): { location: string; fileUrl: string } {
  const location = decode(html.match(/<img[^>]*alt="מקום התחרות"[^>]*>\s*<br\s*\/?>([^<]*)</)?.[1] ?? '');
  const filesBlock = html.match(/<img[^>]*alt="קבצי מידע לתחרות"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
  const href = filesBlock.match(/href="([^"]+)"/)?.[1];
  let fileUrl = '';
  if (href) {
    try {
      const u = new URL(decode(href), BASE);
      if (u.protocol === 'https:' || u.protocol === 'http:') fileUrl = u.toString();
    } catch {
      /* קישור לא תקין: מדלגים */
    }
  }
  return { location: location.slice(0, 200), fileUrl };
}

async function get(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he' }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`isr.org.il ${r.status} for ${url}`);
  return r.text();
}

// מריץ משימות במקביל מוגבל, כדי לא להעמיס על אתר האיגוד
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export type SyncSummary = { season: string; found: number; created: number; updated: number; unchanged: number; missingFromIsr: number; detailErrors: number; skippedOtherTypes: number };

export async function syncIsrCompetitions(actorId: string | null = null, seasonYear = currentSeasonYear()): Promise<SyncSummary> {
  const listUrl = `${BASE}Competitions.ASP?cYear=${seasonYear}&cMonth=0&cType=0&cMode=0&isFinish=`;
  const { swim, otherTypes } = parseCompetitionList(await get(listUrl));
  if (swim.length === 0 && otherTypes === 0) throw new Error('לא נמצאו תחרויות בעמוד האיגוד (ייתכן שמבנה העמוד השתנה)');

  // פרטים (מקום וקובץ מידע) מכל עמוד תחרות
  let detailErrors = 0;
  const details = await pool(swim, 3, async (c) => {
    try {
      return parseCompetitionDetails(await get(`${BASE}comp.asp?compID=${c.compId}`));
    } catch (e) {
      detailErrors++;
      console.error('isr detail failed', c.compId, e);
      return null;
    }
  });

  const existing = await prisma.competition.findMany({ where: { isrCompId: { in: swim.map((c) => c.compId) } } });
  const byId = new Map(existing.map((c) => [c.isrCompId!, c]));
  let created = 0, updated = 0, unchanged = 0;

  for (let k = 0; k < swim.length; k++) {
    const c = swim[k];
    const d = details[k];
    const cur = byId.get(c.compId);
    if (!cur) {
      await prisma.competition.create({
        data: { isrCompId: c.compId, name: c.name, date: c.date, location: d?.location ?? '', statuteUrl: d?.fileUrl ?? '' },
      });
      created++;
      continue;
    }
    // האיגוד הוא מקור האמת לשם, תאריך, מקום וקובץ. הצגות, תבנית מפה, שופטים ראשיים ושיבוצים לא נוגעים.
    const data: Record<string, unknown> = {};
    if (cur.name !== c.name) data.name = c.name;
    if (cur.date.getTime() !== c.date.getTime()) data.date = c.date;
    if (d && d.location && cur.location !== d.location) data.location = d.location;
    if (d && d.fileUrl && cur.statuteUrl !== d.fileUrl) data.statuteUrl = d.fileUrl;
    if (Object.keys(data).length) {
      await prisma.competition.update({ where: { id: cur.id }, data });
      updated++;
    } else unchanged++;
  }

  // תחרויות שסונכרנו בעבר מאותה עונה ונעלמו מאתר האיגוד: לא מוחקים (ייתכן שיש הרשמות), רק מדווחים
  const seasonStart = new Date(Date.UTC(seasonYear - 1, 8, 1));
  const seasonEnd = new Date(Date.UTC(seasonYear, 8, 1));
  const missingFromIsr = await prisma.competition.count({
    where: { isrCompId: { not: null, notIn: swim.map((c) => c.compId) }, date: { gte: seasonStart, lt: seasonEnd } },
  });

  const summary: SyncSummary = {
    season: `${seasonYear - 1}-${String(seasonYear).slice(2)}`,
    found: swim.length,
    created,
    updated,
    unchanged,
    missingFromIsr,
    detailErrors,
    skippedOtherTypes: otherTypes,
  };
  await audit(
    actorId,
    'סנכרון תחרויות מאתר האיגוד',
    `עונה ${summary.season}: ${created} חדשות, ${updated} עודכנו, ${unchanged} ללא שינוי` +
      (missingFromIsr ? `, ${missingFromIsr} כבר לא מופיעות באתר האיגוד` : '') +
      (detailErrors ? `, ${detailErrors} עמודי פרטים נכשלו` : ''),
  );
  return summary;
}
