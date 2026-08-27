import Link from 'next/link';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

const LINKS = [
  { href: '/', label: 'Zur Startseite' },
  { href: '/tools/dach', label: 'Dach-Planer' },
  { href: '/tools/heizung', label: 'Heizlast' },
  { href: '/elektrik-planung', label: 'Schaltplan' },
  { href: '/ki-assistent', label: 'KI-Assistent' },
  { href: '/guides/ausbau-fahrplan', label: 'Ausbau-Fahrplan' },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
        <p className="label-eyebrow text-copper">Fehler 404</p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
          Diese Seite gibt es (noch) nicht.
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          Die aufgerufene Adresse führt ins Leere. Vielleicht war der Link veraltet oder du hast dich
          vertippt. Wähle unten, wo es weitergehen soll.
        </p>

        <ul className="mt-8 divide-y divide-rule border border-rule bg-bone">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-14 items-center justify-between px-5 py-3 text-sm hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset"
              >
                <span className="font-medium text-ink">{link.label}</span>
                <span aria-hidden="true" className="text-copper">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
