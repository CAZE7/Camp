import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pageByPath } from '@/lib/seo/inventory';

import { SiteFooter } from './SiteFooter';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

/**
 * Der Fuß ist die zweite Verbindung zwischen den Bereichen — er verlinkt
 * jede Seite, die nicht im laufenden Text erreicht wird. Ein Ziel, das es im
 * Inventar nicht gibt, wäre ein toter Verweis: Genau das prüft sonst erst der
 * Export-Audit (`scripts/seo/auditExport.ts`) nach dem Bauen. Dieser Test
 * hält es ohne Build fest.
 */
describe('SiteFooter', () => {
  it('verweist nur auf Seiten, die im Inventar stehen', () => {
    render(<SiteFooter />);

    const ziele = [...screen.getByRole('contentinfo').querySelectorAll('a[href]')].map(
      (link) => link.getAttribute('href') ?? ''
    );
    expect(ziele.length).toBeGreaterThan(10);

    for (const ziel of ziele) {
      expect(ziel.startsWith('/'), `kein interner Pfad: ${ziel}`).toBe(true);
      expect(pageByPath(ziel), `Ziel fehlt im SEO-Inventar: ${ziel}`).toBeDefined();
    }
  });

  it('ordnet die Ziele in benannte Spalten', () => {
    render(<SiteFooter />);

    // Vier Spalten, jede mit eigener Überschrift: Wer sucht, liest die
    // Spalte, nicht die Liste.
    for (const spalte of ['Werkzeuge', 'Wissen', 'Rechner', 'Über uns']) {
      const nav = screen.getByRole('navigation', { name: `Fußnavigation ${spalte}` });
      expect(within(nav).getAllByRole('link').length).toBeGreaterThan(0);
    }
  });

  it('behält den Hinweis auf die Elektrofachkraft', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/DIN VDE 0100-721/);
  });
});
