import { requireUser } from '@/lib/authz';
import ProfileView from '@/components/ProfileView';

export default async function ProfilePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const me = await requireUser();
  return <ProfileView target={me} viewer={me} basePath="/profile" sp={searchParams} />;
}
