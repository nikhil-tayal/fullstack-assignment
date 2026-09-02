import type { Metadata } from 'next';
import { Bodoni_Moda, IBM_Plex_Mono, Public_Sans } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

// Bodoni carries the banknote and certificate DNA, and is unusable small —
// which is the point. It appears on page titles and inside the seal, nowhere else.
const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bodoni-moda',
});

// The typeface of the US Web Design System: literally the face of government filings.
const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
});

// Anything the reader compares character by character: IDs, dates, percentages, line numbers.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
});

export const metadata: Metadata = {
  title: 'Entity Registry',
  description:
    'Legal entities, the jurisdictions they are registered in, who owns whom, and what has to be filed before a deadline passes.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
