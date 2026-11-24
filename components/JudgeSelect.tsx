'use client';

import { useEffect, useRef, useState } from 'react';
import { matchesSearch } from './tableSort';

export type JudgeOption = { id: string; name: string; note?: string; extra?: string };

// בחירת שופט/ת מרשימה ארוכה: תיבת חיפוש מעל רשימה נפתחת.
// כשהחיפוש מצמצם לשופט/ת אחד/ת, הוא/היא נבחר/ת אוטומטית. ה-select נשלח בטופס בשם name (אם הוגדר).
export default function JudgeSelect({
  judges,
  name,
  value,
  onChange,
  emptyLabel = '— בחירה —',
  required,
}: {
  judges: JudgeOption[];
  name?: string;
  value?: string;
  onChange?: (id: string) => void;
  emptyLabel?: string;
  required?: boolean;
}) {
  const [q, setQ] = useState('');
  const [inner, setInner] = useState('');
  const selected = value ?? inner;
  const set = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };
  // איפוס הטופס (אחרי שמירה מוצלחת) מנקה גם את החיפוש והבחירה
  const selRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const form = selRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setQ('');
      setInner('');
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);
  const shown = judges.filter((j) => j.id === selected || matchesSearch(q, [j.name, j.extra]));

  return (
    <div className="stack" style={{ gap: 6 }}>
      <input
        className="jud-input"
        type="search"
        value={q}
        onChange={(e) => {
          const nq = e.target.value;
          setQ(nq);
          const m = judges.filter((j) => matchesSearch(nq, [j.name, j.extra]));
          if (nq.trim() && m.length === 1) set(m[0].id);
        }}
        placeholder="חיפוש לפי שם"
        aria-label="חיפוש שופט/ת"
      />
      <select ref={selRef} className="jud-input" name={name} required={required} value={selected} onChange={(e) => set(e.target.value)}>
        <option value="">{q.trim() && shown.length === 0 ? '— לא נמצאו שופטים —' : emptyLabel}</option>
        {shown.map((j) => (
          <option key={j.id} value={j.id}>{j.name}{j.note ?? ''}</option>
        ))}
      </select>
    </div>
  );
}
