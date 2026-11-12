/**
 * V1 — Eingabeprüfung vor dem Routing (Spezifikation §4.1).
 *
 * Warum vor dem Router und nicht danach
 * ====================================
 * `routeContract.ts` prüft das **Ergebnis** gegen den Vertrag. Das ist richtig
 * und bleibt. Es kann aber nicht verhindern, dass der Router auf einer Eingabe
 * läuft, die gar keine ist: `NaN`-Koordinaten, doppelte IDs, Anschlüsse, die
 * es nicht gibt. Solche Eingaben erzeugen entweder Abstürze oder — schlimmer —
 * stille Fallbacks, die wie ein Routing aussehen.
 *
 * Diese Prüfung ist **unabhängig** vom Router und von `checkRoutingInputs`
 * (das die Anschlussauflösung des Produktivpfads absichert). Sie beantwortet
 * eine einzige Frage: *darf man darauf überhaupt routen?*
 */

import type { RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';

export type InputViolationCode =
  | 'INPUT-EMPTY-ID'
  | 'INPUT-DUPLICATE-ID'
  | 'INPUT-NOT-FINITE'
  | 'INPUT-NONPOSITIVE-SIZE'
  | 'INPUT-MISSING-NODE'
  | 'INPUT-UNKNOWN-HANDLE'
  | 'INPUT-SELF-LOOP';

export type InputViolation = {
  code: InputViolationCode;
  detail: string;
  nodeId?: string;
  edgeId?: string;
};

export type InputValidation = {
  ok: boolean;
  violations: InputViolation[];
};

type NodeLike = {
  id?: unknown;
  position?: { x?: unknown; y?: unknown };
  width?: unknown;
  height?: unknown;
  measured?: { width?: unknown; height?: unknown };
  handleBounds?: Record<string, { id?: unknown }[] | undefined>;
  internals?: { handleBounds?: Record<string, { id?: unknown }[] | undefined> };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const handleIdsOf = (node: NodeLike): Set<string> => {
  const bounds = node.handleBounds ?? node.internals?.handleBounds ?? {};
  const ids = new Set<string>();
  for (const side of Object.keys(bounds)) {
    for (const handle of bounds[side] ?? []) {
      if (typeof handle?.id === 'string') ids.add(handle.id);
    }
  }
  return ids;
};

/**
 * Prüft die Eingabe vollständig (alle Befunde, nicht nur den ersten).
 *
 * Die Reihenfolge der Befunde ist deterministisch: erst Knoten in
 * Eingabereihenfolge, dann Kanten in Eingabereihenfolge. Ein Bericht, dessen
 * Zeilenreihenfolge schwankt, ist als Diff unbrauchbar.
 */
export function validateRoutingInput(
  nodes: readonly RoutableNode[],
  edges: readonly RouteEdgeRef[]
): InputValidation {
  const violations: InputViolation[] = [];
  const byId = new Map<string, NodeLike>();

  for (const raw of nodes as readonly unknown[]) {
    const node = raw as NodeLike;
    const id = typeof node.id === 'string' ? node.id : '';
    if (id.length === 0) {
      violations.push({ code: 'INPUT-EMPTY-ID', detail: 'Bauteil ohne ID' });
      continue;
    }
    if (byId.has(id)) {
      violations.push({ code: 'INPUT-DUPLICATE-ID', detail: `Bauteil-ID ${id} ist doppelt`, nodeId: id });
      continue;
    }
    byId.set(id, node);

    const x = node.position?.x;
    const y = node.position?.y;
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      violations.push({
        code: 'INPUT-NOT-FINITE',
        detail: `Bauteil ${id} hat keine endliche Position (${String(x)}, ${String(y)})`,
        nodeId: id,
      });
    }

    const width = node.width ?? node.measured?.width;
    const height = node.height ?? node.measured?.height;
    if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) {
      violations.push({
        code: 'INPUT-NONPOSITIVE-SIZE',
        detail: `Bauteil ${id} hat keine positive Größe (${String(width)}×${String(height)})`,
        nodeId: id,
      });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    const id = typeof edge?.id === 'string' ? edge.id : '';
    if (id.length === 0) {
      violations.push({ code: 'INPUT-EMPTY-ID', detail: 'Kante ohne ID' });
      continue;
    }
    if (edgeIds.has(id)) {
      violations.push({ code: 'INPUT-DUPLICATE-ID', detail: `Kanten-ID ${id} ist doppelt`, edgeId: id });
      continue;
    }
    edgeIds.add(id);

    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    const sourceNode = byId.get(sourceId);
    const targetNode = byId.get(targetId);

    if (!sourceNode) {
      violations.push({ code: 'INPUT-MISSING-NODE', detail: `Quelle ${sourceId} fehlt`, edgeId: id });
    }
    if (!targetNode) {
      violations.push({ code: 'INPUT-MISSING-NODE', detail: `Ziel ${targetId} fehlt`, edgeId: id });
    }

    const sourceHandle =
      edge.sourceHandle === undefined || edge.sourceHandle === null ? '' : String(edge.sourceHandle);
    const targetHandle =
      edge.targetHandle === undefined || edge.targetHandle === null ? '' : String(edge.targetHandle);

    if (sourceNode && !handleIdsOf(sourceNode).has(sourceHandle)) {
      violations.push({
        code: 'INPUT-UNKNOWN-HANDLE',
        detail: `Quell-Anschluss ${sourceId}/${sourceHandle} ist nicht gemessen`,
        edgeId: id,
        nodeId: sourceId,
      });
    }
    if (targetNode && !handleIdsOf(targetNode).has(targetHandle)) {
      violations.push({
        code: 'INPUT-UNKNOWN-HANDLE',
        detail: `Ziel-Anschluss ${targetId}/${targetHandle} ist nicht gemessen`,
        edgeId: id,
        nodeId: targetId,
      });
    }
    if (sourceId === targetId && sourceHandle === targetHandle) {
      violations.push({
        code: 'INPUT-SELF-LOOP',
        detail: `Kante ${id} verbindet einen Anschluss mit sich selbst`,
        edgeId: id,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
