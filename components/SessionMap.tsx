'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import PoolMap, { type AssignedInfo } from './PoolMap';
import type { Position } from '@/lib/poolLayout';
import { ROLE_OPTIONS } from '@/lib/constants';
import { assignPosition } from '@/actions/head';

type Assigned = Record<string, AssignedInfo & { judgeId: string; role: string }>;

export default function SessionMap(props: {
  competitionId: string;
  sessionId: string;
  title: string;
  positions: Position[];
  laneCount: number;
  assigned: Assigned;
  present: { id: string; name: string }[];
}) {
  const { competitionId, sessionId, title, positions, laneCount, assigned, present } = props;
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
            <label className="lbl">שופט/ת בעמדה זו</label>
            {present.length === 0 ? (
              <div className="small muted" style={{ background: 'var(--lock-tint)', borderRadius: 6, padding: '8px 10px' }}>
                אין שופטים רשומים ונוכחים להצגה זו. אפשר להוסיף שופט/ת דרך "הוספת שופט/ת ללא רישום מראש".
              </div>
            ) : (
              <select className="jud-input" value={judge} onChange={(e) => setJudge(e.target.value)}>
                <option value="">— ללא —</option>
                {present.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                    {takenIds.has(j.id) && assigned[open.id]?.judgeId !== j.id ? ' (משובץ/ת כבר)' : ''}
                  </option>
                ))}
              </select>
            )}
            <div style={{ marginTop: 12 }}>
              <label className="lbl">תפקיד</label>
              <select className="jud-input" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
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
