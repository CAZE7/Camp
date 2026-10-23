import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PLANER_FAQ } from '@/components/planner/planerSeoTexte';
import { pageByPath } from '@/lib/seo/inventory';

import PlanerSeite from './page';

/**
 * Vertrag der Anwendungsroute `/planer/`.
 *
 * Zwei Zusagen, die sich früher ausschlossen und jetzt beide gelten:
 * Die Anwendung füllt exakt den ersten Bildschirm (kein Website-Chrome,
 * keine Textspalte davor) — und darunter steht statisch vorgerenderter
 * Erklärtext, damit Crawler mehr sehen als den Ladezustand der
 * Client-Anwendung („Thin Content“-Befund). Geprüft wird beides.
 */

vi.mock('@/components/Planner', () => ({
  default: () => <div data-testid="mock-planner">Mocked Planner</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const INVENTAR = pageByPath('/planer/');

describe('Planer-Seite', () => {
  it('ist im Seiteninventar als indexierbares Werkzeug mit FAQ geführt', () => {
    expect(INVENTAR, 'Route /planer/ fehlt im SEO-Inventar').toBeDefined();
    expect(INVENTAR!.indexability).toBe('index');
    expect(INVENTAR!.kind).toBe('werkzeug');
    expect(INVENTAR!.structuredData).toEqual(['WebPage', 'BreadcrumbList', 'WebApplication', 'FAQPage']);
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

  it('gibt der Anwendung den vollen ersten Bildschirm, dem Dokument das Scrollen darunter', () => {
    render(<PlanerSeite />);

    // `h-dvh` + `overflow-hidden` auf dem Anwendungs-Abschnitt: Die Anwendung
    // füllt das Fenster und scrollt selbst nicht — nur ihre Panels tun das.
    // `dvh` statt `vh`, weil mobile Browserleisten die sichtbare Höhe ändern
    // (AGENTS.md: 375 px). Das `main` selbst scrollt als Dokument weiter in
    // den Erklärteil — genau einen Bildschirm weiter unten.
    const main = screen.getByRole('main');
    const anwendung = screen.getByTestId('mock-planner').closest('section');
    expect(anwendung).toHaveClass('h-dvh', 'overflow-hidden', 'flex', 'flex-col');
    expect(main).not.toHaveClass('overflow-hidden');
  });

  it('liefert unter der Anwendung statischen Erklärtext statt nur den Ladezustand', () => {
    render(<PlanerSeite />);

    // Anleitung, Funktionen und Vorlagen: der Text, den ein Crawler ohne
    // JavaScript im Roh-HTML findet (und ein Besucher beim Scrollen).
    expect(screen.getByRole('heading', { name: /Camper-Schaltplan online zeichnen/ })).toBeInTheDocument();
    expect(screen.getByText(/Kabelquerschnitt berechnen aus Spannungsabfall/)).toBeInTheDocument();
    expect(screen.getByText(/Ladebooster statt Trennrelais/)).toBeInTheDocument();
    for (const entry of PLANER_FAQ) {
      expect(screen.getByText(entry.question)).toBeInTheDocument();
    }
  });

  it('verlinkt die drei Vorlagen als Deep-Links in den Planer', () => {
    render(<PlanerSeite />);

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toContain('/planer/?template=wochenende');
    expect(links).toContain('/planer/?template=kastenwagen');
    expect(links).toContain('/planer/?template=autark');
    expect(links).toContain('/elektrik-planung/');
  });

  it('trägt die FAQ auch als strukturierte Daten (FAQPage aus derselben Quelle)', () => {
    const { container } = render(<PlanerSeite />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script, 'JSON-LD fehlt').not.toBeNull();
    const graph = JSON.parse(script!.textContent) as { '@graph': Array<Record<string, unknown>> };
    const faq = graph['@graph'].find((node) => node['@type'] === 'FAQPage');
    expect(faq, 'FAQPage-Knoten fehlt').toBeDefined();
    const questions = faq!['mainEntity'] as Array<{ name: string }>;
    expect(questions.map((question) => question.name)).toEqual(PLANER_FAQ.map((entry) => entry.question));
    expect(graph['@graph'].map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['WebPage', 'WebApplication', 'FAQPage', 'BreadcrumbList'])
    );
  });
});
