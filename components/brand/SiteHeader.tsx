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

/**
 * D-3 App-Shell: schmale sticky Top-Bar (h-12) — Mark + Nav links mit
 * aktivem Unterstrich in Akzentfarbe, Aktionen rechts. Auf dem Handy
 * klappt die Navigation hinter dem Burger auf.
 */
export function SiteHeader({ tone = 'paper' }: { tone?: 'paper' | 'soot' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const inverted = tone === 'soot';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b',
        inverted ? 'border-on-signal/10 bg-soot text-paper' : 'border-rule bg-surface-canvas text-ink'
      )}
    >
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-2">
          <Mark inverted={inverted} />
          <nav className="hidden items-center sm:flex" aria-label="Hauptnavigation">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative inline-flex h-12 items-center px-3 text-sm transition-colors',
                    inverted
                      ? active
                        ? 'font-medium text-paper after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-oxide after:content-[""]'
                        : 'text-paper/70 hover:text-paper'
                      : active
                        ? 'font-medium text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-oxide after:content-[""]'
                        : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/elektrik-planung"
            className="hidden min-h-11 items-center bg-oxide px-3 py-2 text-sm font-medium text-on-signal transition-colors hover:bg-oxide/90 sm:inline-flex"
          >
            Planer öffnen
          </Link>
          <button
            type="button"
            className={cn(
              'inline-flex h-12 min-w-11 flex-col items-center justify-center gap-1 p-2 sm:hidden',
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
      </div>

      {open && (
        <nav
          id="site-mobile-nav"
          className={cn(
            'border-t sm:hidden',
            inverted ? 'border-on-signal/10 bg-soot' : 'border-rule bg-surface-canvas'
          )}
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
                      'flex min-h-11 items-center px-3 py-3 text-sm',
                      inverted
                        ? active
                          ? 'bg-on-signal/10 font-medium text-paper'
                          : 'text-paper/80 hover:bg-on-signal/5'
                        : active
                          ? 'bg-surface-panel font-medium text-ink'
                          : 'text-ink-soft hover:bg-surface-panel hover:text-ink'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="sm:hidden">
              <Link
                href="/elektrik-planung"
                onClick={() => setOpen(false)}
                className="mt-2 flex min-h-11 items-center justify-center bg-oxide px-3 py-2 text-sm font-medium text-on-signal"
              >
                Planer öffnen
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
