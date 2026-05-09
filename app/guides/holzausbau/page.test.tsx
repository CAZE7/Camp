import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HolzausbauGuide from './page';

describe('HolzausbauGuide Component', () => {
  it('renders the main heading correctly', () => {
    render(<HolzausbauGuide />);

    // Check if the main h1 heading is present
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveTextContent('Camper Holzausbau nach dem BEDMAS-Prinzip');
  });

  it('renders all 6 BEDMAS section headings', () => {
    render(<HolzausbauGuide />);

    // Define the expected section headings
    const expectedHeadings = [
      '1. Bulkhead removal and base prep (Trennwand entfernen, Rost behandeln)',
      '2. Electrical planning and rough-in (Kabel ziehen vor der Isolation)',
      '3. Doors, windows, and roof vents (Löcher in die Karosserie schneiden)',
      '4. More metalwork and mounting points (Verstärkungen für schwere Möbel anbringen)',
      '5. Appliances and plumbing systems (Wassertanks und Geräte installieren)',
      '6. Structure, walls, and interior finish (Wandverkleidung und Möbelbau)'
    ];

    // Check if all expected h2 headings are present
    const h2Headings = screen.getAllByRole('heading', { level: 2 });

    // Ensure we found exactly 6 headings
    expect(h2Headings).toHaveLength(6);

    // Verify each heading text
    expectedHeadings.forEach((text, index) => {
      expect(h2Headings[index]).toHaveTextContent(text);
    });
  });

  it('renders the introductory paragraph', () => {
    render(<HolzausbauGuide />);

    // Check if the intro text is present
    const introText = screen.getByText(/Ein professioneller und effizienter Camper-Ausbau erfordert eine gut durchdachte Reihenfolge/i);
    expect(introText).toBeInTheDocument();
  });
});
