import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/authz';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage(); // גם כל פעולה בשרת בודקת הרשאת אדמין בנפרד
  const tabs = [
    { href: '/admin', label: 'שופטים וחשבונות' },
    { href: '/admin/competitions', label: 'תחרויות' },
    { href: '/admin/layouts', label: 'תבניות מפת בריכה' },
    { href: '/admin/audit', label: 'יומן פעולות' },
  ];
  return (
    <div className="stack">
      <div className="subtabs">
        {tabs.map((t) => (<Link key={t.href} href={t.href} className="subtab" style={{ textDecoration: 'none' }}>{t.label}</Link>))}
      </div>
      {children}
    </div>
  );
}
