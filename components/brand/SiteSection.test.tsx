import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteSection } from './SiteSection';

/**
 * Ein Abschnitt trägt seine Anker an zwei Stellen: der Abschnitt heißt `id`,
 * die Überschrift `id + '-heading'`. Verweise im Inhaltsverzeichnis zeigen auf
 * die Überschrift — fällt die zweite Kennung weg, landet der Sprung im
 * Nichts (oder gar nicht). Das ist ohne Browser prüfbar und stand vorher in
 * keinem Test: Jede Seite baute ihren Kopf selbst.
 */
describe('SiteSection', () => {
  it('benennt den Abschnitt und die Überschrift zusammen', () => {
    const { container } = render(
      <SiteSection id="werkzeuge" title="Fokus-Themen">
        <p>Inhalt</p>
      </SiteSection>
    );

    const section = container.querySelector('section')!;
    const heading = screen.getByRole('heading', { level: 2, name: 'Fokus-Themen' });

    expect(section).toHaveAttribute('id', 'werkzeuge');
    expect(heading).toHaveAttribute('id', 'werkzeuge-heading');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('zeigt Kicker und Einleitung, wenn sie übergeben werden', () => {
    render(
      <SiteSection id="guides" kicker="LESESTOFF" title="Wissen" lead="Zwei Sätze.">
        <p>Inhalt</p>
      </SiteSection>
    );

    expect(screen.getByText('LESESTOFF')).toBeInTheDocument();
    expect(screen.getByText('Zwei Sätze.')).toBeInTheDocument();
  });

  it('lässt ohne `bare` die trennende Linie stehen und trägt genau eine H2', () => {
    const { container } = render(
      <SiteSection id="a" title="A">
        <p>Inhalt</p>
      </SiteSection>
    );

    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelector('.border-b')).not.toBeNull();
  });
});
