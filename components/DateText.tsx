// תאריך לתצוגה: יום/חודש/שנה, משמאל לימין ובלי שבירת שורה. לתחרות של כמה ימים: טווח (22-24/12/2026).
const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(d: Date, end?: Date | null) {
  const s = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  if (!end || end.getTime() <= d.getTime()) return s;
  if (end.getUTCFullYear() === d.getUTCFullYear() && end.getUTCMonth() === d.getUTCMonth())
    return `${pad(d.getUTCDate())}-${s.replace(/^\d{2}/, pad(end.getUTCDate()))}`;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}-${pad(end.getUTCDate())}/${pad(end.getUTCMonth() + 1)}/${end.getUTCFullYear()}`;
}

export default function DateText({ date, end, className = 'jud-mono' }: { date: Date; end?: Date | null; className?: string }) {
  return (
    <span dir="ltr" className={className} style={{ whiteSpace: 'nowrap', unicodeBidi: 'isolate' }}>
      {fmtDate(date, end)}
    </span>
  );
}
