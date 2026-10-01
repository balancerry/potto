import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { createClient, getAuthUser } from '@/lib/supabase/server';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: profile } = await supabase.from('users').select('name, email').eq('id', user.id).maybeSingle();

  return (
    <AppShell
      userName={profile?.name ?? user.metadataName}
      userEmail={profile?.email ?? user.email}
    >
      {children}
    </AppShell>
  );
}
