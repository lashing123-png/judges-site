'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const ERRORS: Record<string, string> = {
  PENDING: 'החשבון שלך ממתין לאישור מנהל/ת המערכת. תוכלו להתחבר לאחר האישור.',
  DISABLED: 'החשבון הושבת. יש לפנות למנהל/ת המערכת.',
  INVALID: 'מייל או סיסמה שגויים.',
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setErr(ERRORS[res.error] ?? 'ההתחברות נכשלה. נסו שוב.');
    else {
      router.push('/profile');
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
      <div><label className="lbl">כתובת מייל</label><input className="jud-input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="lbl">סיסמה</label><input className="jud-input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <button className="jud-btn-primary" disabled={busy} type="submit">{busy ? '...' : 'התחברות'}</button>
      {err && <div className="msg err">{err}</div>}
    </form>
  );
}
