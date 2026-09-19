import Link from 'next/link';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="authbox">
      <div className="card stack">
        <div>
          <h1 className="jud-heading" style={{ fontSize: 24 }}>שופטי השחייה בישראל</h1>
          <p className="muted small">התחברות לאזור האישי</p>
        </div>
        <LoginForm />
        <p className="small muted">
          עדיין אין לך חשבון? <Link href="/register">הרשמה כשופט/ת</Link>
        </p>
      </div>
    </div>
  );
}
