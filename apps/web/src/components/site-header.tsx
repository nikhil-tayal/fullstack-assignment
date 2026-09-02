'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Upload' },
  { href: '/entities', label: 'Entities' },
  { href: '/analytics', label: 'Analytics' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-8 gap-y-2 px-6 py-4">
        <Link href="/" className="font-display text-heading tracking-tight text-ink">
          Entity Registry
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // The active route is marked with a rule in --seal rather than a
                // filled tab: the header is the quiet part of this product.
                className={`border-b-2 pb-0.5 text-meta transition-colors ${
                  active
                    ? 'border-seal text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
