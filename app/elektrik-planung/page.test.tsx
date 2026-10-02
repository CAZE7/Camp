import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ELEKTRIK_FAQ } from '@/components/elektrik/electricContent';
import ElektrikPlanung from './page';

vi.mock('../../components/Planner', () => ({
  default: () => <div data-testid="mock-planner">Mocked Planner</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/elektrik-planung',
}));

describe('ElektrikPlanung', () => {
  it('führt die Seite mit genau einer Hauptüberschrift', () => {
    render(<ElektrikPlanung />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Camper-Elektrik berechnen');
  });

  it('gliedert die Inhalte in Abschnitte mit eigener Überschrift', () => {
    render(<ElektrikPlanung />);

    for (const title of [
      'Kabelquerschnitt und Absicherung berechnen',
      'Physikalische Grundlagen',
      'Absicherung und Normen',
      'Schaltplan zeichnen und automatisch verdrahten',
      'Häufige Fragen zur Wohnmobil-Elektrik',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it('verknüpft jedes Eingabefeld mit Beschriftung und Hilfetext', () => {
    render(<ElektrikPlanung />);

    const current = screen.getByLabelText('Betriebsstrom I in Ampere');
    const length = screen.getByLabelText('Einfache Leitungslänge L in Metern');

    for (const field of [current, length]) {
      expect(field).toHaveAttribute('type', 'number');
      expect(field).toHaveAttribute('inputmode', 'decimal');

      const describedBy = field.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).not.toBeNull();
    }
  });

  it('nennt nach der Eingabe Querschnitt, Spannungsfall und Sicherung', () => {
    render(<ElektrikPlanung />);

    fireEvent.change(screen.getByLabelText('Betriebsstrom I in Ampere'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Einfache Leitungslänge L in Metern'), { target: { value: '5' } });

    const result = screen.getByRole('status');
    expect(result).toHaveTextContent('6,0 mm²');
    expect(result).toHaveTextContent('0,29 V');
    expect(result).toHaveTextContent('10 A');
  });

  it('meldet Eingaben außerhalb der Normreihe sichtbar', () => {
    render(<ElektrikPlanung />);

    fireEvent.change(screen.getByLabelText('Betriebsstrom I in Ampere'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Einfache Leitungslänge L in Metern'), {
      target: { value: '10' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Außerhalb der Normreihe');
  });

  it('zeigt im Akkordeon dieselben Fragen, die maschinenlesbar hinterlegt sind', () => {
    const { container } = render(<ElektrikPlanung />);

    const summaries = Array.from(container.querySelectorAll('summary')).map((element) =>
      element.textContent?.trim()
    );
    expect(summaries).toEqual(ELEKTRIK_FAQ.map((entry) => entry.question));

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const graph = JSON.parse(script!.textContent ?? '{}') as {
      '@graph': Array<Record<string, unknown>>;
    };
    const faq = graph['@graph'].find((node) => node['@type'] === 'FAQPage');
    const questions = (faq?.['mainEntity'] ?? []) as Array<{ name: string }>;
    expect(questions.map((question) => question.name)).toEqual(summaries);
  });

  it('bindet den Planer unterhalb der Rechenwege ein', () => {
    render(<ElektrikPlanung />);
    expect(screen.getByTestId('mock-planner')).toBeInTheDocument();
  });
});
