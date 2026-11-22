'use client';

import { useState } from 'react';
import Form from './Form';
import PoolMap from './PoolMap';
import { saveLayout } from '@/actions/admin';
import { ROLE_OPTIONS } from '@/lib/constants';
import { laneTimers, validatePositions, type Position } from '@/lib/poolLayout';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// מזהה פנימי לעמדה חדשה (לא מוצג למשתמש/ת)
function newId(existing: Position[]) {
  let i = existing.length + 1;
  while (existing.some((p) => p.id === `pos-${i}`)) i++;
  return `pos-${i}`;
}

export default function LayoutForm({ initial }: { initial: { id?: string; name: string; laneCount: number; isDefault: boolean; positions: Position[] } }) {
  const [lanes, setLanes] = useState(initial.laneCount);
  const [positions, setPositions] = useState<Position[]>(initial.positions);

  let err = '';
  try {
    validatePositions(positions);
  } catch (e: any) {
    err = e.message;
  }
  const emptyLabel = positions.find((p) => !p.label.trim());
  if (!err && emptyLabel) err = 'לכל עמדה צריך להיות שם';

  const update = (id: string, patch: Partial<Position>) => setPositions((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => setPositions((ps) => ps.filter((p) => p.id !== id));
  const add = () =>
    setPositions((ps) => [...ps, { id: newId(ps), label: 'עמדה חדשה', defaultRole: ROLE_OPTIONS[0], x: 500, y: 700 }]);
  const rebuild = () => setPositions((ps) => [...ps.filter((p) => !/^timer-\d+-[ab]$/.test(p.id)), ...laneTimers(lanes)]);

  return (
    <Form action={saveLayout} submit="שמירה" className="stack" resetOnOk={!initial.id}>
      <input type="hidden" name="id" value={initial.id ?? ''} />
      <input type="hidden" name="positions" value={JSON.stringify(positions)} />
      <div className="grid2">
        <div><label className="lbl">שם התבנית</label><input className="jud-input" name="name" defaultValue={initial.name} required /></div>
        <div>
          <label className="lbl">מספר מסלולים</label>
          <input className="jud-input jud-mono" name="laneCount" type="number" min={2} max={16} value={lanes} onChange={(e) => setLanes(clamp(parseInt(e.target.value, 10) || 10, 2, 16))} />
        </div>
      </div>
      <label className="check"><input type="checkbox" name="isDefault" defaultChecked={initial.isDefault} /> תבנית ברירת מחדל (לתחרויות ללא תבנית מוגדרת)</label>
      <div><button type="button" className="jud-btn-ghost sm" onClick={rebuild}>בנה מחדש עמדות מודדי זמנים לפי מספר המסלולים</button></div>

      <div>
        <div className="row between" style={{ marginBottom: 6 }}>
          <label className="lbl" style={{ marginBottom: 0 }}>עמדות ({positions.length})</label>
          <button type="button" className="jud-btn-ghost sm" onClick={add}>+ הוספת עמדה</button>
        </div>
        <p className="small muted" style={{ marginBottom: 8 }}>מיקום על המפה: אופקי 0–1000 (0 = קצה שמאל), אנכי 0–780 (0 = למעלה). הבריכה עצמה בטווח 230–830 אופקי ו-90–550 אנכי.</p>
        <div className="tblwrap" style={{ maxHeight: 380, overflow: 'auto' }}>
          <table className="jud-table">
            <thead><tr><th>שם העמדה</th><th>תפקיד ברירת מחדל</th><th>אופקי</th><th>אנכי</th><th></th></tr></thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td><input className="jud-input" value={p.label} onChange={(e) => update(p.id, { label: e.target.value })} aria-label="שם העמדה" /></td>
                  <td>
                    <select className="jud-input" value={p.defaultRole} onChange={(e) => update(p.id, { defaultRole: e.target.value })} aria-label="תפקיד ברירת מחדל">
                      {!ROLE_OPTIONS.includes(p.defaultRole) && <option value={p.defaultRole}>{p.defaultRole || '—'}</option>}
                      {ROLE_OPTIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                    </select>
                  </td>
                  <td style={{ width: 90 }}><input className="jud-input jud-mono" type="number" min={0} max={1000} value={p.x} onChange={(e) => update(p.id, { x: clamp(Number(e.target.value) || 0, 0, 1000) })} aria-label="מיקום אופקי" /></td>
                  <td style={{ width: 90 }}><input className="jud-input jud-mono" type="number" min={0} max={780} value={p.y} onChange={(e) => update(p.id, { y: clamp(Number(e.target.value) || 0, 0, 780) })} aria-label="מיקום אנכי" /></td>
                  <td><button type="button" className="jud-btn-ghost sm danger" onClick={() => remove(p.id)}>מחיקה</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {err ? <div className="msg err">{err}</div> : (
        <div>
          <div className="lbl">תצוגה מקדימה ({positions.length} עמדות)</div>
          <PoolMap positions={positions} laneCount={lanes} title="תצוגה מקדימה" />
        </div>
      )}
    </Form>
  );
}
