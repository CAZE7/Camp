import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pageByPath } from '@/lib/seo/inventory';

import UeberWerftUmleitung, { metadata } from './page';

/**
 * Vertrag der Umleitungsroute `/ueber-werft/`.
 *
 * Die Adresse ist die alte der Vertrauensseite (früherer Produktname). Sie
 * muss gleichzeitig erreichbar bleiben und per Canonical auf die aktuelle
 * Adresse verweisen. Die Route bleibt aus der Sitemap, erhält aber kein
 * `noindex`.
 *
 * React 19 schreibt `<meta>` aus einer Route in den Dokumentkopf; geprüft wird
 * deshalb `document.head`, nicht der Container.
 */

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const INVENTAR = pageByPath('/ueber-werft/');

describe('Alte Vertrauensadresse /ueber-werft/', () => {
  it('ist im Inventar indexierbar, bleibt aber aus der Sitemap', () => {
    expect(INVENTAR, 'Route /ueber-werft/ fehlt im SEO-Inventar').toBeDefined();
    expect(INVENTAR!.indexability).toBe('index');
    expect(INVENTAR!.sitemap).toBeUndefined();
    expect(INVENTAR!.structuredData).toEqual([]);
  });

  it('zeigt genau eine Überschrift und den Weg zur neuen Adresse', () => {
    render(<UeberWerftUmleitung />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(INVENTAR!.h1);

    const link = screen.getByRole('link', { name: /Über 12V-Planer/ });
    expect(link).toHaveAttribute('href', '/ueber-12v-planer/');
  });

  it('trägt die Weiterleitung als meta refresh mit dem Ziel der neuen Adresse', () => {
    render(<UeberWerftUmleitung />);

    const refresh = document.head.querySelector('meta[http-equiv="refresh"]');
    expect(refresh, 'meta refresh fehlt im Dokumentkopf').not.toBeNull();
    expect(refresh!.getAttribute('content')).toMatch(/^0; url=.*\/ueber-12v-planer\/$/);
  });

  it('setzt den Canonical aufs Ziel und widerspricht ihm nicht mit noindex', () => {
    expect(metadata.alternates?.canonical).toBe('https://12v-planer.de/ueber-12v-planer/');
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });
});
