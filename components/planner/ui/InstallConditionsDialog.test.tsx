import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePlannerStore } from '../../../store/usePlannerStore';
import { DEFAULT_INSTALL_CONDITIONS } from '../utils/verificationWarnings';
import { InstallConditionsDialog } from './InstallConditionsDialog';

/**
 * Der Dialog, in dem ein Plan seine Verlegung angibt.
 *
 * Geprüft wird genau die Kette, die der Audit-Befund vermisst hat: Nutzer tippt
 * Zahl → Store → Prüfbericht. Zwei Zusagen sind dabei harder als der Rest:
 *
 *   1. Was die Engine ablehnt (80 °C bei PVC, T_max 70 °C), darf den Store nie
 *      erreichen — `verifyPlan` würde mit RangeError sterben und die
 *      Live-Validierung mit ihm.
 *   2. Was die Engine NICHT weiß (Verlegeart, f₃ = 1), muss dabeistehen, sonst
 *      liest sich ein grünes Urteil als Aussage über eine Verlegeart, die nie
 *      geprüft wurde.
 */
const oeffnen = () => fireEvent(window, new Event('planner-open-install-conditions'));

describe('InstallConditionsDialog', () => {
  beforeEach(() => {
    usePlannerStore.setState({
      installConditions: DEFAULT_INSTALL_CONDITIONS,
      cableBundling: {},
    });
    render(<InstallConditionsDialog />);
  });

  it('zeigt die aktuellen Bedingungen des Plans', () => {
    void act(() =>
      usePlannerStore.setState({
        installConditions: { ambientC: 45, insulation: 'XLPE', bundledCircuits: 3 },
      })
    );
    oeffnen();
    expect((screen.getByLabelText(/Umgebungstemperatur/i) as HTMLInputElement).value).toBe('45');
    expect((screen.getByLabelText(/Isolierstoff/i) as HTMLSelectElement).value).toBe('XLPE');
    expect((screen.getByLabelText(/Häufung/i) as HTMLInputElement).value).toBe('3');
  });

  it('schreibt eine gültige Temperatur in den Plan', () => {
    oeffnen();
    fireEvent.change(screen.getByLabelText(/Umgebungstemperatur/i), { target: { value: '60' } });
    expect(usePlannerStore.getState().installConditions.ambientC).toBe(60);
  });

  it('lehnt 80 °C bei PVC ab und lässt den Planwert in Ruhe', () => {
    oeffnen();
    const feld = screen.getByLabelText(/Umgebungstemperatur/i);
    fireEvent.change(feld, { target: { value: '80' } });

    // Die Zahl steht im Feld (der Nutzer sieht, was er tippte)…
    expect((feld as HTMLInputElement).value).toBe('80');
    // …angewendet wird sie nicht, und das Warum steht daneben — in den Worten
    // der Engine, nicht einer zweiten, hier erdachten Begründung.
    expect(usePlannerStore.getState().installConditions.ambientC).toBe(30);
    const status = screen.getByRole('status').textContent ?? '';
    expect(status).toContain('Noch nicht übernommen');
    expect(status).toContain('unzulässig');
  });

  it('lässt 80 °C bei XLPE gelten', () => {
    oeffnen();
    fireEvent.change(screen.getByLabelText(/Isolierstoff/i), { target: { value: 'XLPE' } });
    fireEvent.change(screen.getByLabelText(/Umgebungstemperatur/i), { target: { value: '80' } });

    expect(usePlannerStore.getState().installConditions).toEqual({
      ambientC: 80,
      insulation: 'XLPE',
      bundledCircuits: 1,
    });
  });

  it('benennt die Verlegeart als nicht modelliert', () => {
    oeffnen();
    // f₃ ist hart 1,0, weil es nur eine Tabellenbasis gibt. Wer das nicht sagt,
    // verkauft ein Urteil über Luft als Urteil über einen Kabelkanal.
    expect(screen.getByRole('status').textContent).toContain('Verlegeart');
  });
});
