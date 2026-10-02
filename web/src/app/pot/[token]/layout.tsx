import Image from 'next/image';
import pottoIcon from '@/assets/web-icon-assets/icon-192.png';
import { ThemeToggleButton } from '@/components/theme/theme-toggle-button';

/**
 * Shell for the anonymous, read-only pot viewer. Deliberately not the signed-in
 * AppShell: no account menu, no notifications, no links into the app. The only
 * control is the theme toggle.
 */
export default function PublicPotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5 font-display text-2xl font-semibold text-accent">
            <Image src={pottoIcon} alt="" width={32} height={32} priority />
            Potto
          </span>
          <ThemeToggleButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-line/80">
        <p className="mx-auto max-w-4xl px-4 py-5 text-xs text-ink-soft sm:px-6">
          Shared read-only from Potto. Only names and amounts are shown; nothing here can be changed.
        </p>
      </footer>
    </div>
  );
}
