import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Themenseite from './page';

/**
 * Reihenfolge der Ladebooster-Seite (Befund der Agenten-Sitzung „Ladebooster
 * Vergleichsplan erstellen"): Der Vergleich stand hinter sämtlichen
 * Ratgeber-Abschnitten, obwohl die Leute wegen des Vergleichs kommen. Er
 * hängt jetzt am `afterHeader`-Slot von `SeoPage`. Dieser Test hält die
 * Reihenfolge im gerenderten Baum fest, nicht nur im Quelltext.
 */
describe('Themenseite /camper-elektrik/ladebooster/', () => {
  it('stellt den Vergleich als erste H2 vor die Ratgeber-Abschnitte', async () => {
    const element = await Themenseite({ params: Promise.resolve({ slug: 'ladebooster' }) });
    render(element);

    const vergleich = screen.getByRole('heading', {
      name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?',
    });
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2[0]).toBe(vergleich);
  });
});
