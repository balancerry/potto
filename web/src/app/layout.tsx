import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
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
  openGraph: {
    title: 'Potto',
    description: 'Shared money for trips, events, and group funds.',
    siteName: 'Potto',
    type: 'website',
    url: '/',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Potto' }],
  },
  twitter: {
    card: 'summary',
    title: 'Potto',
    description: 'Shared money for trips, events, and group funds.',
    images: ['/icon-512.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
