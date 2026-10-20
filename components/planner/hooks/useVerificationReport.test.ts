import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { shorePlan } from '../../../lib/verify/planFixtures';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { DEFAULT_INSTALL_CONDITIONS } from '../utils/verificationWarnings';
import { useVerificationReport } from './useLiveValidation';

/**
 * Naht Store → Prüfbericht.
 *
 * Der Planer prüft nicht mehr gegen die Tabellenreferenz, während der Nutzer
 * etwas anderes eingestellt hat: `useVerificationReport` liest die
 * Verlegebedingungen des Stores, und eine Änderung daran muss dasselbe Urteil
 * desselben Plans verschieben. Diese Datei hält genau diese eine Zusagenkette
 * fest — die Rechnung selbst prüft `verificationWarnings.test.ts`.
 */
const plan = shorePlan();

describe('useVerificationReport — Verlegebedingungen des Plans treiben die Prüfung', () => {
  it('rechnet mit den Tabellen-Defaults, solange der Plan nichts angibt', () => {
    void act(() =>
      usePlannerStore.setState({ installConditions: DEFAULT_INSTALL_CONDITIONS, cableBundling: {} })
    );
    const { result } = renderHook(() => useVerificationReport(plan.nodes, plan.edges as never));
    // Der Landstrom-Plan hat keine Batterie: unvollständig belegt, nicht
    // bestanden — und keine einzige Ampazitäts-Verletzung.
    expect(result.current.verdict).toBe('INCOMPLETE');
    expect(result.current.coverage.failed).toBe(0);
  });

  it('dieselbe Leitung bei 60 °C Umgebung: das Urteil kippt, ohne dass der Plan sich ändert', () => {
    void act(() =>
      usePlannerStore.setState({ installConditions: DEFAULT_INSTALL_CONDITIONS, cableBundling: {} })
    );
    const { result } = renderHook(() => useVerificationReport(plan.nodes, plan.edges as never));
    const referenz = result.current;

    void act(() =>
      usePlannerStore.setState({
        installConditions: { ambientC: 60, insulation: 'PVC', bundledCircuits: 1 },
      })
    );

    expect(result.current.verdict).toBe('NON_COMPLIANT');
    expect(result.current.coverage.failed).toBeGreaterThan(0);
    // Der Fingerprint deckt ausdrücklich Plan UND Annahmen ab
    // (`planFingerprintHash` in lib/verify/pipeline.ts): Ein Freigabestempel für
    // 30 °C darf nicht für 60 °C weitergelten. Wäre er gleich geblieben, hätte
    // die Änderung der Verlegung keine Auswirkung auf die Urteilsbindung.
    expect(result.current.certificate.planFingerprintHash).not.toBe(referenz.certificate.planFingerprintHash);
    expect(result.current.certificate.certificateHash).not.toBe(referenz.certificate.certificateHash);
  });

  it('Häufung einzelner Leitungen erreicht den Bericht desselben Laufs', () => {
    void act(() =>
      usePlannerStore.setState({
        installConditions: DEFAULT_INSTALL_CONDITIONS,
        cableBundling: { 'e-shore-load': 9 },
      })
    );
    const { result } = renderHook(() => useVerificationReport(plan.nodes, plan.edges as never));
    expect(result.current.verdict).toBe('NON_COMPLIANT');
  });
});
