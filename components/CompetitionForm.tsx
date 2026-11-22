'use client';

import { useState } from 'react';
import Form from './Form';
import { saveCompetition } from '@/actions/admin';
import { newSessionId, type Session } from '@/lib/utils';

type Judge = { id: string; name: string };
type Layout = { id: string; name: string; laneCount: number };
type Initial = {
  id?: string;
  number: string;
  name: string;
  date: string;
  location: string;
  statuteUrl: string;
  announcement: string;
  poolLayoutId: string;
  sessions: Session[];
  headJudgeIds: string[];
};

export default function CompetitionForm({ initial, judges, layouts }: { initial: Initial; judges: Judge[]; layouts: Layout[] }) {
  const [sessions, setSessions] = useState<Session[]>(initial.sessions.length ? initial.sessions : [{ id: newSessionId(), label: '', datetime: '' }]);
  const upd = (i: number, patch: Partial<Session>) => setSessions((a) => a.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <Form action={saveCompetition} submit="שמירה" className="stack" resetOnOk={!initial.id}>
      <input type="hidden" name="id" value={initial.id ?? ''} />
      <input type="hidden" name="sessions" value={JSON.stringify(sessions)} />
      <div className="grid2">
        <div><label className="lbl">מספר תחרות</label><input className="jud-input jud-mono" name="number" defaultValue={initial.number} /></div>
        <div><label className="lbl">שם התחרות</label><input className="jud-input" name="name" defaultValue={initial.name} required /></div>
        <div><label className="lbl">תאריך</label><input className="jud-input jud-mono" type="date" name="date" defaultValue={initial.date} required /></div>
        <div><label className="lbl">מיקום</label><input className="jud-input" name="location" defaultValue={initial.location} /></div>
        <div><label className="lbl">קישור לתקנון</label><input className="jud-input" dir="ltr" name="statuteUrl" defaultValue={initial.statuteUrl} placeholder="https://" /></div>
        <div>
          <label className="lbl">תבנית מפת בריכה</label>
          <select className="jud-input" name="poolLayoutId" defaultValue={initial.poolLayoutId}>
            <option value="">— ברירת מחדל —</option>
            {layouts.map((l) => (<option key={l.id} value={l.id}>{l.name} ({l.laneCount} מסלולים)</option>))}
          </select>
        </div>
      </div>
      <div>
        <label className="lbl">הודעות ואדמיניסטרציה (יוצג לכל השופטים בעמוד התחרות)</label>
        <textarea className="jud-input" name="announcement" rows={3} defaultValue={initial.announcement} />
      </div>
      <div>
        <h4 className="jud-heading h4" style={{ marginBottom: 8 }}>הצגות</h4>
        <div className="stack" style={{ gap: 8 }}>
          {sessions.map((s, i) => (
            <div key={s.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="jud-input" style={{ flex: 2 }} placeholder="שם ההצגה (למשל: בוקר יום 1)" value={s.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <input className="jud-input jud-mono" style={{ flex: 1.4 }} type="datetime-local" dir="ltr" value={s.datetime ?? ''} onChange={(e) => upd(i, { datetime: e.target.value })} />
              <button type="button" className="jud-btn-ghost sm danger" onClick={() => setSessions((a) => a.filter((_, j) => j !== i))}>מחיקה</button>
            </div>
          ))}
        </div>
        <button type="button" className="jud-btn-ghost sm" style={{ marginTop: 8 }} onClick={() => setSessions((a) => [...a, { id: newSessionId(), label: '', datetime: '' }])}>+ הוספת הצגה</button>
      </div>
      <div>
        <h4 className="jud-heading h4" style={{ marginBottom: 8 }}>שופטים ראשיים בתחרות זו</h4>
        <div className="row" style={{ gap: 8 }}>
          {judges.map((j) => (
            <label key={j.id} className="opt">
              <input type="checkbox" name="headJudges" value={j.id} defaultChecked={initial.headJudgeIds.includes(j.id)} /> {j.name}
            </label>
          ))}
          {judges.length === 0 && <span className="muted small">אין שופטים פעילים</span>}
        </div>
      </div>
    </Form>
  );
}
