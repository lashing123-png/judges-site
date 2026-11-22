import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { iso } from '@/lib/utils';

type SP = { q?: string; loc?: string; sort?: string; dir?: string };

export default async function CompetitionsPage(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const sort = ['name', 'date', 'location'].includes(searchParams.sort ?? '') ? (searchParams.sort as string) : 'date';
  const dir = searchParams.dir === 'desc' ? 'desc' : 'asc';
  const comps = await prisma.competition.findMany({
    where: {
      name: { contains: searchParams.q ?? '', mode: 'insensitive' },
      location: { contains: searchParams.loc ?? '', mode: 'insensitive' },
    },
    orderBy: { [sort]: dir },
  });
  const mine = new Set((await prisma.registration.findMany({ where: { judgeId: user.id }, select: { competitionId: true } })).map((r) => r.competitionId));

  const sortHref = (k: string) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set('q', searchParams.q);
    if (searchParams.loc) p.set('loc', searchParams.loc);
    p.set('sort', k);
    p.set('dir', sort === k && dir === 'asc' ? 'desc' : 'asc');
    return `/competitions?${p.toString()}`;
  };

  return (
    <div className="card">
      <h2 className="jud-heading h2" style={{ marginBottom: 14 }}>לוח תחרויות</h2>
      <form method="get" className="row" style={{ marginBottom: 16 }}>
        <input className="jud-input" style={{ flex: '1 1 220px', width: 'auto' }} name="q" defaultValue={searchParams.q ?? ''} placeholder="סינון לפי שם תחרות" />
        <input className="jud-input" style={{ flex: '1 1 220px', width: 'auto' }} name="loc" defaultValue={searchParams.loc ?? ''} placeholder="סינון לפי מיקום" />
        <button className="jud-btn-ghost" type="submit">סינון</button>
      </form>
      <div className="tblwrap">
        <table className="jud-table">
          <thead>
            <tr>
              <th className="jud-mono">מס׳</th>
              <th><Link href={sortHref('name')}>שם התחרות ↕</Link></th>
              <th><Link href={sortHref('date')}>תאריך ↕</Link></th>
              <th><Link href={sortHref('location')}>מיקום ↕</Link></th>
              <th>תקנון</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id}>
                <td className="jud-mono muted">{c.number}</td>
                <td style={{ fontWeight: 600 }}>{c.name} {mine.has(c.id) && <span className="jud-chip chip-ok">נרשמת</span>}</td>
                <td className="jud-mono">{iso(c.date)}</td>
                <td>{c.location}</td>
                <td>{c.statuteUrl ? <a href={c.statuteUrl} target="_blank" rel="noreferrer">תקנון ↗</a> : '—'}</td>
                <td><Link className="jud-btn-ghost" href={`/competitions/${c.id}`}>לעמוד התחרות ›</Link></td>
              </tr>
            ))}
            {comps.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>אין תחרויות התואמות את הסינון</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
