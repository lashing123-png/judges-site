'use client';

import { useState } from 'react';
import Form from './Form';
import PoolMap from './PoolMap';
import { saveLayout } from '@/actions/admin';
import { laneTimers, validatePositions, type Position } from '@/lib/poolLayout';

export default function LayoutForm({ initial }: { initial: { id?: string; name: string; laneCount: number; isDefault: boolean; positions: Position[] } }) {
  const [lanes, setLanes] = useState(initial.laneCount);
  const [json, setJson] = useState(JSON.stringify(initial.positions, null, 1));
  let parsed: Position[] | null = null;
  let err = '';
  try {
    parsed = validatePositions(JSON.parse(json));
  } catch (e: any) {
    err = e.message || 'JSON לא תקין';
  }

  function rebuild() {
    try {
      const cur = JSON.parse(json) as Position[];
      const rest = cur.filter((p) => !/^timer-\d+-[ab]$/.test(p.id));
      setJson(JSON.stringify([...rest, ...laneTimers(lanes)], null, 1));
    } catch {
      /* JSON לא תקין: הצגת השגיאה מתבצעת למטה */
    }
  }

  return (
    <Form action={saveLayout} submit="שמירה" className="stack" resetOnOk={!initial.id}>
      <input type="hidden" name="id" value={initial.id ?? ''} />
      <input type="hidden" name="positions" value={json} />
      <div className="grid2">
        <div><label className="lbl">שם התבנית</label><input className="jud-input" name="name" defaultValue={initial.name} required /></div>
        <div>
          <label className="lbl">מספר מסלולים</label>
          <input className="jud-input jud-mono" name="laneCount" type="number" min={2} max={16} value={lanes} onChange={(e) => setLanes(Math.min(16, Math.max(2, parseInt(e.target.value, 10) || 10)))} />
        </div>
      </div>
      <label className="check"><input type="checkbox" name="isDefault" defaultChecked={initial.isDefault} /> תבנית ברירת מחדל (לתחרויות ללא תבנית מוגדרת)</label>
      <div><button type="button" className="jud-btn-ghost sm" onClick={rebuild}>בנה מחדש עמדות מודדי זמנים לפי מספר המסלולים</button></div>
      <div>
        <label className="lbl">עמדות (JSON: id, label, defaultRole, x, y. מערכת קואורדינטות 1000×780)</label>
        <textarea className="jud-input code" rows={14} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
      </div>
      {err ? <div className="msg err">{err}</div> : parsed && (
        <div>
          <div className="lbl">תצוגה מקדימה ({parsed.length} עמדות)</div>
          <PoolMap positions={parsed} laneCount={lanes} title="תצוגה מקדימה" />
        </div>
      )}
    </Form>
  );
}
