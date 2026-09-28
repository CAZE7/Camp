import { describe, expect, it } from 'vitest';
import { BUILTIN_COMPONENT_SPECS } from '../../../components/registry/builtinComponents';
import { layoutWithElk } from '../../routing/elk/runner';
import { layoutPortId, layoutPortForHandle, portSpecsForKind, portsForNode } from './ports';

/**
 * Finding 2026-09-27 („Ports fehlen"): ELK bekam keine Anschlüsse, also war
 * `FIXED_ORDER` wirkungslos und Bauteile durften mit dem Anschluss in die
 * falsche Richtung stehen. `ports.ts` ist die Domänen-Kopie der Registry —
 * dieser Test hält beide zusammen (Vorbild: connectionPolicy.test.ts).
 *
 * Testdateien dürfen beiderlei Seiten ziehen (Präzedenz:
 * lib/autoWire/placement.test.ts, siehe libBoundary.test.ts).
 */
describe('Layout-Ports (Finding 2026-09-27)', () => {
  it('jede Registry-Handle hat genau einen Port mit passender Rolle', () => {
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      const expected = spec.handles
        .map((handle) => `${handle.type}:${handle.id}`)
        .sort((a, b) => a.localeCompare(b));
      const actual = portSpecsForKind(spec.id)
        .map((port) => `${port.role}:${port.handle}`)
        .sort((a, b) => a.localeCompare(b));
      expect(actual, `Ports für ${spec.id}`).toEqual(expected);
    }
  });

  it('Seiten folgen der Konvention: Eingänge WEST, Ausgänge EAST, `ac_in` NORTH', () => {
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      for (const port of portSpecsForKind(spec.id)) {
        if (spec.id === 'inverter' && port.handle === 'ac_in') {
          expect(port.side, 'Wechselrichter-Netzeingang liegt oben').toBe('NORTH');
        } else if (port.role === 'target') {
          expect(port.side, `${spec.id}:${port.handle} ist Eingang`).toBe('WEST');
        } else {
          expect(port.side, `${spec.id}:${port.handle} ist Ausgang`).toBe('EAST');
        }
      }
    }
  });

  it('plus steht vor minus (FIXED_ORDER) und Dachelemente haben keine Ports', () => {
    const battery = portSpecsForKind('battery');
    expect(battery.find((port) => port.role === 'target' && port.handle === 'plus')?.index).toBe(0);
    expect(battery.find((port) => port.role === 'target' && port.handle === 'minus')?.index).toBe(1);
    expect(portSpecsForKind('roofWindow')).toEqual([]);
    expect(portSpecsForKind('unbekannt')).toEqual([]);
    expect(portSpecsForKind(undefined)).toEqual([]);
  });

  /**
   * elkjs löst Kanten-Endpunkte über einen graphweiten Namensraum auf: Zwei
   * Knoten mit derselben Port-ID führen dazu, dass die Kante am falschen
   * Knoten andockt (mit echtem elkjs verifiziert). Deshalb steckt die
   * Knoten-ID in der Port-ID.
   */
  it('Port-IDs sind knotenbezogen und graphweit eindeutig', () => {
    const a = portsForNode('a', 'battery').map((port) => port.id);
    const b = portsForNode('b', 'battery').map((port) => port.id);
    expect(a).toContain(layoutPortId('a', 'target', 'plus'));
    expect(new Set([...a, ...b]).size).toBe(a.length + b.length);
  });

  it('unbekannte Handles liefern keine Port-ID (Fallback auf die Knoten-ID)', () => {
    expect(layoutPortForHandle('n1', 'battery', 'source', 'plus')).toBe(layoutPortId('n1', 'source', 'plus'));
    expect(layoutPortForHandle('n1', 'battery', 'source', 'gibtsNicht')).toBeUndefined();
    expect(layoutPortForHandle('n1', 'battery', 'source', null)).toBeUndefined();
    expect(layoutPortForHandle('n1', 'roofWindow', 'target', 'plus')).toBeUndefined();
  });

  /**
   * Ende-zu-Ende mit echtem elkjs: Die Leitung aus dem Landstrom-Eingang
   * endet an der OBEREN Kante des Wechselrichters, die AC-Leitung startet an
   * seiner RECHTEN Kante. Genau das war vorher nicht garantiert — ohne Ports
   * durfte ELK die Karte beliebig anordnen, und das Kabel lief über sie
   * hinweg statt an den Anschluss.
   */
  it('echtes ELK dockt Leitungen an den deklarierten Kartenseiten an', async () => {
    const size = { width: 192, height: 120 };
    const result = await layoutWithElk({
      nodes: [
        { id: 'sh', x: 0, y: 0, ...size, ports: [...portsForNode('sh', 'shorePower')] },
        { id: 'inv', x: 400, y: 0, ...size, ports: [...portsForNode('inv', 'inverter')] },
        { id: 'ac', x: 800, y: 0, ...size, ports: [...portsForNode('ac', 'consumer230v')] },
      ],
      edges: [
        {
          id: 'e1',
          source: 'sh',
          target: 'inv',
          sourcePort: layoutPortForHandle('sh', 'shorePower', 'source', 'plus'),
          targetPort: layoutPortForHandle('inv', 'inverter', 'target', 'ac_in'),
        },
        {
          id: 'e2',
          source: 'inv',
          target: 'ac',
          sourcePort: layoutPortForHandle('inv', 'inverter', 'source', 'plus'),
          targetPort: layoutPortForHandle('ac', 'consumer230v', 'target', 'plus'),
        },
      ],
      direction: 'LR',
    });

    const inverter = result.nodes.get('inv')!;
    const incoming = result.routes.get('e1')!;
    const outgoing = result.routes.get('e2')!;
    const dock = incoming[incoming.length - 1]!;
    const start = outgoing[0]!;

    expect(
      Math.abs(dock.y - inverter.y) < 3 && dock.x >= inverter.x && dock.x <= inverter.x + size.width,
      `Landstrom endet an der Oberseite: ${JSON.stringify(dock)} bei ${JSON.stringify(inverter)}`
    ).toBe(true);
    expect(
      Math.abs(start.x - (inverter.x + size.width)) < 3 &&
        start.y >= inverter.y &&
        start.y <= inverter.y + size.height,
      `AC-Ausgang startet an der rechten Kante: ${JSON.stringify(start)} bei ${JSON.stringify(inverter)}`
    ).toBe(true);
  }, 60_000);
});
