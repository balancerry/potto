import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { createClient } from '@/lib/supabase/server';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('name, email').eq('id', user.id).maybeSingle();

  return (
    <AppShell
      userName={profile?.name ?? (user.user_metadata?.name as string | undefined) ?? null}
      userEmail={profile?.email ?? user.email ?? null}
    >
      {children}
    </AppShell>
  );
}
