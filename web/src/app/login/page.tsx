import { Suspense } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent-soft),_transparent_55%),linear-gradient(180deg,_var(--paper),_#ebe6da)]"
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <BrandMark subtitle="Shared money, clearly settled." />
        <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
