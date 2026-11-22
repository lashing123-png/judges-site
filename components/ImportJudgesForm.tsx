'use client';

import { startTransition, useActionState, useState } from 'react';
import { importJudges, type ImportState } from '@/actions/importJudges';

const initial: ImportState = { ok: false, message: '' };

const ACTION_CHIP: Record<string, { label: string; cls: string }> = {
  new: { label: 'חדש/ה', cls: 'chip-ok' },
  update: { label: 'עדכון', cls: 'chip-accent' },
  same: { label: 'ללא שינוי', cls: 'chip-tint' },
};

const fileKeyOf = (f?: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : '');

export default function ImportJudgesForm() {
  const [state, formAction, pending] = useActionState(importJudges, initial);
  const [fileKey, setFileKey] = useState('');
  // מפתח הקובץ שעבורו רצה תצוגה מקדימה מוצלחת; רק אז מותר לייבא
  const [previewedKey, setPreviewedKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');
  if (state.ok && state.mode === 'preview' && submittedKey && previewedKey !== submittedKey) setPreviewedKey(submittedKey);

  return (
    // שליחה ידנית (ולא <form action>) כי React 19 מאפס את הטופס אחרי action, וזה היה מוחק את הקובץ שנבחר
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === 'import' && !window.confirm('לייבא את השופטים מהקובץ? חשבונות חדשים ייווצרו, ושדות ריקים אצל שופטים קיימים יתמלאו.')) return;
        const fd = new FormData(e.currentTarget, submitter);
        setSubmittedKey(fileKey);
        startTransition(() => formAction(fd));
      }}
    >
      <div>
        <label className="lbl">קובץ Excel או CSV (עד 4MB)</label>
        <input
          className="jud-input"
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv,.ods"
          required
          onChange={(e) => setFileKey(fileKeyOf(e.target.files?.[0]))}
        />
      </div>
      <div className="row">
        <button type="submit" name="mode" value="preview" className="jud-btn-ghost" disabled={pending}>
          {pending ? '...' : 'תצוגה מקדימה'}
        </button>
        <button type="submit" name="mode" value="import" className="jud-btn-primary" disabled={pending || !fileKey || previewedKey !== fileKey}>
          ייבוא
        </button>
      </div>
      <p className="small muted">יש להריץ תצוגה מקדימה לפני הייבוא. שום דבר לא נשמר עד הלחיצה על &quot;ייבוא&quot;.</p>

      {state.message && (
        <div className={`msg ${state.ok ? 'ok' : 'err'}`} role="status">
          {state.message}
        </div>
      )}

      {state.ok && state.columns && <div className="small muted">עמודות שזוהו: {state.columns.join(' · ')}</div>}

      {state.ok && state.rows && state.rows.length > 0 && (
        <div className="tblwrap" style={{ maxHeight: 360, overflow: 'auto' }}>
          <table className="jud-table">
            <thead><tr><th>שורה</th><th>שם</th><th>מייל</th><th>פעולה</th><th>שדות שיתמלאו</th></tr></thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.line}>
                  <td className="jud-mono muted">{r.line}</td>
                  <td>{r.name}</td>
                  <td dir="ltr" style={{ textAlign: 'right' }}>{r.email}</td>
                  <td><span className={`jud-chip ${ACTION_CHIP[r.action].cls}`}>{ACTION_CHIP[r.action].label}</span></td>
                  <td className="small">{r.fields.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.ok && state.skipped && state.skipped.length > 0 && (
        <details>
          <summary className="small">שורות שדולגו ({state.skipped.length})</summary>
          <ul className="small muted" style={{ marginTop: 6 }}>
            {state.skipped.map((s) => (<li key={s.line}>שורה {s.line}: {s.reason}</li>))}
          </ul>
        </details>
      )}
    </form>
  );
}
