import { requireUser } from '@/lib/authz';
import ProfileView from '@/components/ProfileView';

export default async function ProfilePage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const me = await requireUser();
  return <ProfileView target={me} viewer={me} basePath="/profile" sp={searchParams} />;
}
