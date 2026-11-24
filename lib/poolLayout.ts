export type Position = { id: string; label: string; defaultRole: string; x: number; y: number };

// גאומטריית הבריכה במערכת קואורדינטות של 1000x780 (כמו בפרוטוטייפ)
export const POOL = { x: 230, y: 90, w: 600, h: 460 };
export const laneY = (i: number, n: number) => Math.round((POOL.y + (POOL.h / n) * (i + 0.5)) * 10) / 10;

export function laneTimers(n: number): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < n; i++)
    out.push({ id: `timer-${i + 1}-a`, label: `מודד/ת זמנים - מסלול ${i + 1} (צד א׳)`, defaultRole: 'מודד/ת זמנים', x: 195, y: laneY(i, n) });
  for (let i = 0; i < n; i++)
    out.push({ id: `timer-${i + 1}-b`, label: `מודד/ת זמנים - מסלול ${i + 1} (צד ב׳)`, defaultRole: 'מודד/ת זמנים', x: 865, y: laneY(i, n) });
  return out;
}

// תבנית ברירת מחדל לפי מספר המסלולים (המיקומים אושרו בפרוטוטייפ של 10 מסלולים):
// - בכל בריכה: מודד/ת זמנים בשני צדי כל מסלול, שופט זמן ראשי ודירוג, מציב/ה, שופט/ת פניות ראשי/ת ורזרבה
// - 8 מסלולים ומעלה: 2 מזניקים, 2 שופטים ראשיים ו-4 שופטי סגנון (שניים בכל צד)
// - עד 7 מסלולים: מזניק/ה אחד/ת, שופט/ת ראשי/ת אחד/ת ו-2 שופטי סגנון (אחד בכל צד)
export function defaultPositions(n = 10): Position[] {
  const big = n >= 8;
  return [
    { id: 'starter-1', label: big ? 'מזניק/ה (1)' : 'מזניק/ה', defaultRole: 'מזניק/ה', x: 230, y: 640 },
    ...(big ? [{ id: 'starter-2', label: 'מזניק/ה (2)', defaultRole: 'מזניק/ה', x: 280, y: 640 }] : []),
    { id: 'referee-1', label: big ? 'שופט/ת ראשי/ת (1)' : 'שופט/ת ראשי/ת', defaultRole: 'שופט/ת ראשי/ת', x: big ? 330 : 280, y: 640 },
    ...(big ? [{ id: 'referee-2', label: 'שופט/ת ראשי/ת (2)', defaultRole: 'שופט/ת ראשי/ת', x: 380, y: 640 }] : []),
    { id: 'chief-timer', label: 'שופט זמן ראשי ודירוג', defaultRole: 'שופט זמן ראשי ודירוג', x: 230, y: 700 },
    { id: 'reserve', label: 'רזרבה', defaultRole: 'רזרבה', x: 330, y: 700 },
    { id: 'placing', label: 'מציב/ה', defaultRole: 'הצבות', x: 110, y: 60 },
    { id: 'chief-turn', label: 'שופט/ת פניות ראשי/ת', defaultRole: 'שופט/ת פניות ראשי', x: 925, y: 60 },
    ...laneTimers(n),
    ...(big
      ? [
          { id: 'stroke-1', label: 'שופט/ת סגנון - צד עליון א׳', defaultRole: 'סגנון', x: 400, y: 55 },
          { id: 'stroke-2', label: 'שופט/ת סגנון - צד עליון ב׳', defaultRole: 'סגנון', x: 680, y: 55 },
          { id: 'stroke-3', label: 'שופט/ת סגנון - צד תחתון א׳', defaultRole: 'סגנון', x: 400, y: 595 },
          { id: 'stroke-4', label: 'שופט/ת סגנון - צד תחתון ב׳', defaultRole: 'סגנון', x: 680, y: 595 },
        ]
      : [
          { id: 'stroke-1', label: 'שופט/ת סגנון - צד עליון', defaultRole: 'סגנון', x: 530, y: 55 },
          { id: 'stroke-3', label: 'שופט/ת סגנון - צד תחתון', defaultRole: 'סגנון', x: 530, y: 595 },
        ]),
  ];
}

export function validatePositions(a: unknown): Position[] {
  if (!Array.isArray(a)) throw new Error('צריך להיות מערך של עמדות');
  const ids = new Set<string>();
  a.forEach((p, i) => {
    if (!p || typeof p.id !== 'string' || !/^[A-Za-z0-9_\-.~:@+]+$/.test(p.id))
      throw new Error(`עמדה ${i + 1}: id חייב להיות באותיות לועזיות, ספרות או מקפים`);
    if (ids.has(p.id)) throw new Error(`id כפול: ${p.id}`);
    ids.add(p.id);
    if (typeof p.label !== 'string' || !p.label) throw new Error(`עמדה ${p.id}: חסר label`);
    if (typeof p.defaultRole !== 'string') throw new Error(`עמדה ${p.id}: חסר defaultRole`);
    if (typeof p.x !== 'number' || typeof p.y !== 'number') throw new Error(`עמדה ${p.id}: x ו-y חייבים להיות מספרים`);
  });
  return a as Position[];
}
