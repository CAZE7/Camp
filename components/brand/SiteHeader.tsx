'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Mark } from './Mark';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/elektrik-planung', label: 'Schaltplan' },
  { href: '/tools/dach', label: 'Dach' },
  { href: '/tools/heizung', label: 'Heizlast' },
  { href: '/ki-assistent', label: 'Assistent' },
  { href: '/guides/ausbau-fahrplan', label: 'Guides' },
];

export function SiteHeader({
  tone = 'paper',
}: {
  tone?: 'paper' | 'soot';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const inverted = tone === 'soot';

  return (
    <header
      className={cn(
        'relative z-40 border-b',
        inverted
          ? 'bg-soot text-paper border-white/10'
          : 'bg-paper text-ink border-rule'
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Mark inverted={inverted} />

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Hauptnavigation">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              pathname?.startsWith(`${item.href}/`) ||
              (item.href === '/guides/ausbau-fahrplan' && pathname?.startsWith('/guides'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-2.5 py-1 text-sm',
                  inverted
                    ? active
                      ? 'text-paper'
                      : 'text-paper/55 hover:text-paper'
                    : active
                      ? 'text-ink font-medium'
                      : 'text-ink-soft hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="sm:hidden flex flex-col gap-[5px] p-2"
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={cn('block h-px w-5', inverted ? 'bg-paper' : 'bg-ink')} />
          <span className={cn('block h-px w-5', inverted ? 'bg-paper' : 'bg-ink')} />
          <span className={cn('block h-px w-5', inverted ? 'bg-paper' : 'bg-ink')} />
        </button>
      </div>

      {open && (
        <nav
          className={cn(
            'border-t sm:hidden',
            inverted ? 'border-white/10 bg-soot' : 'border-rule bg-paper'
          )}
          aria-label="Mobilnavigation"
        >
          <ul className="flex flex-col px-5 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-sm"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
