import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/authz';
import Form from '@/components/Form';
import CompetitionForm from '@/components/CompetitionForm';
import { deleteCompetition, unhideIsrCompetition } from '@/actions/admin';
import { syncIsrNow } from '@/actions/isrSync';
import { fullName, iso, sessionsOf } from '@/lib/utils';

export default async function AdminCompetitions(props: { searchParams: Promise<{ edit?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdminPage();
  const [comps, judges, layouts, lastSync, hidden] = await Promise.all([
    prisma.competition.findMany({ orderBy: { date: 'asc' }, include: { poolLayout: true, headJudges: { include: { judge: true } } } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.poolLayout.findMany({ orderBy: { name: 'asc' } }),
    prisma.auditLog.findFirst({ where: { action: 'סנכרון תחרויות מאתר האיגוד' }, orderBy: { createdAt: 'desc' } }),
    prisma.isrIgnoredCompetition.findMany({ orderBy: { date: 'asc' } }),
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
        <div className="row between" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
          <p className="small muted" style={{ flex: '1 1 300px' }}>
            תחרויות השחייה (בלי מים פתוחים, שחייה אמנותית ומאסטרס) מתעדכנות אוטומטית כל יום מ<a href="https://isr.org.il/Competitions.ASP" target="_blank" rel="noreferrer">אתר איגוד השחייה</a>.
            שם, תאריך, מקום וקובץ המידע נלקחים מהאיגוד ומתעדכנים לפיו; תבנית מפה ושופטים ראשיים נשארים כפי שהוגדרו כאן.
            מחיקת תחרות מהאיגוד מסתירה אותה מהסנכרון (למשל רשומה כפולה), ואפשר להחזיר אותה מהרשימה שבתחתית העמוד.
            {lastSync && <> סנכרון אחרון: {lastSync.createdAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} ({lastSync.detail}).</>}
          </p>
          <Form action={syncIsrNow} submit="סנכרון עכשיו מאתר האיגוד" submitClass="jud-btn-ghost sm" inline />
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
                      <Form
                        action={deleteCompetition}
                        submit="מחיקה"
                        submitClass="jud-btn-ghost sm danger"
                        confirm={
                          `למחוק את "${c.name}" יחד עם כל ההרשמות, השיבוצים וההערות שלה? הפעולה אינה הפיכה.` +
                          (c.isrCompId != null ? ' התחרות מגיעה מאתר האיגוד ולכן תוסתר מהסנכרון היומי ולא תיווצר מחדש.' : '')
                        }
                        inline
                      >
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

      {hidden.length > 0 && (
        <div className="card">
          <h3 className="jud-heading h3" style={{ marginBottom: 4 }}>תחרויות שהוסתרו מהסנכרון ({hidden.length})</h3>
          <p className="small muted" style={{ marginBottom: 12 }}>
            תחרויות מאתר האיגוד שנמחקו כאן. הסנכרון היומי מדלג עליהן. &quot;החזרה&quot; תיצור אותן מחדש בסנכרון הבא, בלי ההרשמות שנמחקו.
          </p>
          <div className="tblwrap">
            <table className="jud-table">
              <thead><tr><th>שם</th><th>תאריך</th><th>באתר האיגוד</th><th>הוסתרה</th><th></th></tr></thead>
              <tbody>
                {hidden.map((h) => (
                  <tr key={h.isrCompId}>
                    <td style={{ fontWeight: 600 }}>{h.name}</td>
                    <td className="jud-mono">{iso(h.date)}</td>
                    <td className="small"><a href={`https://isr.org.il/comp.asp?compID=${h.isrCompId}`} target="_blank" rel="noreferrer">{h.isrCompId}</a></td>
                    <td className="small jud-mono">{h.createdAt.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}</td>
                    <td>
                      <Form action={unhideIsrCompetition} submit="החזרה" submitClass="jud-btn-ghost sm" inline>
                        <input type="hidden" name="isrCompId" value={h.isrCompId} />
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
