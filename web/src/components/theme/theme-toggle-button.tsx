'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { cn } from '@/lib/utils';

/**
 * One-click light/dark switch (sits next to the notification bell). It flips whatever is showing
 * right now, so on a "System" theme the first click picks the opposite of the OS and from then on
 * the choice is explicit and remembered.
 *
 * The icon shows the CURRENT theme (sun in light, moon in dark). Which one is on, and the
 * turn-and-fade between them, is decided in CSS (see .theme-toggle-* in globals.css), not by
 * React state, so there is no wrong-icon flash before hydration and nothing animates on load.
 * The two icons are stacked in a fixed 20px box, so the header layout never shifts.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setPreference } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        'flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-transparent text-ink transition-colors',
        'hover:border-line hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        className,
      )}
    >
      <span className="relative block size-5">
        <Sun className="theme-toggle-icon theme-toggle-sun size-5" strokeWidth={1.75} aria-hidden />
        <Moon className="theme-toggle-icon theme-toggle-moon size-5" strokeWidth={1.75} aria-hidden />
      </span>
    </button>
  );
}
