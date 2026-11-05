import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { getCableCurrents } from './currentFlow';
import { type CableEdgeData } from '../../components/edges/CableEdge';

/**
 * AUD-005 — die Gleichzeitigkeits-Auswahl darf die Kabelauslegung NICHT
 * verkleinern.
 *
 * Befund: `concurrentDevices` am Wechselrichter steuert die Überlast-Prüfung
 * (Karten-Badge, Dashboard-Warnung). Das Strommodell summiert dagegen über
 * `buildAcIslandWatts` ALLE `consumer230v` der AC-Insel. Eine Sonde im Audit
 * zeigte: WR 1000 W, Kaffee 1500 W + Kocher 500 W, ausgewählt nur der Kocher
 * → DC-Kabel trotzdem 196,08 A (2000 W / 12 V / 0,85).
 *
 * Das ist die KONSERVATIVE und gewollte Auslegung: Ein Nutzer darf eine
 * Sicherung nicht dadurch verkleinern, dass er erklärt, er schalte selten
 * beide Geräte ein. Der Fehler war nicht die Rechnung, sondern dass die
 * Oberfläche etwas anderes suggerierte.
 *
 * Dieser Test ist ein Wächter gegen die naheliegende „Reparatur", die
 * Auswahl in die Dimensionierung zu übernehmen und damit Schutzorgane zu
 * verkleinern. Die UI-Klärung steht in NodeInspectors/InverterNode.
 */

const battery: Node = {
  id: 'bat',
  type: 'battery',
  position: { x: 0, y: 0 },
  data: { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8, role: 'house' },
};

const inverter = (concurrentDevices: string[]): Node => ({
  id: 'inv',
  type: 'inverter',
  position: { x: 200, y: 0 },
  data: { continuousPower: 1000, watts: 1000, efficiency: 0.85, concurrentDevices },
});

const acLoad = (id: string, watts: number): Node => ({
  id,
  type: 'consumer230v',
  position: { x: 400, y: 0 },
  data: { watts, label: id },
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string
): Edge<CableEdgeData> =>
  ({ id, source, target, sourceHandle, targetHandle, data: {} }) as Edge<CableEdgeData>;

describe('AUD-005 — Kabelauslegung bleibt die volle AC-Insel (konservativ)', () => {
  const nodes = (concurrentDevices: string[]) => [
    battery,
    inverter(concurrentDevices),
    acLoad('coffee', 1500),
    acLoad('cooker', 500),
  ];
  const edges = [
    edge('dc', 'bat', 'inv', 'plus', 'plus'),
    edge('ac1', 'inv', 'coffee', 'ac_in', 'ac_in'),
    edge('ac2', 'inv', 'cooker', 'ac_in', 'ac_in'),
  ];

  it('dimensioniert die DC-Zuleitung nach der Insel-Summe, nicht nach der Auswahl', () => {
    const onlyCooker = getCableCurrents(nodes(['cooker']), edges).byEdgeId.get('dc');
    const nothingSelected = getCableCurrents(nodes([]), edges).byEdgeId.get('dc');
    const bothSelected = getCableCurrents(nodes(['coffee', 'cooker']), edges).byEdgeId.get('dc');

    expect(onlyCooker?.operatingCurrent).toBeDefined();
    // Alle drei Auswahlzustände ergeben denselben Auslegungsstrom.
    // Insel-Summe 2000 W, Entlade-Spannungsboden 12,8 V · 0,9375 = 12,0 V,
    // Wirkungsgrad 0,85 ⇒ 2000 / 12,0 / 0,85 ≈ 196,08 A (Audit-Sonde).
    expect(onlyCooker?.operatingCurrent).toBeCloseTo(196.08, 1);
    expect(nothingSelected?.operatingCurrent).toBeCloseTo(196.08, 1);
    expect(bothSelected?.operatingCurrent).toBeCloseTo(196.08, 1);
  });

  it('ändert auch die AC-Ströme nicht durch die Auswahl', () => {
    const a = getCableCurrents(nodes(['cooker']), edges);
    const b = getCableCurrents(nodes([]), edges);
    expect(a.byEdgeId.get('ac1')?.operatingCurrent).toBeCloseTo(
      b.byEdgeId.get('ac1')?.operatingCurrent ?? -1,
      6
    );
    expect(a.byEdgeId.get('ac2')?.operatingCurrent).toBeCloseTo(
      b.byEdgeId.get('ac2')?.operatingCurrent ?? -1,
      6
    );
  });
});
