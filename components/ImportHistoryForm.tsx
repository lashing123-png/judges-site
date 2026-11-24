'use client';

import { startTransition, useActionState, useState } from 'react';
import { importHistory, type HistoryImportState } from '@/actions/importHistory';

const initial: HistoryImportState = { ok: false, message: '' };
const fileKeyOf = (f?: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : '');

export default function ImportHistoryForm({ current }: { current: { rows: number; linked: number } }) {
  const [state, formAction, pending] = useActionState(importHistory, initial);
  const [fileKey, setFileKey] = useState('');
  const [previewedKey, setPreviewedKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');
  if (state.ok && state.mode === 'preview' && submittedKey && previewedKey !== submittedKey) setPreviewedKey(submittedKey);

  return (
    // שליחה ידנית כדי ש-React לא יאפס את הקובץ שנבחר אחרי התצוגה המקדימה
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === 'import' && !window.confirm('לייבא את ההיסטוריה מהקובץ? ההיסטוריה המיובאת הקיימת תוחלף בתוכן הקובץ. שיבוצים שנעשו באתר לא מושפעים.')) return;
        const fd = new FormData(e.currentTarget, submitter);
        setSubmittedKey(fileKey);
        startTransition(() => formAction(fd));
      }}
    >
      <p className="small muted">
        כרגע במערכת: {current.rows} שורות היסטוריה, מתוכן {current.linked} מקושרות לשופטים באתר.
        הקובץ צריך לכלול את העמודות: עונה, שם התחרות, תאריך, מיקום, גילאים, אזורי/ארצי, שם השופט, תפקיד (כמו לשונית Database בגיליון השופטים).
      </p>
      <div>
        <label className="lbl">קובץ Excel או CSV (עד 4MB)</label>
        <input className="jud-input" type="file" name="file" accept=".xlsx,.xls,.csv,.ods" onChange={(e) => setFileKey(fileKeyOf(e.target.files?.[0]))} />
      </div>
      <div className="row">
        <button type="submit" name="mode" value="preview" className="jud-btn-ghost" disabled={pending || !fileKey}>{pending ? '...' : 'תצוגה מקדימה'}</button>
        <button type="submit" name="mode" value="import" className="jud-btn-primary" disabled={pending || !fileKey || previewedKey !== fileKey}>ייבוא</button>
        <button type="submit" name="mode" value="relink" className="jud-btn-ghost" disabled={pending} title="לאחר הוספת שופטים או תיקון שמות">קישור מחדש לפי שם</button>
      </div>
      {state.message && (
        <div className={`msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</div>
      )}
      {state.ok && state.unlinked && state.unlinked.length > 0 && (
        <details>
          <summary className="small">שמות מהקובץ שלא נמצאו באתר ({state.unlinked.length})</summary>
          <p className="small muted" style={{ margin: '6px 0' }}>
            השורות שלהם נשמרות לפי שם. אם מדובר בשופט/ת קיים/ת עם איות שונה, אפשר לתקן את השם בכרטיס השופט/ת (או בקובץ) וללחוץ &quot;קישור מחדש לפי שם&quot;.
          </p>
          <div className="small muted" style={{ columns: 3, columnGap: 18 }}>
            {state.unlinked.map((u) => (<div key={u.name}>{u.name} ({u.rows})</div>))}
          </div>
        </details>
      )}
    </form>
  );
}
