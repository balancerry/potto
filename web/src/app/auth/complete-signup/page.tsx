import { BrandMark } from '@/components/brand-mark';
import { CompleteSignupForm } from '@/components/auth/complete-signup-form';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Complete signup' };

export default async function CompleteSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=auth');

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent-soft),_transparent_55%),linear-gradient(180deg,_var(--paper),_#ebe6da)]"
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <BrandMark subtitle="Almost there — finish setting up your account." />
        <CompleteSignupForm />
      </div>
    </main>
  );
}
