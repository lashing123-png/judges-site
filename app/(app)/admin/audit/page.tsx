import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/authz';
import { fullName } from '@/lib/utils';

export default async function AuditPage() {
  await requireAdminPage();
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const actors = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(logs.map((l) => l.actorId).filter(Boolean) as string[])) } } });
  const name = (id: string | null) => {
    const u = actors.find((a) => a.id === id);
    return u ? fullName(u) : '—';
  };
  return (
    <div className="card">
      <h2 className="jud-heading h2" style={{ marginBottom: 12 }}>יומן פעולות מנהל</h2>
      {logs.length === 0 ? (
        <div className="muted">אין פעולות מתועדות.</div>
      ) : (
        <div className="tblwrap">
          <table className="jud-table">
            <thead><tr><th>זמן</th><th>מי</th><th>פעולה</th><th>פרטים</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="jud-mono small">{l.createdAt.toLocaleString('he-IL')}</td>
                  <td>{name(l.actorId)}</td>
                  <td>{l.action}</td>
                  <td className="small muted">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
