import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LadeboosterVergleich } from './LadeboosterVergleich';

describe('LadeboosterVergleich', () => {
  it('rendert Geräte, Tabelle und den Standardfall des Rechners', async () => {
    render(<LadeboosterVergleich />);

    expect(
      screen.getByRole('heading', { name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?' })
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Geräteüberblick/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'VCC 1212-90' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('90-A-Klasse', { exact: true })).toBeInTheDocument();
    });
    expect(screen.getByText('79 A · 0,24 C', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('130 A · 72 %', { exact: true })).toBeInTheDocument();
  });

  it('filtert die Gerätekarten nach Klasse', () => {
    render(<LadeboosterVergleich />);

    fireEvent.click(screen.getByRole('button', { name: '60–70 A' }));

    const orion = screen.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30' }).closest('article');
    const ective = screen.getByRole('heading', { name: 'BB 60' }).closest('article');

    expect(orion).toHaveClass('is-hidden');
    expect(ective).not.toHaveClass('is-hidden');
  });
});
