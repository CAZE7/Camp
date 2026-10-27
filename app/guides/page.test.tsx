import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { pageByPath } from '@/lib/seo/inventory';

import GuidesOverview from './page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const LEITFAEDEN = [
  '/guides/ausbau-fahrplan/',
  '/guides/camper-ausbauguide/',
  '/guides/holzausbau/',
] as const;

/** Alle Verweisziele im Hauptbereich — unabhängig von Karten oder Listen. */
function zieleImHauptteil(): string[] {
  const main = screen.getByRole('main');
  return [...main.querySelectorAll('a[href]')].map((link) => link.getAttribute('href') ?? '');
}

describe('Guides-Übersicht', () => {
  it('steht im Inventar und zeigt dessen Hauptüberschrift', () => {
    const entry = pageByPath('/guides/');
    expect(entry, '/guides/ fehlt im SEO-Inventar').toBeDefined();

    render(<GuidesOverview />);

    // Die H1 kommt aus dem Inventar, damit Anzeige und Prüfung nicht
    // auseinanderlaufen (Export-Audit vergleicht beide).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(entry!.h1);
  });

  it('verweist auf jeden Leitfaden, der unter /guides/ liegt', () => {
    render(<GuidesOverview />);

    const ziele = zieleImHauptteil();
    for (const ziel of LEITFAEDEN) {
      expect(ziele, `Verweis auf ${ziel} fehlt`).toContain(ziel);
    }
  });

  it('führt aus der Übersicht in die Werkzeuge', () => {
    render(<GuidesOverview />);

    expect(zieleImHauptteil()).toContain('/planer/');
  });

  it('zeigt die Brotkrumenspur mit Startseite', () => {
    render(<GuidesOverview />);

    const spur = screen.getByRole('navigation', { name: 'Pfad' });
    expect(spur).toBeInTheDocument();
    expect(spur.querySelector('a[href="/"]')).not.toBeNull();
  });
});
