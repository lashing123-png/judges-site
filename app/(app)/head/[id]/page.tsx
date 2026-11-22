import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser, canManage } from '@/lib/authz';
import { layoutForCompetition } from '@/lib/layouts';
import { fullName, fmtDateTime, iso, regCovers, sessionsOf } from '@/lib/utils';
import Form from '@/components/Form';
import SessionMap from '@/components/SessionMap';
import { addNote, addWalkIn, deleteRegistration, toggleNoShow } from '@/actions/head';

export default async function HeadCompetitionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireUser();
  // בדיקת הרשאה בשרת: אדמין, או שופט/ת ראשי/ת של התחרות הזו בלבד
  if (!(await canManage(user, params.id))) redirect('/head');

  const comp = await prisma.competition.findUnique({ where: { id: params.id } });
  if (!comp) notFound();

  const layout = await layoutForCompetition(comp.poolLayoutId);
  const sessions = sessionsOf(comp.sessions);
  const [regs, assigns, notes, candidates] = await Promise.all([
    prisma.registration.findMany({ where: { competitionId: comp.id }, include: { judge: true } }),
    prisma.assignment.findMany({ where: { competitionId: comp.id }, include: { judge: true } }),
    prisma.note.findMany({ where: { competitionId: comp.id }, include: { author: true }, orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
  ]);
  const byName = (a: { judge: { firstName: string; lastName: string } }, b: { judge: { firstName: string; lastName: string } }) =>
    fullName(a.judge).localeCompare(fullName(b.judge), 'he');

  // טבלת נוכחות: לכל הצגה (עם עמודת שיבוץ במפה), או לכל התחרות כשאין הצגות (sessAssigns = null)
  const attendance = (list: typeof regs, sessAssigns: typeof assigns | null) => (
    <div className="tblwrap">
      <table className="jud-table">
        <thead><tr><th>שם</th><th>טלפון</th><th>לינה</th>{sessAssigns && <th>שיבוץ במפה</th>}<th>נוכחות</th></tr></thead>
        <tbody>
          {list.map((r) => {
            const a = sessAssigns?.find((x) => x.judgeId === r.judgeId);
            return (
              <tr key={r.id} style={{ opacity: r.noShow ? 0.5 : 1 }}>
                <td>
                  {fullName(r.judge)} {r.walkIn && <span className="jud-chip chip-accent">הצטרפ/ה במקום</span>} {r.noShow && <span className="jud-chip chip-lock">לא הגיע/ה</span>}
                </td>
                <td className="jud-mono">{r.judge.phone}</td>
                <td>{r.lodging ? <span className="jud-chip chip-ok">נדרשת</span> : '—'}</td>
                {sessAssigns && <td className="small">{a ? a.positionLabel : '— טרם שובץ במפה —'}</td>}
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <Form action={toggleNoShow} submit={r.noShow ? 'סימון כהגיע/ה' : 'לא הגיע/ה'} submitClass="jud-btn-ghost sm" inline>
                      <input type="hidden" name="competitionId" value={comp.id} />
                      <input type="hidden" name="judgeId" value={r.judgeId} />
                    </Form>
                    <Form action={deleteRegistration} submit="מחיקה" submitClass="jud-btn-ghost sm danger" confirm={`למחוק את ההרשמה של ${fullName(r.judge)}? השיבוצים שלו/ה במפה יפונו.`} inline>
                      <input type="hidden" name="competitionId" value={comp.id} />
                      <input type="hidden" name="judgeId" value={r.judgeId} />
                    </Form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="stack">
      <div className="card">
        <div className="row between">
          <div>
            <h2 className="jud-heading h2">דוח שופט ראשי: {comp.name}</h2>
            <div className="jud-mono muted small">{iso(comp.date)} · {comp.location}</div>
          </div>
          <Link href="/head" className="jud-btn-ghost">החלפת תחרות</Link>
        </div>
      </div>

      <div className="card">
        <h3 className="jud-heading h3" style={{ marginBottom: 4 }}>הערות שופט ראשי: מצב בריכה והתנהלות התחרות</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>יומן הערות משותף לצוות השיפוט לאורך יום התחרות (טמפרטורת מים, עיכובים, תקלות וכד׳).</p>
        <Form action={addNote} submit="הוספת הערה" className="stack" resetOnOk>
          <input type="hidden" name="competitionId" value={comp.id} />
          <textarea className="jud-input" name="text" rows={2} required maxLength={2000} placeholder="לדוגמה: טמפרטורת מים 27 מעלות, עיכוב 10 דק׳ בתחילת ההצגה..." />
        </Form>
        <div className="stack" style={{ gap: 8, marginTop: 14 }}>
          {notes.length === 0 && <div className="small muted">אין עדיין הערות לתחרות זו.</div>}
          {notes.map((n) => (
            <div key={n.id} className="note-item">
              <div className="jud-mono muted" style={{ fontSize: 11.5, marginBottom: 2 }}>{n.createdAt.toLocaleString('he-IL')} · {fullName(n.author)}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="jud-heading h3" style={{ marginBottom: 4 }}>הוספת שופט/ת שהגיע/ה ללא רישום מראש</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>מיועד לשופטים שהגיעו בפועל לתחרות אך לא נרשמו דרך עמוד התחרות.</p>
        <Form action={addWalkIn} submit="הוספה לתחרות" className="row end" resetOnOk>
          <input type="hidden" name="competitionId" value={comp.id} />
          <div style={{ minWidth: 220 }}>
            <label className="lbl">שופט/ת</label>
            <select className="jud-input" name="judgeId" required defaultValue="">
              <option value="">— בחירה —</option>
              {candidates.map((j) => (<option key={j.id} value={j.id}>{fullName(j)}</option>))}
            </select>
          </div>
          {sessions.length > 0 ? (
            <div>
              <div className="lbl">הצגות</div>
              <div className="row" style={{ gap: 8 }}>
                {sessions.map((s) => (
                  <label key={s.id} className="opt"><input type="checkbox" name="sessions" value={s.id} /> {s.label}</label>
                ))}
              </div>
            </div>
          ) : (
            <div className="small muted">התחרות לא חולקה להצגות: השופט/ת יתווסף/תתווסף לכל התחרות.</div>
          )}
        </Form>
      </div>

      {sessions.length === 0 && (
        <div className="card">
          <h3 className="jud-heading h3" style={{ marginBottom: 4 }}>שופטים רשומים לתחרות ({regs.length})</h3>
          <p className="small muted" style={{ marginBottom: 12 }}>
            לתחרות זו עדיין לא הוגדרו הצגות, ולכן אין מפת שיבוץ. מנהל/ת המערכת יכול/ה להוסיף הצגות בלשונית &quot;ניהול&quot;, והרשומים לכל התחרות יופיעו בכל הצגה.
          </p>
          {regs.length === 0 ? <div className="muted">אין עדיין שופטים רשומים.</div> : attendance([...regs].sort(byName), null)}
        </div>
      )}

      {sessions.map((s) => {
        const inSession = regs.filter((r) => regCovers(r.sessions, s.id)).sort(byName);
        const sessAssigns = assigns.filter((a) => a.sessionId === s.id);
        const assigned: Record<string, { initials: string; name: string; judgeId: string; role: string }> = {};
        sessAssigns.forEach((a) => {
          assigned[a.positionId] = { initials: `${a.judge.firstName[0] ?? '?'}${a.judge.lastName[0] ?? '?'}`, name: fullName(a.judge), judgeId: a.judgeId, role: a.role };
        });
        const present = inSession.filter((r) => !r.noShow).map((r) => ({ id: r.judgeId, name: fullName(r.judge) }));
        return (
          <div key={s.id} className="card">
            <h3 className="jud-heading h3" style={{ marginBottom: 12 }}>
              {/* הצגות מהאיגוד (isr-) כבר כוללות יום ושעה בשם */}
              {s.label} {s.datetime && !s.id.startsWith('isr-') && <span className="small muted jud-mono" style={{ fontWeight: 400 }}>{fmtDateTime(s.datetime)}</span>}
            </h3>
            {layout ? (
              <SessionMap competitionId={comp.id} sessionId={s.id} title={s.label} positions={layout.positions} laneCount={layout.laneCount} assigned={assigned} present={present} />
            ) : (
              <div className="notice lock">אין תבנית מפת בריכה מוגדרת. יש לפנות למנהל/ת המערכת.</div>
            )}
            <h4 className="jud-heading h4" style={{ margin: '18px 0 10px' }}>נוכחות בהצגה זו</h4>
            {inSession.length === 0 ? <div className="muted">אין שופטים רשומים להצגה זו.</div> : attendance(inSession, sessAssigns)}
          </div>
        );
      })}
    </div>
  );
}
