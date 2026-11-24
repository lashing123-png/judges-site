import * as XLSX from 'xlsx';
import { prisma } from './prisma';
import { normalizeRole } from './constants';
import { decodeCsv } from './judgeImport';

// ייבוא היסטוריית שיפוט מגיליון "שופטי שחייה - תחרויות" (לשונית Database):
// עונה | שם התחרות | תאריך | מיקום | גילאים | אזורי/ארצי | שם השופט | תפקיד

export type HistoryRecord = {
  season: number | null;
  competition: string;
  date: Date | null;
  location: string;
  ages: string;
  level: string;
  judgeName: string;
  role: string;
};

const COLS = {
  season: ['עונה'],
  competition: ['שם התחרות', 'תחרות'],
  date: ['תאריך'],
  location: ['מיקום'],
  ages: ['גילאים'],
  level: ['אזורי/ארצי', 'רמה'],
  judgeName: ['שם השופט', 'שם השופטת', 'שופט'],
  role: ['תפקיד'],
} as const;

const clean = (v: unknown) => String(v ?? '').replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim();

// תאריך: Date מ-Excel, או טקסט dd/mm/yy, dd/mm/yyyy, או dd/mm בלי שנה (השנה נגזרת מהעונה: ספטמבר–אוגוסט)
export function parseHistoryDate(v: unknown, season: number | null): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), 12));
  const m = clean(v).match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : NaN;
  if (m[3] && m[3].length === 2) year += 2000;
  if (!m[3]) {
    if (!season) return null;
    year = month >= 9 ? season - 1 : season;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function parseHistoryFile(buf: Buffer, isCsv: boolean): { records: HistoryRecord[]; skipped: number } {
  const wb = isCsv ? XLSX.read(decodeCsv(buf), { type: 'string', raw: true }) : XLSX.read(buf, { type: 'buffer', cellDates: true });
  // הלשונית הראשונה שיש בה כותרות "שם השופט" ו"תפקיד" (בקובץ המלא זו לשונית Database)
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false });
    const headerIdx = grid.slice(0, 10).findIndex((r) => r.some((c) => COLS.judgeName.includes(clean(c) as never)) && r.some((c) => clean(c) === 'תפקיד'));
    if (headerIdx < 0) continue;
    const header = grid[headerIdx].map(clean);
    const col = (k: keyof typeof COLS) => header.findIndex((h) => (COLS[k] as readonly string[]).includes(h));
    const idx = Object.fromEntries((Object.keys(COLS) as (keyof typeof COLS)[]).map((k) => [k, col(k)])) as Record<keyof typeof COLS, number>;
    if (idx.competition < 0) continue;
    const get = (r: unknown[], k: keyof typeof COLS) => (idx[k] >= 0 ? r[idx[k]] : '');
    const records: HistoryRecord[] = [];
    let skipped = 0;
    for (const r of grid.slice(headerIdx + 1)) {
      const judgeName = clean(get(r, 'judgeName'));
      const competition = clean(get(r, 'competition'));
      const role = normalizeRole(clean(get(r, 'role')));
      if (!judgeName || !competition || !role) {
        skipped++;
        continue;
      }
      const season = parseInt(clean(get(r, 'season')), 10) || null;
      records.push({
        season,
        competition: competition.slice(0, 200),
        date: parseHistoryDate(get(r, 'date'), season),
        location: clean(get(r, 'location')).slice(0, 200),
        ages: clean(get(r, 'ages')).slice(0, 50),
        level: clean(get(r, 'level')).slice(0, 50),
        judgeName: judgeName.slice(0, 120),
        role: role.slice(0, 80),
      });
    }
    return { records, skipped };
  }
  throw new Error('NO_HEADER');
}

// השוואת שמות סלחנית: בלי גרש/גרשיים, מקף כרווח, יי->י ו-וו->ו (כתיב מלא/חסר)
export const nameKey = (s: string) =>
  clean(s)
    .replace(/[׳'’`״"]/g, '')
    .replace(/[-–־]/g, ' ')
    .replace(/יי/g, 'י')
    .replace(/וו/g, 'ו')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// מיפוי שם -> שופט/ת באתר (שם פרטי+משפחה בשני הסדרים). שם שמתאים ליותר משופט/ת אחד/ת לא מקושר.
export async function judgeNameIndex() {
  const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } });
  const map = new Map<string, string | null>();
  const add = (k: string, id: string) => map.set(k, map.has(k) && map.get(k) !== id ? null : id);
  for (const u of users) {
    add(nameKey(`${u.firstName} ${u.lastName}`), u.id);
    add(nameKey(`${u.lastName} ${u.firstName}`), u.id);
  }
  return (name: string) => map.get(nameKey(name)) ?? null;
}

export function summarize(records: HistoryRecord[], match: (n: string) => string | null) {
  const names = new Map<string, { rows: number; linked: boolean }>();
  for (const r of records) {
    const e = names.get(r.judgeName) ?? { rows: 0, linked: !!match(r.judgeName) };
    e.rows++;
    names.set(r.judgeName, e);
  }
  const linkedRows = records.filter((r) => match(r.judgeName)).length;
  const seasons = [...new Set(records.map((r) => r.season).filter(Boolean))].sort() as number[];
  return {
    rows: records.length,
    competitions: new Set(records.map((r) => `${r.competition}|${r.date?.toISOString() ?? r.season}`)).size,
    seasons,
    linkedRows,
    judges: [...names.values()].filter((v) => v.linked).length,
    unlinked: [...names.entries()].filter(([, v]) => !v.linked).sort((a, b) => b[1].rows - a[1].rows).map(([n, v]) => ({ name: n, rows: v.rows })),
  };
}

// מחליף את כל ההיסטוריה המיובאת בתוכן הקובץ (הגיליון הוא מקור האמת להיסטוריה)
export async function replaceHistory(records: HistoryRecord[], match: (n: string) => string | null) {
  const data = records.map((r) => ({ ...r, judgeId: match(r.judgeName) }));
  await prisma.$transaction(
    async (tx) => {
      await tx.judgingHistory.deleteMany({});
      for (let i = 0; i < data.length; i += 2000) await tx.judgingHistory.createMany({ data: data.slice(i, i + 2000) });
    },
    { timeout: 60_000 },
  );
}

// קישור מחדש של שורות היסטוריה לפי שם (למשל אחרי ייבוא שופטים חדשים או תיקון שם)
export async function relinkHistory() {
  const match = await judgeNameIndex();
  const unlinked = await prisma.judgingHistory.findMany({ where: { judgeId: null }, select: { judgeName: true }, distinct: ['judgeName'] });
  let linked = 0;
  for (const { judgeName } of unlinked) {
    const id = match(judgeName);
    if (id) linked += (await prisma.judgingHistory.updateMany({ where: { judgeId: null, judgeName }, data: { judgeId: id } })).count;
  }
  return linked;
}
