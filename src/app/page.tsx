import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { KovokAppClient } from '@/components/KovokAppClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect('/login');
  }

  return (
    <KovokAppClient
      initialWorkspace={{
        id: sessionData.workspace.id,
        name: sessionData.workspace.name,
        slug: sessionData.workspace.slug,
        serviceArea: sessionData.workspace.serviceArea ?? 'Delhi NCR',
        isSandbox: sessionData.workspace.isSandbox,
      }}
      initialUser={{
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.name,
      }}
      initialRole={sessionData.role?.name ?? null}
    />
  );
}
