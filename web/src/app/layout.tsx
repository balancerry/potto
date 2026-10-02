import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemedToaster } from '@/components/theme/themed-toaster';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

const body = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  adjustFontFallback: true,
});

const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal'],
  axes: ['opsz', 'SOFT', 'WONK'],
});

// Browser chrome (mobile address bar) follows the OS; the page itself follows the Theme setting.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0e4' },
    { media: '(prefers-color-scheme: dark)', color: '#17160f' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.trypotto.in'),
  title: {
    default: 'Potto',
    template: '%s · Potto',
  },
  description: 'Shared money for trips, events, and group funds. Transparent pool, expenses, and settlements.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  // The share image comes from app/opengraph-image.tsx (file-based metadata overrides `images` here).
  openGraph: {
    title: 'Potto: one shared pot for trips, events & group funds',
    description:
      'Pool money with your group, log every expense, and settle up fairly. See who paid, who owes, and what’s left in one place.',
    siteName: 'Potto',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Potto: one shared pot for trips, events & group funds',
    description: 'Pool money with your group, log every expense, and settle up fairly.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline theme script sets data-theme on <html> before React hydrates.
    <html lang="en" className={`${body.variable} ${display.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
