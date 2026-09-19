import type { ReactNode } from 'react';
import { requireUser, managedCompetitionIds } from '@/lib/authz';
import { fullName } from '@/lib/utils';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const managed = await managedCompetitionIds(user);

  const items = [
    { href: '/profile', label: 'כרטיס שופט/ת' },
    { href: '/competitions', label: 'תחרויות' },
  ];
  if (managed.length) items.push({ href: '/head', label: 'שופטים ראשיים' });
  if (managed.length || user.isAdmin) items.push({ href: '/reports', label: 'דו״חות' });
  if (user.isAdmin) items.push({ href: '/admin', label: 'ניהול' });

  const role = user.isAdmin ? 'מנהל/ת מערכת' : managed.length ? 'שופט/ת ראשי/ת (בתחרות משויכת)' : 'שופט/ת';

  return (
    <>
      <header style={{ background: 'var(--header)', color: '#fff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '18px 20px 0' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="jud-heading" style={{ fontSize: 21, lineHeight: 1.1 }}>שופטי השחייה בישראל</div>
              <div style={{ fontSize: 12.5, opacity: 0.75 }}>אזור אישי לשופטות ושופטי תחרויות שחייה</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
              <div style={{ opacity: 0.75 }}>מחובר/ת כ:</div>
              <div style={{ fontWeight: 600 }}>{fullName(user)} · {role}</div>
            </div>
          </div>
          <Nav items={items} />
        </div>
        <div className="lane-rope" />
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
