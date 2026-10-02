import type { Metadata } from 'next';

import { SiteHeader } from '@/components/brand/SiteHeader';
import Chat from '@/components/Chat';

import { pageMetadata } from '@/app/siteMetadata';

/**
 * Die Assistenten-Ansicht ruft eine Server-Schnittstelle auf, die es in der
 * statischen Auslieferung nicht gibt. Sie bleibt erreichbar, wird aber nicht
 * in den Index aufgenommen und steht nicht in der Sitemap.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Camper-Assistent',
  description:
    'Fragen zum Camper-Ausbau im Dialog — als Ergänzung zu Schaltplan, Dach-Planer und Heizlast-Rechner.',
  path: '/ki-assistent/',
  index: false,
});

export default function KiAssistent() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main id="main" className="relative flex-1">
        <h1 className="sr-only">Camper-Assistent</h1>
        <Chat defaultOpen />
      </main>
    </div>
  );
}
