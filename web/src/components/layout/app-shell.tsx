import Link from 'next/link';
import Image from 'next/image';
import pottoIcon from '@/assets/web-icon-assets/icon-192.png';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';

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
          <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-semibold text-accent">
            <Image src={pottoIcon} alt="" width={32} height={32} priority />
            Potto
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <UserMenu userName={userName} userEmail={userEmail} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
