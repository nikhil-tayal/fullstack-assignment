import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Assignment',
  description: 'Take-home assignment',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
