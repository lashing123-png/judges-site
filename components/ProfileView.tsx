import { prisma } from '@/lib/prisma';
import Form from './Form';
import { updateProfile, changePassword } from '@/actions/profile';
import { fullName, seasonOf, sessionsOf } from '@/lib/utils';
import DateText from './DateText';
import { EXPERIENCE_ROLES, parseExperienceRoles } from '@/lib/constants';
import type { User } from '@prisma/client';

type SP = { season?: string; name?: string; loc?: string; role?: string };

export default async function ProfileView({ target, viewer, basePath, sp }: { target: User; viewer: User; basePath: string; sp: SP }) {
  const own = target.id === viewer.id;
  const admin = viewer.isAdmin;
  const targetRoles = parseExperienceRoles(target.roleExperience);
  const legacyRoles = targetRoles.filter((r) => !EXPERIENCE_ROLES.includes(r));

  // שיבוצים באתר + היסטוריית שיפוט מיובאת (מלפני האתר)
  const [assigns, history] = await Promise.all([
    prisma.assignment.findMany({ where: { judgeId: target.id }, include: { competition: true } }),
    prisma.judgingHistory.findMany({ where: { judgeId: target.id } }),
  ]);
  const rows = [
    ...assigns.map((a) => ({
      key: a.id,
      compName: a.competition.name,
      date: a.competition.date as Date | null,
      location: a.competition.location,
      session: sessionsOf(a.competition.sessions).find((x) => x.id === a.sessionId)?.label ?? '',
      role: a.role,
      label: a.positionLabel || a.role,
      season: seasonOf(a.competition.date),
      imported: false,
    })),
    ...history.map((h) => ({
      key: h.id,
      compName: h.competition,
      date: h.date,
      location: h.location,
      session: '',
      role: h.role,
      label: h.role,
      season: h.date ? seasonOf(h.date) : h.season ? `${h.season - 1}/${h.season}` : '',
      imported: true,
    })),
  ].sort((x, y) => (y.date?.getTime() ?? 0) - (x.date?.getTime() ?? 0));

  const seasons = Array.from(new Set(rows.map((r) => r.season).filter(Boolean))).sort().reverse();
  const roles = Array.from(new Set(rows.map((r) => r.role)));
  const q = (sp.name ?? '').toLowerCase();
  const l = (sp.loc ?? '').toLowerCase();
  const shown = rows.filter(
    (r) => (!sp.season || r.season === sp.season) && (!q || r.compName.toLowerCase().includes(q)) && (!l || r.location.toLowerCase().includes(l)) && (!sp.role || r.role === sp.role),
  );

  return (
    <div className="stack">
      <div className="card">
        <h2 className="jud-heading h2" style={{ marginBottom: 16 }}>
          כרטיס פרטים אישיים{!own && ` — ${fullName(target)}`}
        </h2>
        <Form action={updateProfile} submit="שמירה" className="stack">
          <input type="hidden" name="userId" value={target.id} />
          <div className="grid2">
            <div><label className="lbl">שם פרטי</label><input className="jud-input" name="firstName" defaultValue={target.firstName} disabled={!admin} /></div>
            <div><label className="lbl">שם משפחה</label><input className="jud-input" name="lastName" defaultValue={target.lastName} disabled={!admin} /></div>
            <div><label className="lbl">אגודה</label><input className="jud-input" name="club" defaultValue={target.club} /></div>
            <div><label className="lbl">מספר טלפון</label><input className="jud-input jud-mono" name="phone" defaultValue={target.phone} /></div>
            <div><label className="lbl">כתובת מייל</label><input className="jud-input" dir="ltr" name="email" defaultValue={target.email} /></div>
            <div>
              <label className="lbl">ותק (שנה, חודש)</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="jud-input jud-mono" type="number" name="seniorityYear" defaultValue={target.seniorityYear ?? ''} placeholder="שנה" />
                <input className="jud-input jud-mono" type="number" name="seniorityMonth" defaultValue={target.seniorityMonth ?? ''} placeholder="חודש" />
              </div>
            </div>
          </div>
          <div>
            <div className="row between" style={{ marginBottom: 4 }}>
              <h3 className="jud-heading h3">ניסיון ותפקידים</h3>
              <span className={`jud-chip ${admin ? 'chip-ok' : 'chip-lock'}`}>{admin ? 'ניתן לעריכה (מנהל/ת)' : 'לעריכת מנהל/ת בלבד'}</span>
            </div>
            <p className="small muted" style={{ marginBottom: 12 }}>שדות אלה מתעדכנים רק ע״י מנהל/ת המערכת.</p>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">ניסיון בתפקידים</label>
              <div className="row">
                {EXPERIENCE_ROLES.map((r) => (
                  <label key={r} className="opt">
                    <input type="checkbox" name="roleExperience" value={r} defaultChecked={targetRoles.includes(r)} disabled={!admin} /> {r}
                  </label>
                ))}
              </div>
              {legacyRoles.length > 0 && (
                <p className="small muted" style={{ marginTop: 6 }}>ערך קודם שאינו ברשימה: {legacyRoles.join(', ')}</p>
              )}
            </div>
            <div className="grid2">
              <div><label className="lbl">השתתפות בקורסים</label><textarea className="jud-input" rows={2} name="courses" defaultValue={target.courses} disabled={!admin} /></div>
              <div><label className="lbl">השתתפות בתחרויות בינ״ל</label><textarea className="jud-input" rows={2} name="internationalComps" defaultValue={target.internationalComps} disabled={!admin} /></div>
            </div>
          </div>
        </Form>
      </div>

      <div className="card">
        <h3 className="jud-heading h3" style={{ marginBottom: 12 }}>התחרויות שבהן {own ? 'השתתפתי' : 'השתתפ/ה'}</h3>
        <form method="get" action={basePath} className="grid2" style={{ marginBottom: 16 }}>
          <div>
            <label className="lbl">עונה</label>
            <select className="jud-input" name="season" defaultValue={sp.season ?? ''}>
              <option value="">כל העונות</option>
              {seasons.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div><label className="lbl">שם התחרות</label><input className="jud-input" name="name" defaultValue={sp.name ?? ''} placeholder="חיפוש לפי שם" /></div>
          <div><label className="lbl">מיקום</label><input className="jud-input" name="loc" defaultValue={sp.loc ?? ''} placeholder="חיפוש לפי מיקום" /></div>
          <div>
            <label className="lbl">תפקיד שבוצע</label>
            <select className="jud-input" name="role" defaultValue={sp.role ?? ''}>
              <option value="">כל התפקידים</option>
              {roles.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </div>
          <div className="row"><button className="jud-btn-ghost" type="submit">סינון</button><a href={basePath} className="small">ניקוי</a></div>
        </form>
        {rows.length === 0 ? (
          <div className="muted">טרם שובצ/ה לתפקיד באף תחרות.</div>
        ) : shown.length === 0 ? (
          <div className="muted">אין תוצאות התואמות את הסינון שנבחר.</div>
        ) : (
          <div className="tblwrap">
            <table className="jud-table">
              <thead><tr><th>עונה</th><th>תחרות</th><th>תאריך</th><th>מיקום</th><th>הצגה</th><th>תפקיד</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    <td className="jud-mono muted">{r.season}</td>
                    <td>{r.compName}</td>
                    <td>{r.date ? <DateText date={r.date} /> : '—'}</td>
                    <td>{r.location || '—'}</td>
                    <td className="small">{r.session || (r.imported ? 'היסטוריה' : '—')}</td>
                    <td><span className="jud-chip chip-accent">{r.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {own && (
        <div className="card">
          <h3 className="jud-heading h3" style={{ marginBottom: 12 }}>שינוי סיסמה</h3>
          <Form action={changePassword} submit="עדכון סיסמה" className="stack" resetOnOk>
            <div className="grid3">
              <div><label className="lbl">סיסמה נוכחית</label><input className="jud-input" type="password" dir="ltr" name="current" autoComplete="current-password" required /></div>
              <div><label className="lbl">סיסמה חדשה</label><input className="jud-input" type="password" dir="ltr" name="next" autoComplete="new-password" minLength={8} required /></div>
              <div><label className="lbl">אימות סיסמה</label><input className="jud-input" type="password" dir="ltr" name="confirm" autoComplete="new-password" minLength={8} required /></div>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
}
