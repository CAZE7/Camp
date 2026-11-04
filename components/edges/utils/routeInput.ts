/**
 * components/edges/utils/routeInput.ts — EINE Eingabeprüfung für den Router.
 *
 * P0 / ROUTE-INPUT-001 (Review 2026-11): Vorher galt im produktiven Pass
 * `if (!srcNode && !tgtNode) continue;`. Fehlte NUR ein Endpunkt, routete der
 * Router trotzdem — `resolveHandlePoint(undefined, …)` lieferte (0, 0) und
 * erzeugte eine Phantom-Leitung zum Plan-Ursprung, die zusätzlich die
 * Trassen der übrigen Leitungen beeinflussen konnte. Und ein angeforderter,
 * aber nicht gemessener Handle fiel über `?? group?.[0]` still auf den
 * ERSTEN verfügbaren Anschluss zurück (z. B. Batterie-Minus statt -Plus).
 *
 * Ab hier gilt für beide Fälle dieselbe, eine Wahrheit:
 *
 * ```text
 * fehlender Endpunkt      ⇒ Leitung nicht routbar + eigener Befund
 * unbekannter Anschluss   ⇒ Leitung nicht routbar + eigener Befund
 * keine Ersatzkoordinaten · kein stiller Anschlusswechsel
 * ```
 *
 * Die Prüfung ist rein und hat KEINEN Bezug zu A*-Suche, UI oder Store.
 * `routeAllCables` (Produktion), `resolveRoutingEndpoints` (Erwartungswerte)
 * und `routeValidation` (Live-Report) rufen exakt dieselbe Funktion — damit
 * kann der Bericht nicht mehr etwas anderes prüfen als der Router tut.
 *
 * Bewusst NICHT als Fehler gewertet: Knoten ohne GEMESSENE Handles. Vor dem
 * React-Flow-Mount, in Fixtures, `knownPlans/` und Golden Layouts existieren
 * nur Flussrichtung und konventionelle Seite. Dort ist die Auflösung eine
 * dokumentierte Modellannahme (R-7), kein Anschlusswechsel — es gibt keine
 * gemessene Liste, aus der „der erste“ genommen werden könnte.
 */

import { nodeHandleBounds, nodePositionAvailable, type HandleBox, type RoutableNode } from './nodeGeometry';
import { routableNodes } from './routableNodes';
import { compareIds } from '../../../lib/sortOrder';

/** Minimale Kantensicht — strukturell kompatibel zu `RouteEdgeRef` in routeAll.ts. */
export type RouteInputEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type RoutingInputViolationCode = 'ROUTE-MISSING-NODE' | 'ROUTE-UNKNOWN-HANDLE';

/** Ein Befund je Leitung UND Seite — der Nutzer muss ihn zuordnen können. */
export interface RoutingInputViolation {
  edgeId: string;
  code: RoutingInputViolationCode;
  /** Betroffenes Bauteil (fehlt oder hat den Anschluss nicht). */
  nodeId: string;
  /** Nur bei `ROUTE-UNKNOWN-HANDLE`: der angeforderte, nicht gemessene Anschluss. */
  handleId?: string;
  /** Seite der Verbindung: `source` oder `target`. */
  side: 'source' | 'target';
  /** Was ist falsch und wo — vollständig lesbar ohne weiteren Kontext. */
  detail: string;
  /** Was der Nutzer tun kann. */
  remedy: string;
}

export interface RoutingInputCheck {
  /** Deterministisch nach Leitungs-ID, dann Seite sortiert. */
  violations: readonly RoutingInputViolation[];
  /** Nur diese Leitungen dürfen in die Suche und in den Vertrag. */
  routableEdgeIds: ReadonlySet<string>;
}

/** Gemessene Anschlussgruppe so, wie `resolveHandlePoint` sie liest. */
function measuredGroup(
  node: RoutableNode,
  side: 'source' | 'target'
): readonly HandleBox[] | null | undefined {
  const bounds = nodeHandleBounds(node);
  return bounds?.[side] ?? bounds?.[side === 'source' ? 'target' : 'source'];
}

/**
 * Prüft alle Routing-Eingaben. Reine Funktion, deterministisch, keine
 * Ersatzwerte: eine Leitung mit einem Befund bekommt KEINE Route.
 */
export function checkRoutingInputs(
  nodes: readonly RoutableNode[],
  edges: readonly RouteInputEdgeRef[]
): RoutingInputCheck {
  const nodeById = new Map<string, RoutableNode>();
  for (const node of routableNodes([...nodes])) {
    if (node && nodePositionAvailable(node)) nodeById.set(node.id, node);
  }

  const violations: RoutingInputViolation[] = [];
  const routableEdgeIds = new Set<string>();
  const sorted = [...edges].sort((left, right) => compareIds(left.id, right.id));

  for (const edge of sorted) {
    let routable = true;
    for (const [side, nodeId, handleId] of [
      ['source', edge.source, edge.sourceHandle],
      ['target', edge.target, edge.targetHandle],
    ] as const) {
      const node = nodeById.get(nodeId);
      if (!node) {
        routable = false;
        violations.push({
          edgeId: edge.id,
          code: 'ROUTE-MISSING-NODE',
          nodeId,
          side,
          detail: `Leitung „${edge.id}“: ${side === 'source' ? 'Quell-' : 'Ziel-'}Bauteil „${nodeId}“ fehlt oder hat keine Canvas-Geometrie. Ohne Anschlusspunkt ist die Leitung nicht routbar; es wurde keine Ersatzkoordinate zum Plan-Ursprung verwendet.`,
          remedy:
            'Bauteil wiederherstellen bzw. die Leitung mit einem vorhandenen Bauteil verbinden; gelöschte Leitungen aus dem Plan entfernen.',
        });
        continue;
      }

      const group = measuredGroup(node, side);
      const wanted = handleId ?? null;
      // Nur wenn eine gemessene Anschlussliste existiert, kann ein benannter
      // Anschluss „fehlen“. Ohne Messung gilt die R-7-Flussrichtung.
      if (
        wanted !== null &&
        group != null &&
        group.length > 0 &&
        !group.some((h) => (h.id ?? null) === wanted)
      ) {
        routable = false;
        violations.push({
          edgeId: edge.id,
          code: 'ROUTE-UNKNOWN-HANDLE',
          nodeId,
          handleId: wanted,
          side,
          detail: `Leitung „${edge.id}“: Der angeforderte Anschluss „${wanted}“ ist am Bauteil „${nodeId}“ (${side === 'source' ? 'Quelle' : 'Ziel'}) nicht gemessen. Es wurde KEIN anderer Anschluss eingesetzt — die Leitung bleibt ungeroutet.`,
          remedy: `Am Bauteil „${nodeId}“ den Anschluss „${wanted}“ prüfen oder die Leitung auf einen tatsächlich vorhandenen Anschluss umklemmen.`,
        });
      }
    }
    if (routable) routableEdgeIds.add(edge.id);
  }

  violations.sort(
    (left, right) =>
      compareIds(left.edgeId, right.edgeId) ||
      compareIds(left.side, right.side) ||
      compareIds(left.nodeId, right.nodeId)
  );
  return { violations, routableEdgeIds };
}
