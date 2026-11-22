import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/authz';
import Form from '@/components/Form';
import LayoutForm from '@/components/LayoutForm';
import { deleteLayout, duplicateLayout } from '@/actions/admin';
import { defaultPositions, type Position } from '@/lib/poolLayout';

export default async function AdminLayouts(props: { searchParams: Promise<{ edit?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdminPage();
  const layouts = await prisma.poolLayout.findMany({ orderBy: { name: 'asc' } });
  const editing = searchParams.edit === 'new' ? 'new' : layouts.find((l) => l.id === searchParams.edit) ?? null;
  const initial =
    editing === 'new'
      ? { name: '', laneCount: 10, isDefault: false, positions: defaultPositions(10) }
      : editing
        ? { id: editing.id, name: editing.name, laneCount: editing.laneCount, isDefault: editing.isDefault, positions: editing.positions as unknown as Position[] }
        : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="jud-heading h2">תבניות מפת בריכה</h2>
          <Link href="/admin/layouts?edit=new" className="jud-btn-primary" style={{ textDecoration: 'none' }}>+ תבנית חדשה</Link>
        </div>
        <div className="tblwrap">
          <table className="jud-table">
            <thead><tr><th>שם</th><th>מסלולים</th><th>עמדות</th><th></th><th></th></tr></thead>
            <tbody>
              {layouts.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>אין תבניות. הריצו npm run db:seed או צרו תבנית חדשה.</td></tr>}
              {layouts.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.name}</td>
                  <td className="jud-mono">{l.laneCount}</td>
                  <td className="jud-mono">{Array.isArray(l.positions) ? l.positions.length : 0}</td>
                  <td>{l.isDefault && <span className="jud-chip chip-accent">ברירת מחדל</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <Link href={`/admin/layouts?edit=${l.id}`} className="jud-btn-ghost sm" style={{ textDecoration: 'none' }}>עריכה</Link>
                      <Form action={duplicateLayout} submit="שכפול" submitClass="jud-btn-ghost sm" inline><input type="hidden" name="id" value={l.id} /></Form>
                      <Form action={deleteLayout} submit="מחיקה" submitClass="jud-btn-ghost sm danger" confirm={`למחוק את התבנית "${l.name}"?`} inline><input type="hidden" name="id" value={l.id} /></Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {initial && (
        <div className="card" key={editing === 'new' ? 'new' : (editing as { id: string }).id}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="jud-heading h3">{'id' in initial && initial.id ? `עריכת ${initial.name}` : 'תבנית חדשה'}</h3>
            <Link href="/admin/layouts" className="jud-btn-ghost sm" style={{ textDecoration: 'none' }}>סגירה</Link>
          </div>
          <LayoutForm initial={initial} />
        </div>
      )}
    </div>
  );
}
