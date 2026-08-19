import Link from 'next/link';
import { SiteHeader } from '@/components/brand/SiteHeader';

const TOOLS = [
  {
    title: 'Schaltplan',
    body: '12V- und 230V-Anlage zeichnen, verkabeln, Stückliste.',
    href: '/elektrik-planung',
  },
  {
    title: 'Dach',
    body: 'Solarpanels und Luken auf dem Fahrzeugdach platzieren.',
    href: '/tools/dach',
  },
  {
    title: 'Heizlast',
    body: 'Benötigte Heizleistung aus Fahrzeug, Dämmung und Temperatur.',
    href: '/tools/heizung',
  },
  {
    title: 'Assistent',
    body: 'Fragen zu Normen, Querschnitt und Ausbau.',
    href: '/ki-assistent',
  },
];

const GUIDES = [
  { title: 'Camper-Ausbauguide', href: '/guides/camper-ausbauguide' },
  { title: 'Ausbau-Fahrplan', href: '/guides/ausbau-fahrplan' },
  { title: 'Holzausbau (BEDMAS)', href: '/guides/holzausbau' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Camper planen</h1>
        <p className="mt-2 text-sm text-ink">
          Elektrik, Dach, Heizlast und Assistent. Alles an einem Ort.
        </p>

        <ul className="mt-8 divide-y divide-rule border border-rule bg-bone">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex items-center justify-between gap-6 px-5 py-4 hover:bg-paper"
              >
                <div>
                  <div className="font-medium">{tool.title}</div>
                  <p className="mt-0.5 text-sm text-ink">{tool.body}</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-ink">Öffnen →</span>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-sm font-semibold text-ink">Guides</h2>
        <ul className="mt-3 divide-y divide-rule border border-rule bg-bone">
          {GUIDES.map((guide) => (
            <li key={guide.href}>
              <Link
                href={guide.href}
                className="flex items-center justify-between px-5 py-3 text-sm hover:bg-paper"
              >
                {guide.title}
                <span className="text-copper">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
