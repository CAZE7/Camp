import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingWizard } from './OnboardingWizard';

describe('OnboardingWizard', () => {
  it('starts step two with only explicitly chosen consumers checked', () => {
    render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const consumerStep = screen.getByRole('region', { name: '2. Welche Geräte planst du?' });
    const laptop = within(consumerStep).getByRole('checkbox', { name: 'Laptop-Ladegerät' });
    expect(laptop).not.toBeChecked();
    expect(within(consumerStep).getAllByRole('checkbox')).toHaveLength(5);
    for (const checkbox of within(consumerStep).getAllByRole('checkbox')) {
      expect(checkbox).not.toBeChecked();
    }
  });
});
