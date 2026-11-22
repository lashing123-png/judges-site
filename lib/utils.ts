export type Session = { id: string; label: string; datetime?: string };

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
export const sessionsOf = (j: unknown): Session[] => (Array.isArray(j) ? (j as Session[]) : []);
export const newSessionId = () => 's_' + Math.random().toString(36).slice(2, 8);

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
