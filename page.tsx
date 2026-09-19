import Link from 'next/link';
import Form from '@/components/Form';
import { registerAction } from '@/actions/auth';

export default function RegisterPage() {
  return (
    <div className="authbox">
      <div className="card stack">
        <div>
          <h1 className="jud-heading" style={{ fontSize: 24 }}>הרשמה כשופט/ת</h1>
          <p className="muted small">לאחר ההרשמה, החשבון יופעל רק אחרי אישור מנהל/ת המערכת.</p>
        </div>
        <Form action={registerAction} submit="שליחת בקשת הרשמה" className="stack" resetOnOk>
          <div className="grid2">
            <div><label className="lbl">שם פרטי</label><input className="jud-input" name="firstName" required /></div>
            <div><label className="lbl">שם משפחה</label><input className="jud-input" name="lastName" required /></div>
          </div>
          <div><label className="lbl">כתובת מייל</label><input className="jud-input" type="email" dir="ltr" name="email" autoComplete="email" required /></div>
          <div className="grid2">
            <div><label className="lbl">אגודה</label><input className="jud-input" name="club" /></div>
            <div><label className="lbl">טלפון</label><input className="jud-input jud-mono" name="phone" inputMode="tel" /></div>
          </div>
          <div className="grid2">
            <div><label className="lbl">סיסמה (לפחות 8 תווים)</label><input className="jud-input" type="password" dir="ltr" name="password" autoComplete="new-password" minLength={8} required /></div>
            <div><label className="lbl">אימות סיסמה</label><input className="jud-input" type="password" dir="ltr" name="confirm" autoComplete="new-password" minLength={8} required /></div>
          </div>
          {/* שדה מלכודת לבוטים: מוסתר ממשתמשים */}
          <input name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true" />
        </Form>
        <p className="small muted">
          כבר יש לך חשבון? <Link href="/login">התחברות</Link>
        </p>
      </div>
    </div>
  );
}
