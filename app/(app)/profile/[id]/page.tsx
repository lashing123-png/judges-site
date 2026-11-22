import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import ProfileView from '@/components/ProfileView';

// צפייה בכרטיס של שופט/ת אחר/ת: אדמין בלבד
export default async function OtherProfile(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const me = await requireUser();
  if (!me.isAdmin) redirect('/profile');
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) notFound();
  return <ProfileView target={target} viewer={me} basePath={`/profile/${target.id}`} sp={searchParams} />;
}
