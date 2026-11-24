import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/authz';
import { fullName, sortByName } from '@/lib/utils';
import { ROLE_OPTIONS } from '@/lib/constants';
import { roleCountsByJudge } from '@/lib/roleCounts';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!user.isAdmin) return new Response('Forbidden', { status: 403 }); // דוח כללי: אדמין בלבד

  const [users, byJudge] = await Promise.all([prisma.user.findMany({ where: { status: 'ACTIVE' } }), roleCountsByJudge()]);
  const rows = sortByName(users)
    .map((u) => {
      const row: Record<string, string | number> = { 'שם השופט': fullName(u) };
      let total = 0;
      ROLE_OPTIONS.forEach((role) => {
        const n = byJudge.get(u.id)?.[role] ?? 0;
        row[role] = n || '';
        total += n;
      });
      row['סה״כ'] = total;
      return row;
    });

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'דוח כללי');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('דוח_שופטים_כללי.xlsx')}`,
    },
  });
}
