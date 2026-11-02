import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OnboardingWizard, recommendedTemplateId } from './OnboardingWizard';
import { PLANNER_TEMPLATES } from './templates';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';

describe('OnboardingWizard (B-06, B-23, Nachtest)', () => {
  beforeEach(() => {
    useAppStore.setState({ hasOnboarded: false });
    usePlannerStore.setState({
      nodes: [{ id: 'keep', type: 'battery', position: { x: 0, y: 0 }, data: {} }] as never,
      edges: [{ id: 'keep-edge', source: 'keep', target: 'missing' }] as never,
      waterNodes: [],
    });
  });

  it('schließt per Esc und per ✕, ohne den Plan anzufassen', () => {
    const { unmount } = render(<OnboardingWizard />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().hasOnboarded).toBe(true);
    expect(usePlannerStore.getState().nodes).toHaveLength(1);
    unmount();

    useAppStore.setState({ hasOnboarded: false });
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }));
    expect(useAppStore.getState().hasOnboarded).toBe(true);
    expect(usePlannerStore.getState().nodes).toHaveLength(1);
  });

  it('bietet genau eine eindeutige Benennung für „ohne Vorlage“', () => {
    render(<OnboardingWizard />);
    expect(screen.queryByRole('button', { name: 'Leeren Plan starten' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mit leerem Plan beginnen' }).length).toBeGreaterThan(0);
  });

  it('zeigt in Schritt 2, dass nichts vorausgewählt ist', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText(/Nichts ist vorausgewählt/)).toBeInTheDocument();
    const consumerStep = screen.getByRole('region', { name: '2. Welche Geräte planst du?' });
    const laptop = within(consumerStep).getByRole('checkbox', { name: 'Laptop-Ladegerät' });
    expect(laptop).not.toBeChecked();
    for (const box of within(consumerStep).getAllByRole('checkbox')) {
      expect(box).not.toBeChecked();
    }
  });

  /**
   * UX-Audit 02.11.2026: Ohne `aria-label` hieß der Knopf „Autarker Kastenwagen
   * Empfohlen Verkabelter Kastenwagen mit …“ — Label, Abzeichen und Ganztext
   * verschmolzen zu einem Ansage-Satz. Der Name bleibt die Vorlage, der Text
   * kommt separat über `aria-describedby`.
   */
  it('nennt die Vorlagen-Knöpfe kurz und sagt die Beschreibung separat an', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const step = screen.getByRole('region', { name: '3. Wähle deine Basis' });
    const buttons = within(step).getAllByRole('button');
    expect(buttons).toHaveLength(PLANNER_TEMPLATES.length);

    for (const button of buttons) {
      const name = button.getAttribute('aria-label') ?? '';
      const [label, suffix] = name.split(', ');
      expect(PLANNER_TEMPLATES.map((template) => template.label)).toContain(label);
      expect(suffix === undefined || suffix === 'empfohlen').toBe(true);

      const describedBy = button.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const description = document.getElementById(describedBy!);
      expect(description?.textContent).toBe(
        PLANNER_TEMPLATES.find((template) => template.label === label)?.description
      );
      expect(name).not.toContain(description?.textContent ?? '@unmoeglich@');
    }

    expect(
      buttons.filter((button) => button.getAttribute('aria-label')?.endsWith(', empfohlen'))
    ).toHaveLength(1);
  });
});

describe('recommendedTemplateId', () => {
  it('empfiehlt eine Vorlage, die die angekreuzten Stromquellen enthält', () => {
    // main kennt „kastenwagen“ (Alias allrounder), nicht eine eigene allrounder-Id.
    expect(recommendedTemplateId({ solar: true }, {})).toBe('kastenwagen');
    expect(recommendedTemplateId({ booster: true }, {})).toBe('kastenwagen');
    expect(recommendedTemplateId({ landstrom: true }, {})).toBe('autark');
    expect(recommendedTemplateId({}, {})).toBe('minimalist');
    expect(recommendedTemplateId({}, { a: true, b: true, c: true })).toBe('kastenwagen');
    expect(recommendedTemplateId({ solar: true }, { a: true, b: true, c: true, d: true })).toBe('autark');
  });
});
