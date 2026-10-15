import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';

describe('OnboardingWizard (B-06, B-23)', () => {
  beforeEach(() => {
    useAppStore.setState({ hasOnboarded: false });
  });

  it('Esc schließt den Assistenten, ohne den Plan anzufassen (B-23)', () => {
    render(<OnboardingWizard />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(useAppStore.getState().hasOnboarded).toBe(true);
  });

  it('bietet genau eine eindeutige Benennung für „ohne Vorlage“ (B-06)', () => {
    render(<OnboardingWizard />);
    expect(screen.queryByRole('button', { name: 'Leeren Plan starten' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mit leerem Plan beginnen' })).toBeInTheDocument();
  });

  it('zeigt in Schritt 2, dass nichts vorausgewählt ist (B-06)', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText(/Nichts ist vorausgewählt/)).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).not.toBeChecked();
    }
  });

  it('„Mit leerem Plan beginnen“ ohne Inhalt schließt direkt', () => {
    usePlannerStore.getState().clearPlan();
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Mit leerem Plan beginnen' }));
    expect(useAppStore.getState().hasOnboarded).toBe(true);
  });
});
