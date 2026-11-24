export type Session = { id: string; label: string; datetime?: string };

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

// סדר שופטים באתר: לפי א-ב של השם הפרטי, ואז שם משפחה
const nameCollator = new Intl.Collator('he', { sensitivity: 'base', numeric: true });
export const compareNames = (a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }) =>
  nameCollator.compare(a.firstName, b.firstName) || nameCollator.compare(a.lastName, b.lastName);
export const sortByName = <T extends { firstName: string; lastName: string }>(list: T[]) => [...list].sort(compareNames);
export const sortByJudgeName = <T extends { judge: { firstName: string; lastName: string } }>(list: T[]) =>
  [...list].sort((a, b) => compareNames(a.judge, b.judge));
export const USER_NAME_ORDER = [{ firstName: 'asc' as const }, { lastName: 'asc' as const }];

export const sessionsOf =(j: unknown): Session[] => (Array.isArray(j) ? (j as Session[]) : []);
export const newSessionId = () => 's_' + Math.random().toString(36).slice(2, 8);

// הרשמה בלי הצגות מסומנות = זמינות לכל התחרות (למשל תחרות מאתר האיגוד שעוד לא חולקה להצגות)
export const regCovers = (regSessions: string[], sessionId: string) => regSessions.length === 0 || regSessions.includes(sessionId);
export const regSessionsLabel = (regSessions: string[], sessions: Session[]) =>
  regSessions.length === 0
    ? 'כל התחרות'
    : regSessions.map((id) => sessions.find((s) => s.id === id)?.label).filter(Boolean).join(', ');

// ימי התחרות: מטווח התאריכים (endDate) או מההצגות (מזהה isr-YYYYMMDD או תאריך ההצגה)
export function competitionDays(comp: { date: Date; endDate?: Date | null; sessions: unknown }) {
  const days = new Set<string>([iso(comp.date)]);
  if (comp.endDate) days.add(iso(comp.endDate));
  for (const s of sessionsOf(comp.sessions)) {
    const m = s.id.match(/^isr-(\d{4})(\d{2})(\d{2})/);
    if (m) days.add(`${m[1]}-${m[2]}-${m[3]}`);
    else if (s.datetime && /^\d{4}-\d{2}-\d{2}/.test(s.datetime)) days.add(s.datetime.slice(0, 10));
  }
  return days.size;
}

// "יש צורך בלינה" רלוונטי רק לתחרות של יומיים ומעלה בוינגייט
export const lodgingOffered = (comp: { date: Date; endDate?: Date | null; sessions: unknown; location: string }) =>
  /וינגייט|wingate/i.test(comp.location) && competitionDays(comp) >= 2;

// התחרות כבר עברה (לפי יום, שעון ישראל): הרישום העצמי נסגר
export function competitionPassed(date: Date, now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
  return iso(date) < today;
}

export function seasonOf(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export function fmtDateTime(s?: string) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

// מונע קישורי javascript: וכד' בשדות URL שמוצגים כ-href
export function safeUrl(s: string) {
  const v = s.trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) throw new Error('קישור חייב להתחיל ב-http:// או https://');
  return v;
}
