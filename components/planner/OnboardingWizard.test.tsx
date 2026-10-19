import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingWizard, recommendedTemplateId } from './OnboardingWizard';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';

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

/**
 * Nachtest 2026-10-16 (Wizard): Kein ✕, Esc wirkungslos, Klick daneben
 * löste „Plan wird geleert“ aus; die Empfehlung schlug „Minimal“ trotz
 * angekreuztem Solar vor (diese Vorlage hat kein Solarmodul).
 */
describe('OnboardingWizard — Schließen & Empfehlung (Nachtest)', () => {
  beforeEach(() => {
    useAppStore.setState({ hasOnboarded: false });
    usePlannerStore.setState({
      nodes: [{ id: 'keep', type: 'battery', position: { x: 0, y: 0 }, data: {} }] as never,
      waterNodes: [],
    });
  });

  it('schließt per ✕, ohne den Plan anzufassen', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }));
    expect(useAppStore.getState().hasOnboarded).toBe(true);
    expect(usePlannerStore.getState().nodes).toHaveLength(1);
  });

  it('schließt per Esc, ohne den Plan anzufassen', () => {
    render(<OnboardingWizard />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().hasOnboarded).toBe(true);
    expect(usePlannerStore.getState().nodes).toHaveLength(1);
  });

  it('empfiehlt nie eine Vorlage ohne die angekreuzten Stromquellen', () => {
    expect(recommendedTemplateId({ solar: true }, {})).toBe('allrounder');
    expect(recommendedTemplateId({ booster: true }, {})).toBe('allrounder');
    expect(recommendedTemplateId({ landstrom: true }, {})).toBe('autark');
    expect(recommendedTemplateId({}, {})).toBe('minimalist');
    expect(recommendedTemplateId({}, { a: true, b: true, c: true })).toBe('allrounder');
    expect(recommendedTemplateId({ solar: true }, { a: true, b: true, c: true, d: true })).toBe('autark');
  });
});
