import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canManage } from '@/lib/authz';
import { fullName, regSessionsLabel, sessionsOf, sortByJudgeName } from '@/lib/utils';
import { fmtDate } from '@/components/DateText';

// דוח שופט ראשי לתחרות: סיכום, נוכחות, שיבוצים במפה לפי הצגה, והערות. אדמין או שופט/ת ראשי/ת של התחרות בלבד.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!(await canManage(user, params.id))) return new Response('Forbidden', { status: 403 });

  const comp = await prisma.competition.findUnique({ where: { id: params.id }, include: { headJudges: { include: { judge: true } } } });
  if (!comp) return new Response('Not found', { status: 404 });
  const sessions = sessionsOf(comp.sessions);
  const [regs, assigns, notes] = await Promise.all([
    prisma.registration.findMany({ where: { competitionId: comp.id }, include: { judge: true } }),
    prisma.assignment.findMany({ where: { competitionId: comp.id }, include: { judge: true } }),
    prisma.note.findMany({ where: { competitionId: comp.id }, include: { author: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const status = (r: (typeof regs)[number]) => (r.noShow ? 'לא הגיע/ה' : r.walkIn ? 'הצטרפ/ה במקום' : 'נרשם/ה מראש');

  const summary = [
    ['תחרות', comp.name],
    ['תאריך', fmtDate(comp.date, comp.endDate)],
    ['מיקום', comp.location],
    ['שופטים ראשיים', sortByJudgeName(comp.headJudges).map((h) => fullName(h.judge)).join(', ')],
    ['הצגות', sessions.length ? sessions.map((s) => s.label).join(', ') : 'כל התחרות'],
    ['שופטים רשומים', regs.length],
    ['הגיעו', regs.filter((r) => !r.noShow).length],
    ['לא הגיעו', regs.filter((r) => r.noShow).length],
    ['הצטרפו במקום', regs.filter((r) => r.walkIn).length],
    ['שיבוצים במפה', assigns.length],
    ['הופק', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })],
  ];
  const attendance = sortByJudgeName(regs).map((r) => ({
    'שם השופט': fullName(r.judge),
    'טלפון': r.judge.phone,
    'אגודה': r.judge.club,
    'הצגות': regSessionsLabel(r.sessions, sessions),
    'לינה': r.lodging ? 'כן' : 'לא',
    'סטטוס': status(r),
  }));
  const order = new Map(sessions.map((s, i) => [s.id, i]));
  const assignments = [...assigns]
    .sort((a, b) => (order.get(a.sessionId) ?? 99) - (order.get(b.sessionId) ?? 99) || a.positionLabel.localeCompare(b.positionLabel, 'he', { numeric: true }))
    .map((a) => ({
      'הצגה': sessions.find((s) => s.id === a.sessionId)?.label ?? a.sessionId,
      'עמדה': a.positionLabel,
      'תפקיד': a.role,
      'שופט/ת': fullName(a.judge),
    }));
  const noteRows = notes.map((n) => ({
    'זמן': n.createdAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    'כותב/ת': fullName(n.author),
    'הערה': n.text,
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const add = (ws: XLSX.WorkSheet, name: string, widths: number[]) => {
    ws['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(XLSX.utils.aoa_to_sheet(summary), 'סיכום', [18, 60]);
  add(attendance.length ? XLSX.utils.json_to_sheet(attendance) : XLSX.utils.aoa_to_sheet([['אין שופטים רשומים']]), 'נוכחות', [22, 14, 22, 40, 8, 16]);
  add(assignments.length ? XLSX.utils.json_to_sheet(assignments) : XLSX.utils.aoa_to_sheet([['אין שיבוצים במפה']]), 'שיבוצים', [26, 16, 24, 22]);
  add(noteRows.length ? XLSX.utils.json_to_sheet(noteRows) : XLSX.utils.aoa_to_sheet([['אין הערות']]), 'הערות', [20, 20, 80]);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`דוח_שופט_ראשי_${comp.name}.xlsx`)}`,
    },
  });
}
