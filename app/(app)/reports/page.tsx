import { prisma } from '@/lib/prisma';
import { requireUser, managedCompetitionIds } from '@/lib/authz';
import { fullName, regSessionsLabel, sessionsOf, sortByJudgeName, sortByName } from '@/lib/utils';
import TableSearch from '@/components/TableSearch';
import { roleCountsByJudge } from '@/lib/roleCounts';
import { ROLE_OPTIONS } from '@/lib/constants';

export default async function ReportsPage(props: { searchParams: Promise<{ c?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const ids = await managedCompetitionIds(user);
  const comps = await prisma.competition.findMany({ where: { id: { in: ids } }, orderBy: { date: 'asc' } });

  if (!comps.length && !user.isAdmin)
    return <div className="notice lock">דו״ח רישום זמין למנהל/ת ולשופט/ת הראשי/ת של אותה תחרות.</div>;

  const comp = comps.find((c) => c.id === searchParams.c) ?? comps[0];
  const regs = comp ? sortByJudgeName(await prisma.registration.findMany({ where: { competitionId: comp.id }, include: { judge: true } })) : [];
  const sessions = comp ? sessionsOf(comp.sessions) : [];

  let matrix: { id: string; name: string; club: string; counts: Record<string, number>; total: number }[] = [];
  if (user.isAdmin) {
    const [users, byJudge] = await Promise.all([prisma.user.findMany({ where: { status: 'ACTIVE' } }), roleCountsByJudge()]);
    matrix = sortByName(users).map((u) => {
      const counts = byJudge.get(u.id) ?? {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { id: u.id, name: fullName(u), club: u.club, counts, total };
    });
  }

  return (
    <div className="stack">
      {comp && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="jud-heading h2">דוח רישום לתחרות</h2>
              <p className="small muted">שם, טלפון, הצגות ולינה, לפי תחרות נבחרת.</p>
            </div>
            <div className="row">
              <form method="get" className="row">
                <select className="jud-input" style={{ width: 'auto' }} name="c" defaultValue={comp.id}>
                  {comps.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <button className="jud-btn-ghost" type="submit">הצגה</button>
              </form>
              <a className="jud-btn-ghost" href={`/api/export/registrations/${comp.id}`}>ייצוא ל-Excel</a>
            </div>
          </div>
          {regs.length > 0 && <TableSearch scope="[data-report-regs]" />}
          <div className="tblwrap" data-report-regs>
            <table className="jud-table">
              <thead><tr><th>שם השופט</th><th>טלפון</th><th>הצגות</th><th>לינה</th><th>סטטוס</th></tr></thead>
              <tbody>
                {regs.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>אין רישומים לתחרות זו</td></tr>}
                {regs.map((r) => (
                  <tr key={r.id} data-search={`${fullName(r.judge)} ${r.judge.club}`}>
                    <td>{fullName(r.judge)}</td>
                    <td className="jud-mono">{r.judge.phone}</td>
                    <td className="small">{regSessionsLabel(r.sessions, sessions)}</td>
                    <td>{r.lodging ? 'כן' : 'לא'}</td>
                    <td className="small">{r.noShow ? 'לא הגיע/ה' : r.walkIn ? 'הצטרפ/ה במקום' : 'נרשם/ה מראש'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.isAdmin && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="jud-heading h2">דוח שופטים כללי</h2>
              <p className="small muted">בכמה ובאילו תפקידים שפט/ה כל שופט/ת, לאורך כל התחרויות (כולל היסטוריית השיפוט שיובאה).</p>
            </div>
            <a className="jud-btn-ghost" href="/api/export/general">ייצוא ל-Excel</a>
          </div>
          <TableSearch scope="[data-report-general]" />
          <div className="tblwrap" data-report-general>
            <table className="jud-table" style={{ minWidth: 900 }}>
              <thead>
                <tr><th>שם השופט</th>{ROLE_OPTIONS.map((r) => (<th key={r} style={{ fontSize: 11 }}>{r}</th>))}<th>סה״כ</th></tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.id} data-search={`${row.name} ${row.club}`}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    {ROLE_OPTIONS.map((r) => (<td key={r} className="jud-mono muted" style={{ textAlign: 'center' }}>{row.counts[r] || ''}</td>))}
                    <td className="jud-mono" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--link)' }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
