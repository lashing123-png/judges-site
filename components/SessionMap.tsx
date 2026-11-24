'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import PoolMap, { type AssignedInfo } from './PoolMap';
import type { Position } from '@/lib/poolLayout';
import { ROLE_OPTIONS, isCertifiedFor } from '@/lib/constants';
import { assignPosition } from '@/actions/head';
import JudgeSelect from './JudgeSelect';

type Assigned = Record<string, AssignedInfo & { judgeId: string; role: string }>;

// לכל שופט/ת: הסמכות, ולכל תפקיד: מספר פעמים ותאריך אחרון (YYYY-MM-DD) מההיסטוריה ומשיבוצים קודמים באתר
export type JudgeStats = { certs: string[]; roles: Record<string, { count: number; last: string }> };

const monthYear = (d: string) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

// המלצה: קודם מי שיש לו/ה הסמכה לתפקיד, אחר כך לפי ניסיון בתפקיד (מספר פעמים), ובשוויון מי ששובץ/ה בו לאחרונה
function recommend(role: string, judges: { id: string; name: string }[], stats: Record<string, JudgeStats>) {
  return judges
    .map((j) => {
      const s = stats[j.id];
      const certified = !!s && isCertifiedFor(role, s.certs);
      const exp = s?.roles[role] ?? { count: 0, last: '' };
      return { ...j, certified, count: exp.count, last: exp.last };
    })
    .filter((x) => x.certified || x.count > 0)
    .sort((a, b) => Number(b.certified) - Number(a.certified) || b.count - a.count || b.last.localeCompare(a.last));
}

export default function SessionMap(props: {
  competitionId: string;
  sessionId: string;
  title: string;
  positions: Position[];
  laneCount: number;
  assigned: Assigned;
  present: { id: string; name: string; club?: string }[];
  stats?: Record<string, JudgeStats>;
}) {
  const { competitionId, sessionId, title, positions, laneCount, assigned, present, stats = {} } = props;
  const router = useRouter();
  const [open, setOpen] = useState<Position | null>(null);
  const [judge, setJudge] = useState('');
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const takenIds = new Set(Object.values(assigned).map((a) => a.judgeId));

  function pick(p: Position) {
    const a = assigned[p.id];
    setJudge(a?.judgeId ?? '');
    setRole(a?.role ?? p.defaultRole);
    setErr('');
    setOpen(p);
  }

  function save(clear: boolean) {
    if (!open) return;
    start(async () => {
      const r = await assignPosition({
        competitionId,
        sessionId,
        positionId: open.id,
        judgeId: clear ? null : judge || null,
        role,
      });
      if (!r.ok) setErr(r.message);
      else {
        setOpen(null);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <PoolMap positions={positions} laneCount={laneCount} title={title} assigned={assigned} onPick={pick} />
      <p className="small muted" style={{ marginTop: 6 }}>
        אפשר לגלול את המפה בצדדים במסך צר. הקישו על עמדה כדי לשבץ או להחליף שופט/ת.
      </p>
      {open && (
        <div className="modal-ov" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="jud-heading" style={{ fontSize: 16, marginBottom: 4 }}>{open.label}</h4>
            <div className="small muted" style={{ marginBottom: 12 }}>{title}</div>
            <div style={{ marginBottom: 12 }}>
              <label className="lbl">תפקיד</label>
              <select className="jud-input" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <label className="lbl">שופט/ת בעמדה זו</label>
            {present.length === 0 ? (
              <div className="small muted" style={{ background: 'var(--lock-tint)', borderRadius: 6, padding: '8px 10px' }}>
                אין שופטים רשומים ונוכחים להצגה זו. אפשר להוסיף שופט/ת דרך "הוספת שופט/ת ללא רישום מראש".
              </div>
            ) : (
              <>
                {(() => {
                  // המלצות רק מתוך מי שעוד לא משובץ/ת בהצגה הזו (או שמשובץ/ת בעמדה הנוכחית)
                  const free = present.filter((j) => !takenIds.has(j.id) || assigned[open.id]?.judgeId === j.id);
                  const recs = recommend(role, free, stats).slice(0, 3);
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <div className="lbl">מומלצים לתפקיד {role}</div>
                      {recs.length === 0 ? (
                        <div className="small muted">אין בין הנוכחים שופט/ת עם הסמכה או ניסיון קודם בתפקיד הזה.</div>
                      ) : (
                        <div className="stack" style={{ gap: 6 }}>
                          {recs.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className={`jud-btn-ghost sm ${judge === r.id ? 'on' : ''}`}
                              style={{ justifyContent: 'space-between', display: 'flex', width: '100%', textAlign: 'start', fontWeight: judge === r.id ? 700 : 500 }}
                              onClick={() => setJudge(r.id)}
                            >
                              <span>{judge === r.id ? '✓ ' : ''}{r.name}</span>
                              <span className="small muted" style={{ fontWeight: 400 }}>
                                {[r.certified && 'הסמכה', r.count > 0 && `${r.count} פעמים בתפקיד`, r.last && `אחרון ${monthYear(r.last)}`].filter(Boolean).join(' · ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <JudgeSelect
                  value={judge}
                  onChange={setJudge}
                  emptyLabel="— ללא —"
                  judges={present.map((j) => ({
                    id: j.id,
                    name: j.name,
                    extra: j.club,
                    note:
                      (stats[j.id] && isCertifiedFor(role, stats[j.id].certs) ? ' ★' : '') +
                      (takenIds.has(j.id) && assigned[open.id]?.judgeId !== j.id ? ' (משובץ/ת כבר)' : ''),
                  }))}
                />
                <div className="small muted" style={{ marginTop: 4 }}>★ = הסמכה לתפקיד לפי כרטיס השופט/ת</div>
              </>
            )}
            {err && <div className="msg err">{err}</div>}
            <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              {assigned[open.id] && (
                <button className="jud-btn-ghost danger" disabled={pending} onClick={() => save(true)}>פינוי עמדה</button>
              )}
              <button className="jud-btn-ghost" onClick={() => setOpen(null)}>ביטול</button>
              <button className="jud-btn-primary" disabled={pending || !judge} onClick={() => save(false)}>שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
