import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import ProfileView from '@/components/ProfileView';

// צפייה בכרטיס של שופט/ת אחר/ת: אדמין בלבד
export default async function OtherProfile({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const me = await requireUser();
  if (!me.isAdmin) redirect('/profile');
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) notFound();
  return <ProfileView target={target} viewer={me} basePath={`/profile/${target.id}`} sp={searchParams} />;
}
