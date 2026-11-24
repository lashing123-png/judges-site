import type { Session } from './utils';

// הצגות לתחרויות מאתר האיגוד:
// 1. אם עמוד התחרות מקושר למערכת התוצאות (loglig) ויש בה שעות התחלה: הצגה לכל שעת התחלה (בוקר/ערב לכל יום)
// 2. אחרת, תחרות של כמה ימים: הצגת בוקר והצגת ערב לכל יום, לפי לשוניות הימים בעמוד האיגוד
// 3. אחרת (תחרות של יום אחד): בלי הצגות, הרישום הוא לכל התחרות
// מזהי ההצגות נגזרים מהתאריך/השעה (isr-YYYYMMDD או isr-YYYYMMDD-HHMM) כדי שיישארו יציבים בין סנכרונים.

export const LOGLIG_BASE = 'https://loglig.com:2053/';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAY = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'];

// לשוניות הימים בעמוד התחרות באיגוד: <a data-toggle="tab" href="#day-0">12/22/2026</a> (חודש/יום/שנה)
export function parseDayTabs(html: string): string[] {
  const days = [...html.matchAll(/<a[^>]*data-toggle="tab"[^>]*href="#day-\d+"[^>]*>\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*<\/a>/g)].map(
    (m) => `${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`,
  );
  return [...new Set(days)].sort();
}

export function parseLogligId(html: string): string | null {
  return html.match(/loglig\.com(?::\d+)?\/LeagueTable\/AthleticsDisciplines\/(\d+)/)?.[1] ?? null;
}

// שעות התחלה בתוכנית המשחים: התא שלפני "TotalParticipants" מכיל dd/mm/yyyy hh:mm:ss במשחה הראשון של כל הצגה
export function parseLogligStarts(html: string): string[] {
  const starts = [...html.matchAll(/<td>\s*(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::\d{2})?\s*<\/td>\s*<td id="TotalParticipants">/g)].map(
    (m) => `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}T${pad(Number(m[4]))}:${m[5]}`,
  );
  return [...new Set(starts)].sort();
}

export function parseLogligStatute(html: string): string {
  const id = html.match(/href="\/LeagueTable\/ShowLeagueDoc\/(\d+)"/)?.[1];
  return id ? `${LOGLIG_BASE}LeagueTable/ShowLeagueDoc/${id}` : '';
}

function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  return `${wd} ${pad(d)}/${pad(m)}`;
}

const partOfDay = (hour: number) => (hour < 12 ? 'בוקר' : hour < 16 ? 'צהריים' : 'ערב');

export function buildSessions(dayTabs: string[], allStarts: string[]): Session[] {
  // דף אחד במערכת התוצאות יכול לכלול כמה מחזורי ליגה: שומרים רק שעות בימי התחרות לפי אתר האיגוד
  const starts = dayTabs.length ? allStarts.filter((dt) => dayTabs.includes(dt.slice(0, 10))) : allStarts;
  if (starts.length >= 2) {
    return starts.map((dt) => {
      const [day, time] = dt.split('T');
      return { id: `isr-${day.replace(/-/g, '')}-${time.replace(':', '')}`, label: `${dayLabel(day)} ${partOfDay(Number(time.slice(0, 2)))} ${time}`, datetime: dt };
    });
  }
  // תחרות של כמה ימים בלי תוכנית משחים מפורסמת: בוקר וערב לכל יום. השעות במזהה (09:00/17:00) הן הערכה בלבד,
  // כדי שכשהאיגוד יפרסם שעות אמיתיות, ההרשמות יעברו להצגה הקרובה באותו יום.
  if (dayTabs.length >= 2)
    return dayTabs.flatMap((day) => {
      const d = day.replace(/-/g, '');
      return [
        { id: `isr-${d}-0900`, label: `${dayLabel(day)} בוקר`, datetime: '' },
        { id: `isr-${d}-1700`, label: `${dayLabel(day)} ערב`, datetime: '' },
      ];
    });
  return [];
}

// הצגות שהסנכרון מנהל: ריקות, או שכל המזהים שלהן נוצרו ע"י הסנכרון. הצגות שמנהל/ת הוסיף/ה ידנית לא נדרסות.
export const sessionsManagedBySync = (sessions: Session[]) => sessions.every((s) => s.id.startsWith('isr-'));

export const sameSessions = (a: Session[], b: Session[]) =>
  a.length === b.length && a.every((s, i) => s.id === b[i].id && s.label === b[i].label && (s.datetime ?? '') === (b[i].datetime ?? ''));

// כשההצגות משתנות (למשל מ"הצגה לכל יום" ל"בוקר/ערב" כשהאיגוד מפרסם שעות), מעבירים את ההרשמות:
// הרשמה ליום -> כל ההצגות באותו יום; הרשמה לשעה שהשתנתה -> ההצגה הקרובה ביותר באותו יום.
export function remapSessionIds(oldIds: string[], next: Session[]): string[] {
  const nextIds = new Set(next.map((s) => s.id));
  const out = new Set<string>();
  for (const id of oldIds) {
    if (nextIds.has(id)) {
      out.add(id);
      continue;
    }
    const m = id.match(/^isr-(\d{8})(?:-(\d{4}))?$/);
    if (!m) continue;
    const sameDay = next.filter((s) => s.id.startsWith(`isr-${m[1]}`));
    if (!m[2]) sameDay.forEach((s) => out.add(s.id));
    else if (sameDay.length) {
      const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2, 4));
      const target = mins(m[2]);
      const nearest = sameDay.reduce((best, s) => {
        const t = s.id.split('-')[2];
        const bt = best.id.split('-')[2];
        if (!t) return best;
        if (!bt) return s;
        return Math.abs(mins(t) - target) < Math.abs(mins(bt) - target) ? s : best;
      });
      out.add(nearest.id);
    }
  }
  return [...out];
}
