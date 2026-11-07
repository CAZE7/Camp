/**
 * Regressionen zum UI-Audit 2026-10-24 (Vorlagenmenü).
 *
 * Das Menü lag im Baum der Werkzeugleiste. `.cad-toolbar` schneidet mit
 * `overflow: hidden` ab, `.cad-toolbar__actions` scrollt waagerecht —
 * der Knopf war sichtbar, das Menü im DOM, aber unsichtbar und nicht
 * anklickbar. Es hängt jetzt am `body`; diese Suite hält das fest.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PlannerToolbar, type PlannerToolbarProps } from './PlannerToolbar';

const baseProps: PlannerToolbarProps = {
  busy: null,
  canUndo: false,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onAutoWire: vi.fn(),
  onCheck: vi.fn(),
  onBom: vi.fn(),
  onExport: vi.fn(),
  onShare: vi.fn(),
  viewMode: 'electric',
  onSelectViewMode: vi.fn(),
  focusMode: false,
  onToggleFocusMode: vi.fn(),
  overflow: [],
  openMenu: null,
  onOpenMenu: vi.fn(),
};

function renderToolbar(overrides: Partial<PlannerToolbarProps> = {}) {
  const onLoadTemplate = vi.fn();
  render(<PlannerToolbar {...baseProps} onLoadTemplate={onLoadTemplate} {...overrides} />);
  return { onLoadTemplate, trigger: screen.getByTestId('action-templates') };
}

describe('Vorlagenmenü der Werkzeugleiste', () => {
  it('rendert das Menü am Body statt in der abschneidenden Leiste', () => {
    const { trigger } = renderToolbar();

    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Vorlage laden' });
    expect(menu.parentElement).toBe(document.body);
    expect(screen.getByTestId('planner-toolbar').contains(menu)).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('schließt mit Escape und gibt den Fokus an den Auslöser zurück', () => {
    const { trigger } = renderToolbar();
    fireEvent.click(trigger);

    const firstItem = screen.getByTestId('toolbar-template-minimalist');
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(firstItem, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Vorlage laden' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('schließt bei einem Klick außerhalb', () => {
    const { trigger } = renderToolbar();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Vorlage laden' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Vorlage laden' })).not.toBeInTheDocument();
  });

  it('lädt die gewählte Vorlage, schließt das Menü und fokussiert den Auslöser', () => {
    const { onLoadTemplate, trigger } = renderToolbar();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByTestId('toolbar-template-kastenwagen'));

    expect(onLoadTemplate).toHaveBeenCalledWith('kastenwagen');
    expect(screen.queryByRole('menu', { name: 'Vorlage laden' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

/**
 * Nutzer-Rückmeldung 2026-10-26: „Die obere Leiste ist unübersichtlich — es
 * gibt Knöpfe, die doppelt sind, wie Optimieren und dieser andere
 * Automatik-Knopf.“ Es standen drei Aktionen nebeneinander, die den Plan von
 * selbst verändern. Diese Suite hält fest, dass die Leiste genau EINE
 * Automatikaktion anbietet und die nachgelagerten Schritte nur im Menü liegen.
 *
 * Ergänzung 2026-11-06: Die Schrittleiste ist entfallen. Der Automatik-Knopf
 * steht damit in JEDER Breite direkt in der Leiste und trägt seinen Namen
 * („Automatisch verbinden") statt nur „Vorschlag prüfen".
 */
describe('Werkzeugleiste — genau eine Automatikaktion', () => {
  it('zeigt genau eine Automatikaktion, sprechend beschriftet', () => {
    renderToolbar();

    const toolbar = screen.getByTestId('planner-toolbar');
    expect(within(toolbar).getByTestId('action-autowire')).toBeInTheDocument();
    // Kein zweiter Automatikknopf in der Leiste.
    expect(
      within(toolbar).queryByRole('button', { name: /Plan automatisch ordnen/ })
    ).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Kabel optimieren' })).not.toBeInTheDocument();
    // Die Primäraktion bleibt sprechend beschriftet (kein nacktes Symbol).
    expect(within(toolbar).getByTestId('action-autowire')).toHaveTextContent('Automatisch verbinden');
  });

  /**
   * WCAG 2.5.3 („Label in Name"): Der zugängliche Name muss den sichtbaren
   * Text enthalten — sonst sagt ein Sprachsteuerungs-Nutzer „Automatisch
   * verbinden" und der Knopf reagiert nicht.
   *
   * Beim Umbenennen 2026-11-06 lief genau das auseinander: sichtbar wurde
   * „Automatisch verbinden", der `aria-label` blieb „Auto-verbinden: Vorschlag
   * prüfen". axe findet das nicht, weil die Regel `label-content-name-mismatch`
   * als experimentell standardmäßig abgeschaltet ist. Deshalb hier von Hand.
   *
   * Im jsdom ist keine Medienabfrage aktiv, also stehen alle Beschriftungs-
   * Stufen im DOM — geprüft wird jede einzelne gegen den Namen.
   */
  it('hält jede sichtbare Beschriftung im zugänglichen Namen (WCAG 2.5.3)', () => {
    renderToolbar();

    const button = screen.getByTestId('action-autowire');
    const name = button.getAttribute('aria-label') ?? '';
    const labels = Array.from(button.querySelectorAll('span')).map((span) => span.textContent ?? '');

    expect(name).not.toBe('');
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toBe('');
      expect(name).toContain(label);
    }
  });

  it('nennt auch im Wasserplan die sichtbare Aktion und den Grund der Sperre', () => {
    renderToolbar({ viewMode: 'water' });

    const button = screen.getByTestId('action-autowire');
    const name = button.getAttribute('aria-label') ?? '';
    expect(name).toContain('Automatisch verbinden');
    expect(name).toContain('nur im Elektrikplan verfügbar');
  });
});
