import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { competitionPassed } from '@/lib/utils';
import DateText from '@/components/DateText';
import SubmitCheckbox from '@/components/SubmitCheckbox';

type SP = { q?: string; loc?: string; sort?: string; dir?: string; past?: string };

export default async function CompetitionsPage(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const sort = ['name', 'date', 'location'].includes(searchParams.sort ?? '') ? (searchParams.sort as string) : 'date';
  const dir = searchParams.dir === 'desc' ? 'desc' : 'asc';
  // ברירת מחדל: רק תחרויות מהיום והלאה (שעון ישראל; תחרות של כמה ימים מוצגת עד היום האחרון שלה). past=1 מציג גם עבר
  const showPast = searchParams.past === '1';
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + 'T00:00:00Z');
  const comps = await prisma.competition.findMany({
    where: {
      name: { contains: searchParams.q ?? '', mode: 'insensitive' },
      location: { contains: searchParams.loc ?? '', mode: 'insensitive' },
      ...(showPast ? {} : { OR: [{ date: { gte: today } }, { endDate: { gte: today } }] }),
    },
    orderBy: { [sort]: dir },
  });
  const mine = new Set((await prisma.registration.findMany({ where: { judgeId: user.id }, select: { competitionId: true } })).map((r) => r.competitionId));

  const sortHref = (k: string) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set('q', searchParams.q);
    if (searchParams.loc) p.set('loc', searchParams.loc);
    if (showPast) p.set('past', '1');
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
        {searchParams.sort && <input type="hidden" name="sort" value={sort} />}
        {searchParams.dir && <input type="hidden" name="dir" value={dir} />}
        <button className="jud-btn-ghost" type="submit">סינון</button>
        <SubmitCheckbox name="past" checked={showPast} label="הצגת תחרויות עבר" />
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
                <td><DateText date={c.date} end={c.endDate} /></td>
                <td>{c.location}</td>
                <td>{c.statuteUrl ? <a href={c.statuteUrl} target="_blank" rel="noreferrer">תקנון ↗</a> : '—'}</td>
                <td>
                  <Link className={!mine.has(c.id) && !competitionPassed(c.date) ? 'jud-btn-primary' : 'jud-btn-ghost'} style={{ textDecoration: 'none', whiteSpace: 'nowrap' }} href={`/competitions/${c.id}`}>
                    {!mine.has(c.id) && !competitionPassed(c.date) ? 'הרשמה ›' : 'לעמוד התחרות ›'}
                  </Link>
                </td>
              </tr>
            ))}
            {comps.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>אין תחרויות התואמות את הסינון</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
