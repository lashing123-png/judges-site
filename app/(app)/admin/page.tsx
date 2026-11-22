import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/authz';
import Form from '@/components/Form';
import ImportJudgesForm from '@/components/ImportJudgesForm';
import { approveUser, createUser, rejectUser, resetPassword, setAdmin, setStatus } from '@/actions/admin';
import { fullName } from '@/lib/utils';

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'פעיל/ה', cls: 'chip-ok' },
  PENDING: { label: 'ממתין/ה לאישור', cls: 'chip-accent' },
  DISABLED: { label: 'מושבת/ת', cls: 'chip-lock' },
};

export default async function AdminUsers() {
  const me = await requireAdminPage();
  const users = await prisma.user.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
  const pending = users.filter((u) => u.status === 'PENDING');
  const others = users.filter((u) => u.status !== 'PENDING');

  return (
    <div className="stack">
      <div className="card">
        <h2 className="jud-heading h2" style={{ marginBottom: 10 }}>בקשות הרשמה ממתינות ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="muted small">אין בקשות ממתינות.</div>
        ) : (
          <div className="tblwrap">
            <table className="jud-table">
              <thead><tr><th>שם</th><th>מייל</th><th>אגודה</th><th>טלפון</th><th>נרשם/ה</th><th></th></tr></thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{fullName(u)}</td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td>
                    <td>{u.club}</td>
                    <td className="jud-mono">{u.phone}</td>
                    <td className="jud-mono small">{u.createdAt.toLocaleDateString('he-IL')}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <Form action={approveUser} submit="אישור" submitClass="jud-btn-primary" inline><input type="hidden" name="userId" value={u.id} /></Form>
                        <Form action={rejectUser} submit="דחייה" submitClass="jud-btn-ghost sm danger" confirm={`לדחות ולמחוק את הבקשה של ${fullName(u)}?`} inline><input type="hidden" name="userId" value={u.id} /></Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="jud-heading h2" style={{ marginBottom: 10 }}>שופטים וחשבונות</h2>
        <div className="tblwrap">
          <table className="jud-table">
            <thead><tr><th>שם</th><th>מייל</th><th>סטטוס</th><th>הרשאה</th><th>פעולות</th></tr></thead>
            <tbody>
              {others.map((u) => (
                <tr key={u.id} style={{ opacity: u.status === 'DISABLED' ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 600 }}><Link href={`/profile/${u.id}`}>{fullName(u)}</Link></td>
                  <td dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td>
                  <td><span className={`jud-chip ${STATUS[u.status].cls}`}>{STATUS[u.status].label}</span></td>
                  <td>{u.isAdmin ? <span className="jud-chip chip-tint">מנהל/ת מערכת</span> : 'שופט/ת'}</td>
                  <td>
                    {u.id === me.id ? (
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

      <div className="card">
        <h3 className="jud-heading h3" style={{ marginBottom: 10 }}>ייבוא שופטים מקובץ</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          ייבוא מקובץ Excel או CSV, למשל ייצוא בעלי התפקידים של איגוד השחייה. העמודות מזוהות לפי הכותרת (שם פרטי, שם משפחה, מייל, טלפון, אגודה, ותק), והמייל משמש לזיהוי.
          שופטים חדשים נוצרים כחשבונות פעילים ללא סיסמה ידועה: כדי לתת גישה, יש ללחוץ &quot;איפוס סיסמה&quot; ולהעביר את הסיסמה הזמנית. אצל שופטים קיימים מתמלאים רק שדות ריקים.
          תעודת זהות, תאריך לידה וכתובת אינם מיובאים.
        </p>
        <ImportJudgesForm />
      </div>

      <div className="card">
        <h3 className="jud-heading h3" style={{ marginBottom: 10 }}>יצירת חשבון ע״י מנהל/ת</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>נוצר חשבון פעיל עם סיסמה זמנית שמוצגת פעם אחת. יש להעביר אותה לשופט/ת, והוא/היא יכול/ה להחליף אותה בעמוד הכרטיס.</p>
        <Form action={createUser} submit="יצירת חשבון" className="stack" resetOnOk>
          <div className="grid3">
            <div><label className="lbl">שם פרטי</label><input className="jud-input" name="firstName" required /></div>
            <div><label className="lbl">שם משפחה</label><input className="jud-input" name="lastName" required /></div>
            <div><label className="lbl">מייל</label><input className="jud-input" type="email" dir="ltr" name="email" required /></div>
            <div><label className="lbl">אגודה</label><input className="jud-input" name="club" /></div>
            <div><label className="lbl">טלפון</label><input className="jud-input jud-mono" name="phone" /></div>
          </div>
        </Form>
      </div>
    </div>
  );
}
