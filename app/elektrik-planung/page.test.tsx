import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ElektrikPlanung from './page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

/**
 * Die alte Adresse ist nach dem Umzug ein Stub. Der Test hält fest, was der
 * Stub leisten muss:
 *
 *  - genau eine Hauptüberschrift, die dem Inventar entspricht (die
 *    Exportprüfung vergleicht sie),
 *  - ein sichtbarer Verweis auf den neuen Ort (auch ohne JavaScript),
 *  - der Meta-Refresh als Automatik dahinter.
 */
describe('ElektrikPlanung (Stub nach dem Umzug)', () => {
  it('führt die Seite mit genau einer Hauptüberschrift', () => {
    render(<ElektrikPlanung />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Diese Seite ist umgezogen');
  });

  it('verweist sichtbar auf den neuen Ort', () => {
    render(<ElektrikPlanung />);

    expect(screen.getByRole('link', { name: 'Zur neuen Seite' }).getAttribute('href')).toMatch(
      /^\/camper-elektrik\/?$/
    );
    expect(screen.getByRole('link', { name: 'Camper-Elektroplaner öffnen' }).getAttribute('href')).toMatch(
      /^\/planer\/?$/
    );
  });

  it('stellt den Meta-Refresh auf die neue Adresse', () => {
    render(<ElektrikPlanung />);

    // React 19 hebt `<meta>` in den Dokumentkopf — dort steht er auch im
    // ausgelieferten HTML.
    const refresh = document.head.querySelector('meta[http-equiv="refresh"]');
    expect(refresh).not.toBeNull();
    expect(refresh?.getAttribute('content')).toContain('/camper-elektrik/');
  });

  it('rendert den Rechner der alten Seite nicht mehr', () => {
    const { container } = render(<ElektrikPlanung />);

    // Der Rechner ist mit auf `/camper-elektrik/` gewandert. Stand er noch
    // hier, gäbe es die Startseite des Themas doppelt.
    expect(container.querySelector('#rechner-strom')).toBeNull();
  });
});
