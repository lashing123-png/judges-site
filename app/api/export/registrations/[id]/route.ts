import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canManage } from '@/lib/authz';
import { fullName, sessionsOf } from '@/lib/utils';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  // דו"ח רישום: אדמין או שופט/ת ראשי/ת של אותה תחרות בלבד
  if (!(await canManage(user, params.id))) return new Response('Forbidden', { status: 403 });

  const comp = await prisma.competition.findUnique({ where: { id: params.id } });
  if (!comp) return new Response('Not found', { status: 404 });
  const sessions = sessionsOf(comp.sessions);
  const regs = await prisma.registration.findMany({ where: { competitionId: comp.id }, include: { judge: true } });

  const rows = regs.map((r) => ({
    'שם השופט': fullName(r.judge),
    'טלפון': r.judge.phone,
    'הצגות': r.sessions.map((id) => sessions.find((s) => s.id === id)?.label).filter(Boolean).join(', '),
    'לינה': r.lodging ? 'כן' : 'לא',
    'סטטוס': r.noShow ? 'לא הגיע/ה' : r.walkIn ? 'הצטרפ/ה במקום' : 'נרשם/ה מראש',
  }));
  return xlsxResponse(rows, 'רישום', `רישום_${comp.name}.xlsx`);
}

function xlsxResponse(rows: Record<string, string>[], sheet: string, filename: string) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
