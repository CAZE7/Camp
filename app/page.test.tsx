import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from './page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe('Home Page', () => {
  it('renders the main sections', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: /Camper-Ausbau planen/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fokus-Themen/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Wissen für den Ausbau/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Dach, Elektrik, Heizung und Sicherheit an einem Ort\./)).toBeInTheDocument();
  });

  it('uses a text-led, image-free hero with page index and mobile quick navigation', () => {
    render(<Home />);

    expect(document.querySelector('img')).not.toBeInTheDocument();
    const index = screen.getByRole('navigation', { name: /Inhaltsverzeichnis der Startseite/i });
    expect(within(index).getByRole('link', { name: /Werkzeuge/ })).toHaveAttribute(
      'href',
      '#werkzeuge-heading'
    );
    expect(screen.getByRole('navigation', { name: /Schnellnavigation/i })).toBeInTheDocument();
  });

  it('renders the tool links', () => {
    render(<Home />);

    const main = screen.getByRole('main');
    // Hero-CTA und Werkzeug-Karte teilen sich das Ziel — mindestens 1× je Tool.
    expect(within(main).getAllByRole('link', { name: /Schaltplan/ }).length).toBeGreaterThan(0);
    expect(within(main).getAllByRole('link', { name: /Dach/ }).length).toBeGreaterThan(0);
    expect(within(main).getAllByRole('link', { name: /Heizlast/ }).length).toBeGreaterThan(0);
    // KI-Assistent wurde entfernt (toter Link auf /ki-assistent/, Audit D10).
    // Negativ-Assertion hält fest, dass er nicht zurückkommt, ohne neue Seite.
    expect(within(main).queryByRole('link', { name: /Assistent/ })).not.toBeInTheDocument();
  });

  /**
   * Die Startseite ist die meistbesuchte und die dünnste Seite der Auslieferung
   * (gemessen 2026-10-27: 456 Wörter). Diese Prüfung hält fest, dass sie die
   * drei Fragen beantwortet, die ein Erstbesuch stellt — und dass die Antworten
   * als Text dastehen, nicht als Bild oder als Inhalt hinter JavaScript.
   */
  it('ordnet die Seite ein und beantwortet die häufigsten Fragen', () => {
    render(<Home />);

    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { name: /Was der Elektroplaner ist/i, level: 2 })
    ).toBeInTheDocument();
    expect(within(main).getByRole('heading', { name: /Was diese Seite ist/i, level: 3 })).toBeInTheDocument();
    expect(
      within(main).getByRole('heading', { name: /Was sie nicht ersetzt/i, level: 3 })
    ).toBeInTheDocument();

    // FAQ: genau eine H2 „Häufige Fragen …", darunter die Aufklappliste. Die
    // Überschrift beginnt mit „Häufige Fragen", weil die Export-Prüfung den
    // FAQ-Block genau daran findet (`scripts/seo/checks.ts`).
    const faqHeading = within(main).getByRole('heading', { name: /^Häufige Fragen/i, level: 2 });
    expect(faqHeading).toBeInTheDocument();
    expect(within(main).getAllByText(/Was ist der Elektroplaner\?/).length).toBeGreaterThan(0);
    expect(within(main).getAllByText(/Was kostet der Elektroplaner\?/).length).toBeGreaterThan(0);
    // Der Satz, der die Rechnungen einordnet, muss im Klartext stehen.
    expect(within(main).getAllByText(/Näherungen mit konservativen Annahmen/).length).toBeGreaterThan(0);
  });

  it('renders the guide links', () => {
    render(<Home />);

    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Camper-Ausbauguide/ })).toBeInTheDocument();
    // "Ausbau-Fahrplan" erscheint als Empfehlung UND als Guide-Link — mindestens 1×.
    expect(within(main).getAllByRole('link', { name: /Ausbau-Fahrplan/ }).length).toBeGreaterThan(0);
    expect(within(main).getByRole('link', { name: /Holzausbau \(BEDMAS\)/ })).toBeInTheDocument();
  });
});
