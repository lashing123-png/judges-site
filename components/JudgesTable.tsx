'use client';

import Link from 'next/link';
import { useState } from 'react';
import Form from './Form';
import { resetPassword, setAdmin, setStatus } from '@/actions/admin';
import { SortTh, matchesSearch, useTableSort } from './tableSort';

export type JudgeRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  club: string;
  phone: string;
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  isAdmin: boolean;
};

const STATUS: Record<JudgeRow['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'פעיל/ה', cls: 'chip-ok' },
  PENDING: { label: 'ממתין/ה לאישור', cls: 'chip-accent' },
  DISABLED: { label: 'מושבת/ת', cls: 'chip-lock' },
};

type Key = 'name' | 'email' | 'club' | 'status' | 'role';

export default function JudgesTable({ users, meId }: { users: JudgeRow[]; meId: string }) {
  const [q, setQ] = useState('');
  const sort = useTableSort<Key>('name');

  const shown = sort.sort(
    users.filter((u) => matchesSearch(q, [u.firstName, u.lastName, u.email, u.club, u.phone])),
    (u, k) =>
      k === 'name' ? `${u.lastName} ${u.firstName}`
      : k === 'email' ? u.email
      : k === 'club' ? u.club || '￿' // בלי אגודה בסוף
      : k === 'status' ? STATUS[u.status].label
      : u.isAdmin ? 0 : 1,
  );

  return (
    <div className="stack">
      <div className="row">
        <input
          className="jud-input"
          style={{ flex: '1 1 260px', width: 'auto' }}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם, מייל, אגודה או טלפון"
          aria-label="חיפוש שופטים"
        />
        <span className="small muted">{q ? `${shown.length} מתוך ${users.length}` : `${users.length} שופטים`}</span>
      </div>
      <div className="tblwrap">
        <table className="jud-table">
          <thead>
            <tr>
              <SortTh k="name" label="שם" sort={sort} />
              <SortTh k="email" label="מייל" sort={sort} />
              <SortTh k="club" label="אגודה" sort={sort} />
              <SortTh k="status" label="סטטוס" sort={sort} />
              <SortTh k="role" label="הרשאה" sort={sort} />
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="muted">לא נמצאו שופטים התואמים לחיפוש.</td></tr>
            )}
            {shown.map((u) => (
              <tr key={u.id} style={{ opacity: u.status === 'DISABLED' ? 0.6 : 1 }}>
                <td style={{ fontWeight: 600 }}><Link href={`/profile/${u.id}`}>{u.firstName} {u.lastName}</Link></td>
                <td dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td>
                <td className="small">{u.club}</td>
                <td><span className={`jud-chip ${STATUS[u.status].cls}`}>{STATUS[u.status].label}</span></td>
                <td>{u.isAdmin ? <span className="jud-chip chip-tint">מנהל/ת מערכת</span> : 'שופט/ת'}</td>
                <td>
                  {u.id === meId ? (
                    <span className="small muted">החשבון שלך</span>
                  ) : (
                    <div className="row" style={{ gap: 6 }}>
                      <Form action={setAdmin} submit={u.isAdmin ? 'ביטול אדמין' : 'הפוך/י לאדמין'} submitClass="jud-btn-ghost sm" confirm={u.isAdmin ? 'לבטל הרשאת אדמין?' : 'לתת הרשאת אדמין מלאה?'} inline><input type="hidden" name="userId" value={u.id} /></Form>
                      <Form action={setStatus} submit={u.status === 'ACTIVE' ? 'השבתה' : 'הפעלה'} submitClass={`jud-btn-ghost sm ${u.status === 'ACTIVE' ? 'danger' : ''}`} inline><input type="hidden" name="userId" value={u.id} /></Form>
                      <Form action={resetPassword} submit="איפוס סיסמה" submitClass="jud-btn-ghost sm" confirm="ליצור סיסמה זמנית חדשה?" inline><input type="hidden" name="userId" value={u.id} /></Form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
