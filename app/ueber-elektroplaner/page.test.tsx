import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pageByPath } from '@/lib/seo/inventory';

import UeberElektroplanerUmleitung, { metadata } from './page';

/**
 * Vertrag der Umleitungsroute `/ueber-elektroplaner/`.
 *
 * Die Adresse ist die frühere der Vertrauensseite. Sie muss zwei Dinge
 * gleichzeitig erfüllen: erreichbar bleiben, damit bestehende Verweise nicht
 * ins Leere laufen — und aus dem Index herausbleiben, damit nicht zwei
 * Adressen dieselbe Aussage tragen.
 *
 * React 19 schreibt `<meta>` aus einer Route in den Dokumentkopf; geprüft wird
 * deshalb `document.head`, nicht der Container.
 */

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const INVENTAR = pageByPath('/ueber-elektroplaner/');

describe('Frühere Vertrauensadresse /ueber-elektroplaner/', () => {
  it('ist im Inventar geführt — als nicht indexierbare Weiterleitung', () => {
    expect(INVENTAR, 'Route /ueber-elektroplaner/ fehlt im SEO-Inventar').toBeDefined();
    expect(INVENTAR!.indexability).toBe('noindex');
    // Kein Sitemap-Eintrag: Eine Weiterleitung gehört nicht in die Sitemap.
    expect(INVENTAR!.sitemap).toBeUndefined();
    expect(INVENTAR!.structuredData).toEqual([]);
  });

  it('zeigt genau eine Überschrift und den Weg zur neuen Adresse', () => {
    render(<UeberElektroplanerUmleitung />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(INVENTAR!.h1);

    const link = screen.getByRole('link', { name: /Über 12V-Planer/ });
    expect(link).toHaveAttribute('href', '/ueber-12v-planer/');
  });

  it('trägt die Weiterleitung als meta refresh mit dem Ziel der neuen Adresse', () => {
    render(<UeberElektroplanerUmleitung />);

    const refresh = document.head.querySelector('meta[http-equiv="refresh"]');
    expect(refresh, 'meta refresh fehlt im Dokumentkopf').not.toBeNull();
    expect(refresh!.getAttribute('content')).toMatch(/^0; url=.*\/ueber-12v-planer\/$/);
  });

  it('bleibt auf noindex — die neue Adresse ist die einzige im Index', () => {
    // Die robots-Anweisung kommt aus den Kopfdaten (Next setzt sie beim Bau
    // in den Dokumentkopf); im Test wird deshalb der Metadaten-Export geprüft.
    expect(metadata.robots, 'Weiterleitung ohne robots-Anweisung').toMatchObject({
      index: false,
      follow: true,
    });
  });
});
