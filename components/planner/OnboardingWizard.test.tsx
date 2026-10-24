import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OnboardingWizard, recommendedTemplateId } from './OnboardingWizard';
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
    expect(recommendedTemplateId({}, { heizung: true })).toBe('autark');
    expect(recommendedTemplateId({}, { laptop: true })).toBe('kastenwagen');
  });

  it('N18: ergänzt angekreuzte Geräte (z. B. Laptop-Ladegerät), wenn sie in der Vorlage fehlen', () => {
    useAppStore.setState({ hasOnboarded: false });
    usePlannerStore.setState({ nodes: [], edges: [], waterNodes: [] });
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Landstrom vom Campingplatz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Laptop-Ladegerät' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: /Großes Autark-Setup/ }));

    const state = usePlannerStore.getState();
    expect(state.nodes.some((n) => n.type === 'acBatteryCharger')).toBe(true);
    expect(
      state.nodes.some((n) => String((n.data as { label?: string })?.label ?? '').includes('Laptop'))
    ).toBe(true);
  });
});
