import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser, canManage } from '@/lib/authz';
import { layoutForCompetition } from '@/lib/layouts';
import { compareNames, fullName, fmtDateTime, iso, regCovers, sessionsOf, sortByName } from '@/lib/utils';
import { parseExperienceRoles } from '@/lib/constants';
import Form from '@/components/Form';
import DateText from '@/components/DateText';
import SessionMap, { type JudgeStats } from '@/components/SessionMap';
import JudgeSelect from '@/components/JudgeSelect';
import TableSearch from '@/components/TableSearch';
import { addNote, addWalkIn, clearSessionAssignments, deleteRegistration, toggleNoShow } from '@/actions/head';

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
    prisma.user.findMany({ where: { status: 'ACTIVE' } }).then(sortByName),
  ]);
  const regIds = new Set(regs.map((r) => r.judgeId));

  // נתונים להמלצות שיבוץ: הסמכות מכרטיס השופט/ת, ומספר הפעמים ותאריך אחרון בכל תפקיד (היסטוריה + שיבוצים באתר)
  const judgeIds = [...regIds];
  const [histGroups, pastAssigns] = judgeIds.length
    ? await Promise.all([
        prisma.judgingHistory.groupBy({ by: ['judgeId', 'role'], where: { judgeId: { in: judgeIds } }, _count: { _all: true }, _max: { date: true } }),
        prisma.assignment.findMany({
          where: { judgeId: { in: judgeIds }, NOT: { competitionId: comp.id } },
          select: { judgeId: true, role: true, competition: { select: { date: true } } },
        }),
      ])
    : [[], []];
  const stats: Record<string, JudgeStats> = {};
  for (const r of regs) stats[r.judgeId] = { certs: parseExperienceRoles(r.judge.roleExperience), roles: {} };
  const bump = (judgeId: string | null, role: string, n: number, date: Date | null) => {
    const s = judgeId ? stats[judgeId] : undefined;
    if (!s) return;
    const cur = (s.roles[role] ??= { count: 0, last: '' });
    cur.count += n;
    const d = date ? iso(date) : '';
    if (d > cur.last) cur.last = d;
  };
  for (const g of histGroups) bump(g.judgeId, g.role, g._count._all, g._max.date);
  for (const a of pastAssigns) bump(a.judgeId, a.role, 1, a.competition.date);
  const byName = (a: (typeof regs)[number], b: (typeof regs)[number]) => compareNames(a.judge, b.judge);

  // טבלת נוכחות: לכל הצגה (עם עמודת שיבוץ במפה), או לכל התחרות כשאין הצגות (sessAssigns = null)
  const attendance = (list: typeof regs, sessAssigns: typeof assigns | null) => (
    <div className="tblwrap" data-attendance>
      <table className="jud-table">
        <thead><tr><th>שם</th><th>טלפון</th><th>לינה</th>{sessAssigns && <th>שיבוץ במפה</th>}<th>נוכחות</th></tr></thead>
        <tbody>
          {list.map((r) => {
            const a = sessAssigns?.find((x) => x.judgeId === r.judgeId);
            return (
              <tr key={r.id} data-search={`${fullName(r.judge)} ${r.judge.club}`} style={{ opacity: r.noShow ? 0.5 : 1 }}>
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
            <div className="muted small"><DateText date={comp.date} end={comp.endDate} /> · {comp.location}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a href={`/api/export/head-report/${comp.id}`} className="jud-btn-ghost" style={{ textDecoration: 'none' }}>הורדת הדוח (Excel)</a>
            <Link href="/head" className="jud-btn-ghost">החלפת תחרות</Link>
          </div>
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
            <JudgeSelect name="judgeId" required judges={candidates.map((j) => ({ id: j.id, name: fullName(j), extra: j.club, note: regIds.has(j.id) ? ' (רשום/ה)' : '' }))} />
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

      {regs.length > 0 && (
        <div className="card">
          <h3 className="jud-heading h3" style={{ marginBottom: 8 }}>חיפוש שופט/ת בטבלאות הנוכחות</h3>
          <TableSearch scope="[data-attendance]" />
        </div>
      )}

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
        const present = inSession.filter((r) => !r.noShow).map((r) => ({ id: r.judgeId, name: fullName(r.judge), club: r.judge.club }));
        return (
          <div key={s.id} className="card">
            <h3 className="jud-heading h3" style={{ marginBottom: 12 }}>
              {/* הצגות מהאיגוד (isr-) כבר כוללות יום ושעה בשם */}
              {s.label} {s.datetime && !s.id.startsWith('isr-') && <span className="small muted jud-mono" style={{ fontWeight: 400 }}>{fmtDateTime(s.datetime)}</span>}
            </h3>
            {layout ? (
              <SessionMap competitionId={comp.id} sessionId={s.id} title={s.label} positions={layout.positions} laneCount={layout.laneCount} assigned={assigned} present={present} stats={stats} />
            ) : (
              <div className="notice lock">אין תבנית מפת בריכה מוגדרת. יש לפנות למנהל/ת המערכת.</div>
            )}
            {sessAssigns.length > 0 && (
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <Form
                  action={clearSessionAssignments}
                  submit={`ניקוי שיבוצים (${sessAssigns.length})`}
                  submitClass="jud-btn-ghost sm danger"
                  confirm={`לנקות את כל ${sessAssigns.length} השיבוצים במפה של "${s.label}"? ההרשמות והנוכחות לא ישתנו.`}
                  inline
                >
                  <input type="hidden" name="competitionId" value={comp.id} />
                  <input type="hidden" name="sessionId" value={s.id} />
                </Form>
              </div>
            )}
            <h4 className="jud-heading h4" style={{ margin: '18px 0 10px' }}>נוכחות בהצגה זו</h4>
            {inSession.length === 0 ? <div className="muted">אין שופטים רשומים להצגה זו.</div> : attendance(inSession, sessAssigns)}
          </div>
        );
      })}
    </div>
  );
}
