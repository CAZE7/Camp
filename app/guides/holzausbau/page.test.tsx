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
    expect(mainHeading).toHaveTextContent('Holzausbau nach BEDMAS');
  });

  it('renders all 6 BEDMAS section headings', () => {
    render(<HolzausbauGuide />);

    // Define the expected section headings (number + German step title)
    const expectedHeadings = [
      '01 Trennwand entfernen, Rost behandeln',
      '02 Kabel ziehen vor der Isolation',
      '03 Löcher in die Karosserie schneiden',
      '04 Verstärkungen für schwere Möbel anbringen',
      '05 Wassertanks und Geräte installieren',
      '06 Wandverkleidung und Möbelbau',
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
    const introText = screen.getByText(/Reihenfolge: entkernen, Kabel, Luken, Verankerung, Wasser, dann Holz/i);
    expect(introText).toBeInTheDocument();
  });
});
