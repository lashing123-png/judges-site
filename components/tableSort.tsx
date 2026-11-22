'use client';

import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

// מיון לפי עמודה: לחיצה על כותרת ממיינת, לחיצה נוספת הופכת את הכיוון
export function useTableSort<K extends string>(initialKey: K, initialDir: SortDir = 'asc') {
  const [key, setKey] = useState<K>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const toggle = (k: K) => {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setKey(k);
      setDir('asc');
    }
  };
  function sort<T>(rows: T[], value: (row: T, key: K) => string | number): T[] {
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = value(a, key);
      const vb = value(b, key);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
      return c * sign;
    });
  }
  return { key, dir, toggle, sort };
}

export function SortTh<K extends string>({ k, label, sort }: { k: K; label: string; sort: { key: K; dir: SortDir; toggle: (k: K) => void } }) {
  const active = sort.key === k;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sort-th ${active ? 'on' : ''}`} onClick={() => sort.toggle(k)}>
        {label}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
      </button>
    </th>
  );
}

// התאמת חיפוש: כל המילים שהוקלדו צריכות להופיע באחד השדות (בלי תלות באותיות גדולות/קטנות)
export function matchesSearch(q: string, fields: (string | number | null | undefined)[]) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map((f) => String(f ?? '').toLowerCase()).join(' ');
  return words.every((w) => hay.includes(w));
}
