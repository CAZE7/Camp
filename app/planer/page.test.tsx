import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pageByPath } from '@/lib/seo/inventory';

import PlanerSeite from './page';

/**
 * Vertrag der Anwendungsroute `/planer/`.
 *
 * Die Seite ist dünn — und zwar absichtlich: Sie trägt die Anwendung, nicht
 * einen Artikel. Geprüft wird deshalb das, was den Umzug ausmacht (Anwendung
 * statt Website-Chrome, volle Fensterhöhe, Überschrift aus dem Inventar) und
 * nicht ein Mindestumfang an Text.
 */

vi.mock('@/components/Planner', () => ({
  default: () => <div data-testid="mock-planner">Mocked Planner</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const INVENTAR = pageByPath('/planer/');

describe('Planer-Seite', () => {
  it('ist im Seiteninventar als indexierbares Werkzeug geführt', () => {
    expect(INVENTAR, 'Route /planer/ fehlt im SEO-Inventar').toBeDefined();
    expect(INVENTAR!.indexability).toBe('index');
    expect(INVENTAR!.kind).toBe('werkzeug');
    expect(INVENTAR!.structuredData).toEqual(['WebPage', 'WebApplication']);
  });

  it('führt genau eine Überschrift — denselben Text wie das Inventar', () => {
    render(<PlanerSeite />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(INVENTAR!.h1);
  });

  it('rendert die Anwendung als Hauptinhalt', () => {
    render(<PlanerSeite />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(screen.getByTestId('mock-planner')).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('mock-planner'));
  });

  it('verzichtet auf Kopfleiste und Fuß der Website', () => {
    render(<PlanerSeite />);

    // Beides würde der Zeichenfläche Fensterhöhe wegnehmen — der Grund für die
    // eigene Route. `SiteHeader` rendert ein `<header>` (Rolle `banner`),
    // `SiteFooter` ein `<footer>` (Rolle `contentinfo`).
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('gibt der Anwendung die volle dynamische Fensterhöhe', () => {
    render(<PlanerSeite />);

    // `h-dvh` + `overflow-hidden`: Die Anwendung füllt das Fenster und
    // scrollt selbst nicht — nur ihre Panels tun das. `dvh` statt `vh`, weil
    // mobile Browserleisten die sichtbare Höhe ändern (AGENTS.md: 375 px).
    const main = screen.getByRole('main');
    expect(main).toHaveClass('h-dvh', 'overflow-hidden', 'flex', 'flex-col');
  });
});
