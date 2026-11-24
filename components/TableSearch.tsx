'use client';

import { useEffect, useState } from 'react';
import { matchesSearch } from './tableSort';

// תיבת חיפוש לטבלאות שמרונדרות בשרת: מסתירה שורות <tr data-search="..."> שלא תואמות,
// בכל האלמנטים שתואמים ל-scope (selector). כך לא צריך להפוך את הטבלה עצמה לרכיב לקוח.
export default function TableSearch({ scope, placeholder = 'חיפוש שופט/ת לפי שם', label = 'חיפוש שופטים' }: { scope: string; placeholder?: string; label?: string }) {
  const [q, setQ] = useState('');
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const apply = () => {
      let shown = 0, total = 0;
      document.querySelectorAll<HTMLTableRowElement>(`${scope} tr[data-search]`).forEach((tr) => {
        const ok = matchesSearch(q, [tr.dataset.search]);
        tr.hidden = !ok;
        total++;
        if (ok) shown++;
      });
      const next = q.trim() ? { shown, total } : null;
      setCount((c) => (c?.shown === next?.shown && c?.total === next?.total ? c : next));
    };
    apply();
    // אחרי רענון מהשרת (שיבוץ, סימון נוכחות) השורות מתחלפות: מחילים שוב
    const root = document.querySelector('main') ?? document.body;
    const obs = new MutationObserver(() => apply());
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [q, scope]);

  return (
    <div className="row" style={{ marginBottom: 10 }}>
      <input
        className="jud-input"
        style={{ flex: '1 1 240px', width: 'auto' }}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {count && <span className="small muted">{count.shown === 0 ? 'לא נמצאו שופטים' : `${count.shown} מתוך ${count.total}`}</span>}
    </div>
  );
}
