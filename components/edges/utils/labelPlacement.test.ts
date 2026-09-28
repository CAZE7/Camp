import { describe, expect, it } from 'vitest';
import complexPlan from '../../../knownPlans/complex.json';
import measuredComplexGeometry from '../../../tests/fixtures/routing/complex-measured-geometry.json';
import { placeLabelClearOfLabels, routeAllCables, type RouteEdgeRef } from './routeAll';
import { LABEL_BOX_HEIGHT, LABEL_BOX_WIDTH, boxesOverlap, labelBoundingBox } from './pathUtils';
import {
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type GeometryNode,
  type RoutableNode,
} from './nodeGeometry';

/**
 * Label-Platzierung — Regressionstest zum Befund 2026-09-28.
 *
 * Anlass waren zwei Screenshots derselben Werkbank:
 *   1. „… 3.0 m · 4.0 m" — zwei Labels lagen exakt übereinander (Δy = 0/1 px)
 *      und lasen sich als EIN Label. Ursache: `edgeLabelNudge` trennt nur
 *      Labels desselben Kantenpaars am selben Handle; fremde Paare bekamen
 *      denselben Trassenmittelpunkt.
 *   2. Ein Label verschwand halb hinter einer Bauteilkarte. Ursache: Das
 *      Kollisionsmodell rechnete mit 88 × 20 (Prüfung) bzw. 112 × 28
 *      (Platzierung), das gerenderte Label ist ≈ 156 × 22 px — die Prüfung
 *      sah den Text nicht, den der Nutzer sah.
 *
 * Der Test misst beides am echten Plan mit gemessener React-Flow-Geometrie
 * (`knownPlans/complex.json`, 23 Kanten). Er ist ein Gate: Label-Überdeckung
 * ist im Bild ein Fehler, nicht Geschmack.
 */

/** Knoten/Bauteil für die Kollisionsprobe (gemessene Geometrie wie im Canvas). */
const N2 = (id: string, type: string, x: number, y: number): RoutableNode =>
  ({
    id,
    type,
    position: { x, y },
    measured: { width: 192, height: 96 },
    internals: { positionAbsolute: { x, y }, handleBounds: undefined },
    data: { label: id },
  }) as unknown as RoutableNode;

const E2 = (id: string, source: string, target: string): RouteEdgeRef =>
  ({
    id,
    source,
    target,
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cable',
    data: { edgeDomain: 'DC_12V', crossSection: 4 },
  }) as unknown as RouteEdgeRef;

function buildPlan(): { nodes: RoutableNode[]; edges: RouteEdgeRef[] } {
  const geometryById = new Map(measuredComplexGeometry.nodes.map((node) => [node.id, node]));
  const nodes = (complexPlan.autoWire.nodes as unknown as { id: string }[]).map((node) => {
    const g = geometryById.get(node.id);
    expect(g, `gemessene Geometrie fehlt für ${node.id}`).toBeDefined();
    return {
      ...node,
      measured: g!.measured,
      internals: { positionAbsolute: g!.position, handleBounds: g!.handleBounds },
    };
  }) as unknown as RoutableNode[];
  return { nodes, edges: complexPlan.autoWire.edges as unknown as RouteEdgeRef[] };
}

describe('Label-Platzierung (Befund 2026-09-28)', () => {
  const { nodes, edges } = buildPlan();
  const routes = routeAllCables(nodes, edges);
  const nodeRects = nodes.map((node) => {
    const g = node as unknown as GeometryNode;
    return {
      x: nodeOriginX(g),
      y: nodeOriginY(g),
      width: nodeWidth(g, 192),
      height: nodeHeight(g, 96),
    };
  });

  /**
   * Ratchet statt Null-Gate: In diesem dichten Plan (14 Karten auf ~1000 × 700)
   * gibt es Trassen, die zwischen zwei Karten komplett unter einer Karte
   * liegen — eine kartenfreie Stelle existiert dort nicht. Gemessen am
   * 2026-09-28 nach dem Umbau: 8 solcher Labels. Sie sind seit dem
   * Z-Order-Fix lesbar (die Label-Ebene liegt über den Karten), deshalb ist
   * „0" hier kein sinnvolles Ziel — „nicht schlechter werden" schon.
   */
  it('Label über Karte bleibt bei höchstens 8 (Ratchet)', () => {
    let overlaps = 0;
    for (const [, route] of routes) {
      const box = labelBoundingBox(route.labelX, route.labelY);
      for (const rect of nodeRects) {
        if (boxesOverlap(box, rect)) {
          overlaps += 1;
          break;
        }
      }
    }
    expect(
      overlaps,
      'Mehr Labels über Karten als beim Umbau gemessen — Platzierung verschlechtert'
    ).toBeLessThanOrEqual(8);
  });

  /**
   * Der Screenshot-Fall „… 3.0 m · 4.0 m": zwei Leitungen VERSCHIEDENER
   * Knotenpaare, deren Trassen-Mittelpunkte zusammenfallen. `edgeLabelNudge`
   * trennt nur Labels desselben Paars — fremde Paare bekamen denselben Anker
   * und lasen sich als ein Label. Die beiden Trassen kreuzen sich in der Mitte
   * (300, 0), also liegt dort auch beider Mittelpunkt.
   */
  it('zwei Labels fremder Knotenpaare am selben Mittelpunkt liegen nicht aufeinander', () => {
    const crossingNodes: RoutableNode[] = [
      N2('a', 'busbar', 0, -200),
      N2('b', 'consumer', 600, 200),
      N2('c', 'busbar', 0, 200),
      N2('d', 'consumer', 600, -200),
    ];
    const crossingEdges: RouteEdgeRef[] = [E2('x1', 'a', 'b'), E2('x2', 'c', 'd')];
    const crossingRoutes = routeAllCables(crossingNodes, crossingEdges);
    const boxes = [...crossingRoutes.entries()].map(([id, route]) => ({
      id,
      box: labelBoundingBox(route.labelX, route.labelY),
    }));
    expect(boxes).toHaveLength(2);
    expect(boxesOverlap(boxes[0]!.box, boxes[1]!.box), `Labels übereinander: ${JSON.stringify(boxes)}`).toBe(
      false
    );
  });

  it('ist deterministisch: zwei Läufe ⇒ identische Label-Positionen', () => {
    const again = routeAllCables(nodes, edges);
    const positions = (map: typeof again) =>
      [...map.entries()].map(([id, route]) => [id, route.labelX, route.labelY]);
    expect(positions(again)).toEqual(positions(routes));
  });

  it('weicht vertikal in Spread-Stufen aus und bleibt sonst am Anker', () => {
    const card = { x: 0, y: 0, width: 400, height: 400 };
    // Anker frei, keine Nachbarn ⇒ unverändert.
    expect(placeLabelClearOfLabels({ x: 800, y: 800 }, [card], [])).toEqual({ x: 800, y: 800 });
    // Ein Nachbar belegt den Anker ⇒ nächste Stufe.
    const anchor = { x: 800, y: 800 };
    const taken = [labelBoundingBox(800, 800)];
    expect(placeLabelClearOfLabels(anchor, [card], taken)).not.toEqual(anchor);
    // Ohne freien Platz bleibt der Anker (lieber überlappend als ohne Bezug).
    const blockEverything = [{ ...labelBoundingBox(800, 800), width: 1e6, height: 1e6, x: -1e5, y: -1e5 }];
    expect(placeLabelClearOfLabels(anchor, [card], blockEverything)).toEqual(anchor);
  });

  it('Label-Box ist die gerenderte Größe, nicht die alte Schätzung', () => {
    // 12 px fett, padding 2px/6px, 1px Rahmen ⇒ ~156 × 22 für
    // „DC- · 1.5 mm² · 3.0 m". Die alte Box (88 × 20) war zu klein und ließ
    // 11 Labels über Karten durch (nachgemessen am selben Plan).
    expect(LABEL_BOX_WIDTH).toBeGreaterThanOrEqual(140);
    expect(LABEL_BOX_HEIGHT).toBeGreaterThanOrEqual(20);
  });
});
