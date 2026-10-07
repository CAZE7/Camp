/**
 * lib/verify/validation158Fixture.ts — DER 158,7-A-PLAN als geteilte Quelle.
 *
 * Der Plan lebte zuerst nur im Regressionstest
 * (`validation158.regression.test.ts`). Die CLI-Sonde
 * (`scripts/verify/explainCableCurrent.ts`) braucht dieselben Daten — eine
 * zweite Kopie wäre genau die Art von Doppelwahrheit, die dieses Repo
 * verbietet. Deshalb steht der Plan hier (Fixture-Modul, keine Prüflogik) und
 * wird von Test UND Sonde gelesen.
 *
 * Aufbau (Auftrag Phase 1):
 *
 *   Batterie 200 Ah LiFePO4
 *     ├─ + 70 mm² / 0,2 m, 100 A → Plus-Busbar
 *     │     ├─ 70 mm² / 1 m → 1500-W-Inverter ── 230-V-Zweige (s. u.)
 *     │     └─ 16 mm² / 0,8 m → 12-V-Fuse Box → Kühlbox (4 mm²/2 m), Pumpe (6 mm²/2,5 m)
 *     └─ − 70 mm² / 0,2 m → Smart Shunt → 70 mm² / 0,5 m → Minus-Busbar
 *
 *   I_WR = 1500 W / (12,0 V × 0,85) = 147,0588 A
 *   I_Kühlbox = 60 W / 12,0 V = 5,0000 A
 *   I_Pumpe = 80 W / 12,0 V = 6,6667 A
 *   I_Hauptstrang = 158,7255 A → 158,7 A
 *
 *   AC: Inverter → 230-V-Verteilung ⇒ FI-Zweig ⇒ LS ⇒ geschützter Verbraucher;
 *       zweiter Zweig NUR mit LS (kein FI auf dem Pfad) ⇒ RCD-Befund.
 */

import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Node } from '../domain/graph';

/** Plan-Kante (Datenform ohne UI-Bezug). */
export interface FixturePlanEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  data: CableEdgeData;
}

export interface Validation158Plan {
  nodes: Node[];
  edges: FixturePlanEdge[];
}

/** Die Leitung, um die es im Befund geht (Batterie+ → Plus-Busbar). */
export const VALIDATION158_EDGE_ID = 'e-battery-plus-busbar';

const node = (id: string, type: string, data: Record<string, unknown>): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  data: CableEdgeData
): FixturePlanEdge => ({ id, source, target, sourceHandle, targetHandle, data });

const dc = (crossSection: number, length: number, extra: CableEdgeData = {}): CableEdgeData => ({
  crossSection,
  length,
  edgeDomain: 'DC_12V',
  ...extra,
});

const ac = (crossSection: number, length: number, extra: CableEdgeData = {}): CableEdgeData => ({
  crossSection,
  length,
  edgeDomain: 'AC_230V',
  ...extra,
});

/** Der reproduzierbare 158,7-A-Plan (Phase-1-Fixture). */
export function validation158RegressionPlan(): Validation158Plan {
  return {
    nodes: [
      node('battery', 'battery', {
        label: '200 Ah LiFePO4',
        role: 'house',
        capacity: 200,
        chemistry: 'LiFePO4',
        nominalVoltage: 12.8,
      }),
      node('smart-shunt', 'shunt', { label: 'Smart Shunt' }),
      node('busbar-plus', 'busbar', { label: 'Plus-Busbar' }),
      node('busbar-minus', 'busbar', { label: 'Minus-Busbar' }),
      node('fuse-box', 'fuse', { label: '12-V Fuse Box', rating: 25 }),
      node('inverter', 'inverter', {
        label: '1500-W-Inverter',
        watts: 1500,
        continuousPower: 1500,
        efficiency: 0.85,
        hasRcd: false,
      }),
      node('fridge', 'consumer', { label: 'Kompressorkühlbox', watts: 60 }),
      node('pump', 'consumer', { label: 'Wasserpumpe', watts: 80 }),
      node('ac-distribution', 'busbar', { label: '230-V-Verteilung vor FI' }),
      node('rcd-section', 'busbar', { label: 'FI/RCD-Abgang' }),
      node('protected-breaker', 'fuse', { label: 'LS geschützter Zweig', rating: 10 }),
      node('protected-distribution', 'busbar', { label: 'Verteilung hinter FI' }),
      node('consumer-protected', 'consumer230v', {
        label: '100-W-230-V-Verbraucher hinter FI',
        watts: 100,
      }),
      node('unprotected-breaker', 'fuse', { label: 'LS ungeschützter Zweig', rating: 16 }),
      node('consumer-unprotected', 'consumer230v', {
        label: '1200-W-230-V-Verbraucher ohne FI-Pfad',
        watts: 1200,
      }),
    ],
    edges: [
      // Batterie-/Shunt-Hauptpfad (70 mm²)
      edge(
        VALIDATION158_EDGE_ID,
        'battery',
        'busbar-plus',
        'plus',
        'plus',
        dc(70, 0.2, {
          fuseSize: 100,
          fuseType: 'mega',
          fuseOffset: 0.15,
        })
      ),
      edge('e-battery-shunt', 'battery', 'smart-shunt', 'minus', 'minus', dc(70, 0.2)),
      edge('e-shunt-minus-busbar', 'smart-shunt', 'busbar-minus', 'minus', 'minus', dc(70, 0.5)),
      // Wechselrichterzweig (70 mm²)
      edge(
        'e-plus-busbar-inverter',
        'busbar-plus',
        'inverter',
        'plus',
        'plus',
        dc(70, 1, {
          fuseSize: 100,
          fuseType: 'mega',
        })
      ),
      edge('e-inverter-minus-busbar', 'inverter', 'busbar-minus', 'minus', 'minus', dc(70, 1)),
      // Fuse-Box-Zweig
      edge(
        'e-plus-busbar-fuse-box',
        'busbar-plus',
        'fuse-box',
        'plus',
        'plus',
        dc(16, 0.8, {
          fuseSize: 25,
          fuseType: 'mega',
        })
      ),
      edge(
        'e-fuse-box-fridge',
        'fuse-box',
        'fridge',
        'plus',
        'plus',
        dc(4, 2, { fuseSize: 10, fuseType: 'ato' })
      ),
      edge('e-fridge-minus-busbar', 'fridge', 'busbar-minus', 'minus', 'minus', dc(4, 2)),
      edge(
        'e-fuse-box-pump',
        'fuse-box',
        'pump',
        'plus',
        'plus',
        dc(6, 2.5, { fuseSize: 15, fuseType: 'ato' })
      ),
      edge('e-pump-minus-busbar', 'pump', 'busbar-minus', 'minus', 'minus', dc(6, 2.5)),
      // AC-Zweige
      edge('e-inverter-ac-distribution', 'inverter', 'ac-distribution', 'plus', 'plus', ac(2.5, 0.5)),
      edge(
        'e-ac-distribution-rcd',
        'ac-distribution',
        'rcd-section',
        'plus',
        'plus',
        ac(2.5, 0.2, {
          acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
        })
      ),
      edge('e-rcd-protected-breaker', 'rcd-section', 'protected-breaker', 'plus', 'plus', ac(2.5, 0.2)),
      edge(
        'e-protected-breaker-distribution',
        'protected-breaker',
        'protected-distribution',
        'plus',
        'plus',
        ac(2.5, 0.2)
      ),
      edge(
        'e-protected-distribution-consumer',
        'protected-distribution',
        'consumer-protected',
        'plus',
        'plus',
        ac(1.5, 2)
      ),
      edge(
        'e-ac-distribution-unprotected-breaker',
        'ac-distribution',
        'unprotected-breaker',
        'plus',
        'plus',
        ac(2.5, 0.2)
      ),
      edge(
        'e-unprotected-breaker-consumer',
        'unprotected-breaker',
        'consumer-unprotected',
        'plus',
        'plus',
        ac(2.5, 3)
      ),
    ],
  };
}
