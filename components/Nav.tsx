'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function Nav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="jud-tabs-scroll" style={{ marginTop: 16, alignItems: 'center' }}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`jud-tab tabs-link ${path.startsWith(t.href) ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
      <button
        type="button"
        className="jud-tab"
        style={{ background: 'none', border: 'none', marginInlineStart: 'auto', font: 'inherit', fontWeight: 600 }}
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        התנתקות
      </button>
    </div>
  );
}
