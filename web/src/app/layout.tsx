import type { Metadata } from 'next';
import { DM_Sans, Source_Serif_4 } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const body = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const display = Source_Serif_4({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Potto',
    template: '%s · Potto',
  },
  description: 'Shared money for trips, events, and group funds. Transparent pool, expenses, and settlements.',
  openGraph: {
    title: 'Potto',
    description: 'Shared money for trips, events, and group funds.',
    siteName: 'Potto',
    type: 'website',
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
