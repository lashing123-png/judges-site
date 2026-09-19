import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import Form from '@/components/Form';
import { saveRegistration } from '@/actions/competition';
import { fullName, iso, sessionsOf } from '@/lib/utils';

export default async function CompetitionPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const comp = await prisma.competition.findUnique({ where: { id: params.id }, include: { headJudges: { include: { judge: true } } } });
  if (!comp) notFound();

  const sessions = sessionsOf(comp.sessions);
  const manage = user.isAdmin || comp.headJudges.some((h) => h.judgeId === user.id);
  const reg = await prisma.registration.findUnique({ where: { competitionId_judgeId: { competitionId: comp.id, judgeId: user.id } } });
  const count = await prisma.registration.count({ where: { competitionId: comp.id } });

  return (
    <div className="stack">
      <Link href="/competitions" className="jud-btn-ghost" style={{ width: 'fit-content' }}>‹ חזרה לרשימת התחרויות</Link>

      <div className="card">
        <div className="jud-mono" style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 4 }}>תחרות מס׳ {comp.number}</div>
        <h2 className="jud-heading" style={{ fontSize: 22, marginBottom: 10 }}>{comp.name}</h2>
        <div className="row muted" style={{ gap: 18, fontSize: 14 }}>
          <span className="jud-mono">{iso(comp.date)}</span>
          <span>{comp.location}</span>
          {comp.statuteUrl && <a href={comp.statuteUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>לתקנון התחרות ↗</a>}
        </div>
      </div>

      {(comp.announcement || comp.headJudges.length > 0) && (
        <div className="card">
          <h3 className="jud-heading h3" style={{ marginBottom: 10 }}>הודעות ואדמיניסטרציה</h3>
          {comp.announcement && <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{comp.announcement}</p>}
          {comp.headJudges.length > 0 && (
            <>
              <h4 className="jud-heading h4" style={{ margin: '14px 0 8px' }}>שופטים ראשיים בתחרות</h4>
              <div className="row" style={{ gap: 18, fontSize: 13.5 }}>
                {comp.headJudges.map((h) => (
                  <span key={h.judgeId}>
                    {fullName(h.judge)}
                    {/* מספרי טלפון נשלחים ללקוח רק למנהל/ת ולשופט/ת הראשי/ת של התחרות הזו */}
                    {manage && h.judge.phone && <> — <span className="jud-mono">{h.judge.phone}</span></>}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="row between" style={{ marginBottom: 4 }}>
          <h3 className="jud-heading h3">רישום לתחרות</h3>
          <span className="small muted">{count} שופטים רשומים עד כה</span>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">טרם הוגדרו הצגות לתחרות זו.</p>
        ) : (
          <Form action={saveRegistration} submit={reg ? 'עדכון רישום' : 'שליחת רישום'} className="stack">
            <input type="hidden" name="competitionId" value={comp.id} />
            <div className="grid2" style={{ marginTop: 14 }}>
              <div><label className="lbl">שם מלא</label><input className="jud-input" disabled value={fullName(user)} readOnly /></div>
              <div><label className="lbl">טלפון</label><input className="jud-input jud-mono" disabled value={user.phone} readOnly /></div>
            </div>
            <div>
              <div className="lbl">הצגות בהן אוכל/ת לשפוט</div>
              <div className="row">
                {sessions.map((s) => (
                  <label key={s.id} className="opt">
                    <input type="checkbox" name="sessions" value={s.id} defaultChecked={reg?.sessions.includes(s.id)} /> {s.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="check"><input type="checkbox" name="lodging" defaultChecked={reg?.lodging} /> יש צורך בלינה</label>
          </Form>
        )}
      </div>
    </div>
  );
}
