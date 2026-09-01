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
  { href: '/guides/ausbau-fahrplan', label: 'Guides' },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // Guides-Tab ist aktiv für alle /guides/*-Pfade
  if (href === '/guides/ausbau-fahrplan') {
    return pathname.startsWith('/guides');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ tone = 'paper' }: { tone?: 'paper' | 'soot' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const inverted = tone === 'soot';

  return (
    <header
      className={cn(
        'relative z-40 border-b',
        inverted ? 'border-white/10 bg-soot text-paper' : 'border-rule bg-paper text-ink'
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Mark inverted={inverted} />

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Hauptnavigation">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center px-3 text-sm',
                  inverted
                    ? active
                      ? 'font-medium text-paper'
                      : 'text-paper/70 hover:text-paper'
                    : active
                      ? 'font-medium text-ink'
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
          className={cn(
            'inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-[5px] p-2 sm:hidden',
            inverted ? 'text-paper' : 'text-ink'
          )}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={cn('block h-px w-6', inverted ? 'bg-paper' : 'bg-ink')} />
          <span className={cn('block h-px w-6', inverted ? 'bg-paper' : 'bg-ink')} />
          <span className={cn('block h-px w-6', inverted ? 'bg-paper' : 'bg-ink')} />
        </button>
      </div>

      {open && (
        <nav
          id="site-mobile-nav"
          className={cn('border-t sm:hidden', inverted ? 'border-white/10 bg-soot' : 'border-rule bg-paper')}
          aria-label="Mobilnavigation"
        >
          <ul className="flex flex-col px-3 py-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center rounded-none px-3 py-3 text-sm',
                      inverted
                        ? active
                          ? 'bg-white/10 font-medium text-paper'
                          : 'text-paper/80 hover:bg-white/5'
                        : active
                          ? 'bg-bone font-medium text-ink'
                          : 'text-ink-soft hover:bg-bone hover:text-ink'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
