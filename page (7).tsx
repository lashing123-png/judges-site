import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/authz';
import Form from '@/components/Form';
import CompetitionForm from '@/components/CompetitionForm';
import { deleteCompetition } from '@/actions/admin';
import { fullName, iso, sessionsOf } from '@/lib/utils';

export default async function AdminCompetitions({ searchParams }: { searchParams: { edit?: string } }) {
  await requireAdminPage();
  const [comps, judges, layouts] = await Promise.all([
    prisma.competition.findMany({ orderBy: { date: 'asc' }, include: { poolLayout: true, headJudges: { include: { judge: true } } } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.poolLayout.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const editing = searchParams.edit === 'new' ? 'new' : comps.find((c) => c.id === searchParams.edit) ?? null;
  const initial =
    editing === 'new'
      ? { number: '', name: '', date: '', location: '', statuteUrl: '', announcement: '', poolLayoutId: '', sessions: [], headJudgeIds: [] }
      : editing
        ? {
            id: editing.id,
            number: editing.number,
            name: editing.name,
            date: iso(editing.date),
            location: editing.location,
            statuteUrl: editing.statuteUrl,
            announcement: editing.announcement,
            poolLayoutId: editing.poolLayoutId ?? '',
            sessions: sessionsOf(editing.sessions),
            headJudgeIds: editing.headJudges.map((h) => h.judgeId),
          }
        : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="jud-heading h2">ניהול תחרויות</h2>
          <Link href="/admin/competitions?edit=new" className="jud-btn-primary" style={{ textDecoration: 'none' }}>+ תחרות חדשה</Link>
        </div>
        <div className="tblwrap">
          <table className="jud-table">
            <thead><tr><th>מס׳</th><th>שם</th><th>תאריך</th><th>הצגות</th><th>תבנית</th><th>שופטים ראשיים</th><th></th></tr></thead>
            <tbody>
              {comps.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 16 }}>אין תחרויות</td></tr>}
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className="jud-mono muted">{c.number}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="jud-mono">{iso(c.date)}</td>
                  <td>{sessionsOf(c.sessions).length}</td>
                  <td className="small">{c.poolLayout?.name ?? 'ברירת מחדל'}</td>
                  <td className="small">{c.headJudges.map((h) => fullName(h.judge)).join(', ') || '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <Link href={`/admin/competitions?edit=${c.id}`} className="jud-btn-ghost sm" style={{ textDecoration: 'none' }}>עריכה</Link>
                      <Form action={deleteCompetition} submit="מחיקה" submitClass="jud-btn-ghost sm danger" confirm={`למחוק את "${c.name}" יחד עם כל ההרשמות, השיבוצים וההערות שלה? הפעולה אינה הפיכה.`} inline>
                        <input type="hidden" name="id" value={c.id} />
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {initial && (
        <div className="card" key={editing === 'new' ? 'new' : (editing as { id: string }).id}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="jud-heading h3">{initial.id ? `עריכת ${initial.name}` : 'תחרות חדשה'}</h3>
            <Link href="/admin/competitions" className="jud-btn-ghost sm" style={{ textDecoration: 'none' }}>סגירה</Link>
          </div>
          <CompetitionForm
            initial={initial}
            judges={judges.map((j) => ({ id: j.id, name: fullName(j) }))}
            layouts={layouts.map((l) => ({ id: l.id, name: l.name, laneCount: l.laneCount }))}
          />
        </div>
      )}
    </div>
  );
}
