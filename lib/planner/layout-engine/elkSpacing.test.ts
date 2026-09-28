import { describe, expect, it } from 'vitest';
import { layoutWithElk } from '../../routing/elk/runner';
import { ROUTING_TOKENS } from '../../routing/tokens';
import { portsForNode } from './ports';

/**
 * ADR 0023 / Finding 2026-09-27 („ELK-Knotenabstand = ELK-Default ~10 px"):
 *
 * „Plan ordnen" lieferte Plätze, die der Router nicht kollisionsfrei verlegen
 * kann — zwischen zwei einander zugewandten Anschlüssen braucht er
 * `stubMin + laneGrid + cableClearance` = 52 px (ROUTE-BUG-32). ELK bekam für
 * `spacing.nodeNode` keinen Wert und nahm seinen Default: gemessen über die
 * sechs Referenzpläne I1 = 3, I2 = 21, I3 = 17 (Σ 41) allein wegen des
 * Abstands; mit dem Token sind es I1 = 0, I2 = 9, I3 = 1 (Σ 10).
 *
 * Der Test pinnt die Eigenschaft direkt an der Geometrie: Zwei Karten, die
 * ELK in dieselbe Spalte legt (zwei Verbraucher an einer Schiene), müssen
 * mindestens die Port-Freigabe auseinanderliegen.
 */
describe('ELK-Kartenabstand (ADR 0023)', () => {
  it('hält zwischen Karten die Port-Freigabe ein', async () => {
    const size = { width: 192, height: 120 };
    const plan = {
      nodes: [
        { id: 'bus', x: 0, y: 0, ...size, ports: [...portsForNode('bus', 'busbar')] },
        { id: 'load-a', x: 400, y: 0, ...size, ports: [...portsForNode('load-a', 'consumer')] },
        { id: 'load-b', x: 400, y: 300, ...size, ports: [...portsForNode('load-b', 'consumer')] },
      ],
      edges: [
        {
          id: 'e-a',
          source: 'bus',
          target: 'load-a',
          sourcePort: 'bus::source:plus',
          targetPort: 'load-a::target:plus',
        },
        {
          id: 'e-b',
          source: 'bus',
          target: 'load-b',
          sourcePort: 'bus::source:plus',
          targetPort: 'load-b::target:plus',
        },
      ],
      direction: 'LR' as const,
    };

    const result = await layoutWithElk(plan);
    const a = result.nodes.get('load-a')!;
    const b = result.nodes.get('load-b')!;
    const gap = Math.abs(b.y - a.y) - size.height;

    expect(
      gap,
      `Kartenabstand ${gap} px < Port-Freigabe ${ROUTING_TOKENS.portFacingClearance} px ` +
        '(ELK-Default statt Token — der Router kann zwischen den Karten nicht verlegen)'
    ).toBeGreaterThanOrEqual(ROUTING_TOKENS.portFacingClearance);
  }, 30_000);
});
