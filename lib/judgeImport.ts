import * as XLSX from 'xlsx';

// קריאת קובץ שופטים (Excel / CSV) והתאמת עמודות לפי שם הכותרת, באנגלית או בעברית.

// Vercel מגביל גוף בקשה ל-4.5MB; next.config מעלה את מגבלת ה-Server Actions בהתאם
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 3000;
export const IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];

type Field = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'club' | 'since';

const ALIASES: Record<Field, string[]> = {
  firstName: ['first name', 'firstname', 'שם פרטי'],
  lastName: ['last name', 'lastname', 'surname', 'שם משפחה'],
  fullName: ['name', 'full name', 'שם', 'שם מלא'],
  email: ['email', 'e-mail', 'mail', 'מייל', 'אימייל', 'דוא"ל', 'דואל', 'דואר אלקטרוני', 'כתובת מייל'],
  phone: ['phone', 'mobile', 'cell', 'טלפון', 'נייד', 'מספר טלפון'],
  club: ['club', 'אגודה', 'מועדון', 'team name', 'team'],
  // רק עמודה שמוגדרת במפורש כוותק. ב"Initial approval date" של ייצוא האיגוד יש תאריכי אישור במערכת (2020 ואילך), לא תחילת ותק.
  since: ['ותק', 'תחילת ותק', 'seniority', 'seniority date'],
};

export const FIELD_LABELS: Record<Field, string> = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  fullName: 'שם מלא',
  email: 'מייל',
  phone: 'טלפון',
  club: 'אגודה',
  since: 'ותק',
};

export type ImportRow = {
  line: number; // מספר השורה בקובץ (כמו ב-Excel)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  club: string;
  seniorityYear: number | null;
  seniorityMonth: number | null;
};

export type ParsedFile = {
  sheet: string;
  columns: Partial<Record<Field, string>>; // שדה -> שם הכותרת שזוהתה בקובץ
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
};

const norm = (s: unknown) =>
  String(s ?? '')
    .replace(/[‎‏‪-‮]/g, '') // סימני כיווניות שמגיעים מייצוא
    .replace(/\s+/g, ' ')
    .trim();

function cellText(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return norm(v);
}

function phoneText(v: unknown): string {
  let s = cellText(v);
  // מספר שנשמר כמספר ב-Excel מאבד את ה-0 המוביל (למשל 501234567)
  if (/^[1-9]\d{7,8}$/.test(s)) s = '0' + s;
  return s;
}

// תאריך מתא: אובייקט Date, או טקסט בפורמט ישראלי dd/mm/yyyy (עם או בלי שעה), או yyyy-mm-dd.
function parseDate(v: unknown): { year: number; month: number } | null {
  if (v instanceof Date && !isNaN(v.getTime())) return { year: v.getFullYear(), month: v.getMonth() + 1 };
  const s = norm(v);
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && year > 1900) return { year, month };
  }
  m = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CSV: UTF-8 (עם או בלי BOM), ואם הבייטים אינם UTF-8 תקין, Windows-1255 (ברירת המחדל של Excel בעברית)
export function decodeCsv(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1255').decode(buf);
  }
}

export function parseJudgeFile(buf: Buffer, isCsv = false): ParsedFile {
  // ב-CSV מונעים מ-SheetJS לנחש תאריכים (הוא מניח פורמט אמריקאי m/d); התאריכים יפוענחו כטקסט dd/mm/yyyy
  const wb = isCsv
    ? XLSX.read(decodeCsv(buf), { type: 'string', dense: true, raw: true })
    : XLSX.read(buf, { type: 'buffer', cellDates: true, dense: true });
  const sheet = wb.SheetNames[0];
  if (!sheet) throw new Error('NO_SHEET');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: '', raw: true, blankrows: false });

  // שורת הכותרת: השורה הראשונה (מבין 10 הראשונות) שיש בה עמודת מייל
  const headerIdx = grid.slice(0, 10).findIndex((r) => r.some((c) => ALIASES.email.includes(norm(c).toLowerCase())));
  if (headerIdx < 0) throw new Error('NO_EMAIL_COLUMN');
  const header = grid[headerIdx].map((c) => norm(c).toLowerCase());

  const idx: Partial<Record<Field, number>> = {};
  const columns: ParsedFile['columns'] = {};
  // סדר השמות ב-ALIASES הוא סדר העדיפות (למשל "Club" לפני "Team name" שבייצוא האיגוד ריקה)
  (Object.keys(ALIASES) as Field[]).forEach((f) => {
    const alias = ALIASES[f].find((a) => header.includes(a));
    const i = alias === undefined ? -1 : header.indexOf(alias);
    if (i >= 0) {
      idx[f] = i;
      columns[f] = norm(grid[headerIdx][i]);
    }
  });

  const get = (r: unknown[], f: Field) => (idx[f] === undefined ? '' : r[idx[f]!]);
  const rows: ImportRow[] = [];
  const skipped: ParsedFile['skipped'] = [];
  const seen = new Set<string>();

  const body = grid.slice(headerIdx + 1);
  if (body.length > IMPORT_MAX_ROWS) throw new Error('TOO_MANY_ROWS');

  body.forEach((r, k) => {
    const line = headerIdx + k + 2;
    let firstName = cellText(get(r, 'firstName'));
    let lastName = cellText(get(r, 'lastName'));
    if ((!firstName || !lastName) && idx.fullName !== undefined) {
      const parts = cellText(get(r, 'fullName')).split(' ');
      if (!firstName) firstName = parts[0] ?? '';
      if (!lastName) lastName = parts.slice(1).join(' ');
    }
    const email = cellText(get(r, 'email')).toLowerCase();

    if (!email) return skipped.push({ line, reason: 'אין מייל' });
    if (!EMAIL_RE.test(email)) return skipped.push({ line, reason: 'מייל לא תקין' });
    if (!firstName || !lastName) return skipped.push({ line, reason: 'חסר שם פרטי או שם משפחה' });
    if (seen.has(email)) return skipped.push({ line, reason: 'מייל כפול בקובץ' });
    seen.add(email);

    const since = parseDate(get(r, 'since'));
    rows.push({
      line,
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      email,
      phone: phoneText(get(r, 'phone')).slice(0, 40),
      club: cellText(get(r, 'club')).slice(0, 120),
      seniorityYear: since?.year ?? null,
      seniorityMonth: since?.month ?? null,
    });
  });

  return { sheet, columns, rows, skipped };
}
