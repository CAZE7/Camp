import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShorePowerInspector, SolarInspector } from './NodeInspectors';
import { type NodeDataPatch } from '../nodes/types'; // AUDIT T1: Mock-Signatur
import { closeTo } from '../../test-helpers/matchers'; // AUDIT T1
import type { InspectorNode } from './NodeInspectors';
import { solarColdVocOf } from '../../lib/solar';
import { evaluateAcEdgeProtection } from '../../lib/acProtection'; // AUDIT N1

/**
 * AUDIT S1 — die Naht zwischen Anzeige und Modell.
 *
 * Der Befund war kein Rechenfehler, sondern eine Einheitslücke an genau dieser
 * Stelle: Das Feld war mit „%/K" beschriftet und schrieb `−Math.abs(val)`
 * unverändert in `node.data.tempCoefficient`, während `lib/solar.ts` mit einem
 * Bruch rechnete (Default −0,0035). Ein 22-V-Panel ergab 368,5 V Kalt-Voc
 * statt 25,5 V — Faktor 14,5 auf die Prüfung des MPPT-Eingangsfensters.
 *
 * Diese Tests pinnen die Umrechnung an der UI-Grenze: angezeigt wird %/K,
 * gespeichert wird der Bruch, und was die UI schreibt, rechnet das Modell
 * korrekt weiter.
 */

const solarNode = (data: Record<string, unknown>): InspectorNode<'solar'> => ({
  id: 'solar-1',
  type: 'solar',
  position: { x: 0, y: 0 },
  data,
});

const LABEL = /Temp\.-Koeffizient Voc/i;

describe('SolarInspector — Temperaturkoeffizient Voc (AUDIT S1)', () => {
  // AUDIT T1: ohne Signatur war `mock.calls[0]` ein `any[]` — genau die
  // Aufrufargumente, die diese Tests prüfen, waren untypt.
  const onUpdateNodeData = vi.fn<(id: string, patch: NodeDataPatch) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt den gespeicherten Bruch als %/K an', () => {
    render(
      <SolarInspector
        node={solarNode({ voc: 22, tempCoefficient: -0.0035 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(-0.35, 10);
  });

  it('zeigt einen Altwert in Prozent-Schreibweise ebenfalls als %/K an', () => {
    // Pläne, die vor dem Fix gespeichert wurden, tragen −0,35 im Feld.
    render(
      <SolarInspector
        node={solarNode({ voc: 22, tempCoefficient: -0.35 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(-0.35, 10);
  });

  it('ohne Datenblattwert steht der Default (−0,35 %/K) im Feld', () => {
    render(<SolarInspector node={solarNode({ voc: 22 })} onUpdateNodeData={onUpdateNodeData} />);
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(-0.35, 10);
  });

  it('schreibt den Bruch, wenn %/K eingegeben werden', () => {
    render(
      <SolarInspector
        node={solarNode({ voc: 22, tempCoefficient: -0.0035 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: '0.35' } });

    expect(onUpdateNodeData).toHaveBeenCalledTimes(1);
    const [id, patch] = onUpdateNodeData.mock.calls[0]!;
    expect(id).toBe('solar-1');
    expect(patch).toEqual({ tempCoefficient: closeTo(-0.0035, 12) });
  });

  it('was die UI schreibt, rechnet das Modell ohne Faktor-14,5-Sprung weiter', () => {
    // End-to-End-Gegenprobe zum Befund: UI-Wert → Datenfeld → Kalt-Voc.
    let stored: number | undefined;
    render(
      <SolarInspector
        node={solarNode({ voc: 22 })}
        onUpdateNodeData={(_id, patch) => {
          stored = (patch as { tempCoefficient?: number }).tempCoefficient;
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: '0.35' } });

    const coldVoc = solarColdVocOf(solarNode({ voc: 22, tempCoefficient: stored }));
    expect(coldVoc).not.toBeNull();
    expect(coldVoc!).toBeCloseTo(25.465, 3); // 22 V · (1 + 0,0035 · 45 K)
    expect(coldVoc!).toBeLessThan(30); // vorher: 368,5 V
  });

  it('lehnt einen Prozent-Tippfehler (35 statt 0,35) ab', () => {
    render(
      <SolarInspector
        node={solarNode({ voc: 22, tempCoefficient: -0.0035 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: '35' } });

    expect(onUpdateNodeData).not.toHaveBeenCalled();
    expect(screen.getByText(/zwischen −1 und 0 %\/K/)).toBeInTheDocument();
  });

  // Das deutsche Dezimalkomma wird hier bewusst NICHT geprüft: Dieses Feld ist
  // `type="number"`, und sowohl der Browser als auch jsdom wenden die
  // Value-Sanitization an — ein Komma-Wert erreicht React gar nicht erst
  // (jsdom macht daraus den Leerstring). Die Komma-Toleranz des Parsers ist
  // an den Stellen getestet, an denen sie tatsächlich vorkommt:
  // `components/ui/ValidatingInput.test.tsx` (Textfeld) und
  // `lib/units.test.ts` (gespeicherte/importierte Strings via parseQuantity).
});

/**
 * AUDIT N1 — gemessener/angegebener Kurzschlussstrom der Einspeisung.
 *
 * Der Befund: `I_p = U0/Zs` war durch die Annahme von 0,8 Ω vorgelagert bei
 * ≈ 0,29 kA gedeckelt, real erfasste Geräte liegen bei 3–10 kA — die Prüfung
 * des Abschaltvermögens konnte für kein Gerät kippen. Der stärkste Wert, den
 * ein Nutzer beitragen kann, ist der I_k seiner Einspeisestelle. Dieses Feld
 * ist die Naht, über die er ins Modell kommt: optional, löschbar, und was hier
 * geschrieben wird, entscheidet die Prüfung.
 */
const shorePowerNode = (data: Record<string, unknown>): InspectorNode<'shorePower'> => ({
  id: 'shore-1',
  type: 'shorePower',
  position: { x: 0, y: 0 },
  data,
});

const IK_LABEL = /Prospektiver Kurzschlussstrom/i;

describe('ShorePowerInspector — I_k der Einspeisung (AUDIT N1)', () => {
  const onUpdateNodeData = vi.fn<(id: string, patch: NodeDataPatch) => void>(); // AUDIT T1

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ist ohne Angabe leer — kein erfundener Wert im Feld', () => {
    render(<ShorePowerInspector node={shorePowerNode({})} onUpdateNodeData={onUpdateNodeData} />);
    expect((screen.getByLabelText(IK_LABEL) as HTMLInputElement).value).toBe('');
  });

  it('zeigt einen gespeicherten Wert in Ampere', () => {
    render(
      <ShorePowerInspector
        node={shorePowerNode({ prospectiveIkA: 4500 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    expect((screen.getByLabelText(IK_LABEL) as HTMLInputElement).value).toBe('4500');
  });

  it('schreibt den eingegebenen Strom als Zahl', () => {
    render(<ShorePowerInspector node={shorePowerNode({})} onUpdateNodeData={onUpdateNodeData} />);
    fireEvent.change(screen.getByLabelText(IK_LABEL), { target: { value: '6000' } });

    expect(onUpdateNodeData).toHaveBeenCalledTimes(1);
    const [id, patch] = onUpdateNodeData.mock.calls[0]!;
    expect(id).toBe('shore-1');
    expect(patch).toEqual({ prospectiveIkA: 6000 });
  });

  it('nimmt die Angabe beim Leeren zurück (optionales Feld bleibt löschbar)', () => {
    render(
      <ShorePowerInspector
        node={shorePowerNode({ prospectiveIkA: 6000 })}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
    fireEvent.change(screen.getByLabelText(IK_LABEL), { target: { value: '' } });

    expect(onUpdateNodeData).toHaveBeenCalledWith('shore-1', { prospectiveIkA: undefined });
  });

  it('lehnt unsinnige Angaben ab (0 A ist kein Kurzschlussstrom)', () => {
    render(<ShorePowerInspector node={shorePowerNode({})} onUpdateNodeData={onUpdateNodeData} />);
    fireEvent.change(screen.getByLabelText(IK_LABEL), { target: { value: '0' } });

    expect(onUpdateNodeData).not.toHaveBeenCalled();
  });

  it('was die UI schreibt, macht die Abschaltvermögens-Prüfung scharf', () => {
    // End-to-End-Gegenprobe zum Befund: Feldwert → Knotendaten → Verdikt.
    let stored: number | undefined;
    render(
      <ShorePowerInspector
        node={shorePowerNode({})}
        onUpdateNodeData={(_id, patch) => {
          stored = (patch as { prospectiveIkA?: number }).prospectiveIkA;
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(IK_LABEL), { target: { value: '6000' } });

    const edge = {
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 4.5 },
      lengthM: 5,
      crossSection: 2.5,
    };
    // Ohne Angabe: unerreichbar — 4,5 kA bestehen gegen ≈ 0,29 kA.
    expect(evaluateAcEdgeProtection(edge).verdict).toBe('ok-with-assumption');
    // Mit dem Wert aus dem Feld: dasselbe Gerät fällt durch.
    expect(evaluateAcEdgeProtection({ ...edge, supplyProspectiveIkA: stored }).verdict).toBe(
      'breaking-capacity-fail'
    );
  });
});
