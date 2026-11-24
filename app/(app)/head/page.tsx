import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser, managedCompetitionIds } from '@/lib/authz';
import DateText from '@/components/DateText';

export default async function HeadIndex() {
  const user = await requireUser();
  const ids = await managedCompetitionIds(user);
  if (ids.length === 0)
    return (
      <div className="notice lock">
        <div>
          <div style={{ fontWeight: 700, color: 'var(--lock)', marginBottom: 4 }}>עמוד זה מיועד למנהלי מערכת ולשופטים ראשיים בתחרות המשויכת להם</div>
          <div className="muted" style={{ fontSize: 13.5 }}>אם אמורה להיות לך גישה, יש לפנות למנהל/ת המערכת לשיוך כשופט/ת ראשי/ת לתחרות.</div>
        </div>
      </div>
    );
  const comps = await prisma.competition.findMany({ where: { id: { in: ids } }, orderBy: { date: 'asc' } });
  if (comps.length === 1) redirect(`/head/${comps[0].id}`);
  return (
    <div className="card">
      <h2 className="jud-heading h2" style={{ marginBottom: 12 }}>בחירת תחרות</h2>
      <div className="stack" style={{ gap: 8 }}>
        {comps.map((c) => (
          <Link key={c.id} href={`/head/${c.id}`} className="person">
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <DateText className="jud-mono muted" date={c.date} end={c.endDate} />
          </Link>
        ))}
      </div>
    </div>
  );
}
