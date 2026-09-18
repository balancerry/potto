import Link from 'next/link';
import { signOut } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';

export function AppShell({
  children,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-display text-2xl font-semibold text-accent">
            Potto
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium text-ink">{userName ?? 'Member'}</p>
              {userEmail ? <p className="text-xs text-ink-soft">{userEmail}</p> : null}
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
