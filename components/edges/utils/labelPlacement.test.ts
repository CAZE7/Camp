import { describe, expect, it } from 'vitest';
import complexPlan from '../../../knownPlans/complex.json';
import measuredComplexGeometry from '../../../tests/fixtures/routing/complex-measured-geometry.json';
import {
  LABEL_COMPACT_MIN_WIDTH,
  estimateCableLabelWidth,
  placeLabelClearOfLabels,
  routeAllCables,
  type RouteEdgeRef,
} from './routeAll';
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

/**
 * Breite der tatsächlich gezeichneten Beschriftung: Die Kurzform
 * (`labelCompact`, nur „16 mm²") ist deutlich schmaler als der Umschlag.
 */
function drawnWidth(route: { labelCompact?: boolean }): number {
  return route.labelCompact ? LABEL_COMPACT_MIN_WIDTH : LABEL_BOX_WIDTH;
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
   * Gezeichnete Beschriftungen liegen nicht auf Bauteilkarten.
   *
   * Ratchet: Dieser dichte Plan (14 Karten auf ~1000 × 700) enthält Trassen,
   * die zwischen zwei Karten komplett unter einer Karte liegen — eine
   * kartenfreie Stelle existiert dort nicht. Gemessen am 2026-09-28 nach dem
   * Umbau: 8 solcher Labels (mit dem alten, festen Umschlag gerechnet).
   *
   * Seit der Layout-Runde 27.10.2026 (L1/L10) rechnet die Prüfung mit der
   * gemessenen Breite, sucht entlang der Leitung und zeichnet im Notfall die
   * Kurzform bzw. gar nichts: Gemessen sind 0 Labels über Karten und 0
   * Label-Überdeckungen (vorher 6 bzw. 4). Der Wert 1 bleibt als Reserve für
   * künftige Planstände; mehr heißt „Platzierung verschlechtert".
   */
  it('gezeichnete Beschriftung liegt nicht auf einer Karte (Ratchet)', () => {
    let onCard = 0;
    for (const [, route] of routes) {
      if (route.labelHidden) continue; // nicht gezeichnet — kein Bildfehler
      const box = labelBoundingBox(route.labelX, route.labelY, drawnWidth(route));
      for (const rect of nodeRects) {
        if (boxesOverlap(box, rect)) {
          onCard += 1;
          break;
        }
      }
    }
    expect(
      onCard,
      'Mehr Labels über Karten als bei der Layout-Runde gemessen — Platzierung verschlechtert'
    ).toBeLessThanOrEqual(1);
  });

  /**
   * L1 (Screenshot „Großes Autark-Setup“): Mehrere Leitungen auf demselben
   * Trassenstück bekamen denselben Anker, weil nur senkrecht am festen x
   * ausgewichen wurde — vier Chips lagen deckungsgleich übereinander.
   * Zwei gezeichnete Beschriftungen dürfen sich nie überdecken: Sie lesen
   * sich sonst als EIN Label mit vermischten Zahlen.
   */
  it('zwei gezeichnete Beschriftungen liegen nie aufeinander (L1)', () => {
    const drawn = [...routes.entries()].filter(([, route]) => !route.labelHidden);
    const boxes = drawn.map(([id, route]) => ({
      id,
      box: labelBoundingBox(route.labelX, route.labelY, drawnWidth(route)),
    }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(boxesOverlap(a.box, b.box), `Beschriftungen überdecken sich: ${a.id} / ${b.id}`).toBe(false);
      }
    }
  });

  /**
   * L1 (Fortsetzung): Wo weder die volle noch die kurze Beschriftung
   * kollisionsfrei Platz findet, markiert der Pass `labelHidden` — kein
   * zweiter Chip auf dem ersten. Der Plan `complex.json` ist dicht genug, um
   * den Fall zu zeigen (gemessen: 4 von 23 Leitungen).
   */
  it('ohne freien Platz bleibt die Beschriftung aus (labelHidden), aber die Geometrie steht', () => {
    const hidden = [...routes.values()].filter((route) => route.labelHidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const route of hidden) {
      expect(Number.isFinite(route.labelX)).toBe(true);
      expect(Number.isFinite(route.labelY)).toBe(true);
      expect(route.path.length).toBeGreaterThan(0);
    }
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

  it('weicht entlang der Leitung in Spread-Stufen aus und gibt null zurück, wenn nichts frei ist', () => {
    const card = { x: 0, y: 0, width: 400, height: 400 };
    const waypoints = [
      { x: 600, y: 800 },
      { x: 1000, y: 800 },
    ];
    const anchor = { x: 800, y: 800 };
    // Anker frei, keine Nachbarn ⇒ unverändert.
    expect(placeLabelClearOfLabels(anchor, waypoints, [card], [])).toEqual(anchor);
    // Ein Nachbar belegt den Anker ⇒ Ausweichen (senkrecht oder entlang der Leitung).
    const taken = [labelBoundingBox(800, 800)];
    expect(placeLabelClearOfLabels(anchor, waypoints, [card], taken)).not.toEqual(anchor);
    // Ohne freien Platz: **kein** Label (`null`) statt eines zweiten Chips auf
    // dem ersten — zwei deckungsgleiche Beschriftungen liest man als EINE.
    const blockEverything = [{ ...labelBoundingBox(800, 800), width: 1e6, height: 1e6, x: -1e5, y: -1e5 }];
    expect(placeLabelClearOfLabels(anchor, waypoints, [card], blockEverything)).toBeNull();
  });

  /**
   * L1, Kern des Screenshot-Falls: Vier Leitungen teilen sich ein
   * Trassenstück und damit denselben Anker. Die alte Suche (nur senkrecht am
   * festen x) fand dort keinen Platz und fiel auf den Anker zurück — vier
   * deckungsgleiche Chips. Jetzt bekommt jede Leitung ihren eigenen Platz.
   */
  it('vier Beschriftungen auf derselben Trasse stapeln sich nicht', () => {
    const waypoints = [
      { x: 400, y: 400 },
      { x: 800, y: 400 },
    ];
    const anchor = { x: 600, y: 400 };
    const placed: ReturnType<typeof labelBoundingBox>[] = [];
    for (let i = 0; i < 4; i++) {
      const position = placeLabelClearOfLabels(anchor, waypoints, [], placed);
      expect(position, `Beschriftung ${i + 1} fand keinen Platz`).not.toBeNull();
      placed.push(labelBoundingBox(position!.x, position!.y));
    }
    expect(placed).toHaveLength(4);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(boxesOverlap(placed[i]!, placed[j]!), `Chips ${i} und ${j} überdecken sich`).toBe(false);
      }
    }
  });

  /**
   * L10: Die Prüfbox war fix 156 px breit, ein Warn-Label ist aber deutlich
   * breiter. Deshalb wird die Breite aus dem Text geschätzt — mit dem
   * Umschlag als Untergrenze, damit die Prüfung nie optimistischer wird als
   * vorher.
   */
  it('Labelbreite folgt dem Text, Kurzform ist schmaler als die Langform', () => {
    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      data: { edgeDomain: 'DC_12V', crossSection: 4 },
    } as unknown as RouteEdgeRef;
    const full = estimateCableLabelWidth(edge, 300);
    const compact = estimateCableLabelWidth(edge, 300, true);
    expect(full).toBeGreaterThanOrEqual(LABEL_BOX_WIDTH);
    expect(compact).toBeLessThan(full);
    // Ein langes Label (große Länge ⇒ mehr Zeichen) wird breiter als der Umschlag.
    const long = estimateCableLabelWidth(edge, 100_000);
    expect(long).toBeGreaterThan(full);
    // Ohne Kantendaten: keine Ausnahme, nur der Umschlag.
    expect(estimateCableLabelWidth(undefined, 300)).toBeGreaterThanOrEqual(LABEL_BOX_WIDTH);
  });

  it('Label-Box ist die gerenderte Größe, nicht die alte Schätzung', () => {
    // 12 px fett, padding 2px/6px, 1px Rahmen ⇒ ~156 × 22 für
    // „DC- · 1.5 mm² · 3.0 m". Die alte Box (88 × 20) war zu klein und ließ
    // 11 Labels über Karten durch (nachgemessen am selben Plan).
    expect(LABEL_BOX_WIDTH).toBeGreaterThanOrEqual(140);
    expect(LABEL_BOX_HEIGHT).toBeGreaterThanOrEqual(20);
  });
});
