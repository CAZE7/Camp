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
 * eine einzige Frage: *darf man darauf überhaupt routen?* Der Standard ist
 * strikt; nur Adapter für ältere, unvermessene Fixtures dürfen die explizite
 * Option für den dokumentierten Router-Fallback aktivieren.
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

export type RoutingInputValidationOptions = {
  /**
   * Allow the router's documented 192×120 size and R-7 port fallbacks when
   * geometry/handles are not measured yet. Explicit invalid values still fail.
   */
  allowUnmeasuredFallbacks?: boolean;
};

type NodeLike = {
  id?: unknown;
  position?: { x?: unknown; y?: unknown };
  positionAbsolute?: { x?: unknown; y?: unknown };
  width?: unknown;
  height?: unknown;
  measured?: { width?: unknown; height?: unknown };
  handleBounds?: Record<string, { id?: unknown }[] | undefined>;
  internals?: {
    positionAbsolute?: { x?: unknown; y?: unknown };
    handleBounds?: Record<string, { id?: unknown }[] | undefined>;
  };
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
 * Mirrors resolveHandlePoint's distinction: a measured group with no match is
 * invalid, while a completely unmeasured group may use the documented R-7
 * side-based fallback.
 */
const measuredHandleMatch = (node: NodeLike, side: 'source' | 'target', id: string): boolean | undefined => {
  const bounds = node.handleBounds ?? node.internals?.handleBounds;
  if (!bounds) return undefined;
  const group = bounds[side] ?? bounds[side === 'source' ? 'target' : 'source'];
  if (group == null) return undefined;
  return group.some((handle) => handle?.id === id);
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
  edges: readonly RouteEdgeRef[],
  options: RoutingInputValidationOptions = {}
): InputValidation {
  const violations: InputViolation[] = [];
  const allowUnmeasuredFallbacks = options.allowUnmeasuredFallbacks === true;
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

    const positions = [node.position, node.positionAbsolute, node.internals?.positionAbsolute];
    const hasInvalidCoordinates = positions.some(
      (position) => position != null && (!isFiniteNumber(position.x) || !isFiniteNumber(position.y))
    );
    const x = node.internals?.positionAbsolute?.x ?? node.positionAbsolute?.x ?? node.position?.x;
    const y = node.internals?.positionAbsolute?.y ?? node.positionAbsolute?.y ?? node.position?.y;
    if (hasInvalidCoordinates || !isFiniteNumber(x) || !isFiniteNumber(y)) {
      violations.push({
        code: 'INPUT-NOT-FINITE',
        detail: `Bauteil ${id} hat keine endliche Position (${String(x)}, ${String(y)})`,
        nodeId: id,
      });
    }

    const width = node.width ?? node.measured?.width;
    const height = node.height ?? node.measured?.height;
    const widthMissing = width === undefined || width === null;
    const heightMissing = height === undefined || height === null;
    const invalidWidth = widthMissing ? !allowUnmeasuredFallbacks : !isFiniteNumber(width) || width <= 0;
    const invalidHeight = heightMissing ? !allowUnmeasuredFallbacks : !isFiniteNumber(height) || height <= 0;
    if (invalidWidth || invalidHeight) {
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

    const sourceHandleKnown = allowUnmeasuredFallbacks
      ? measuredHandleMatch(sourceNode ?? {}, 'source', sourceHandle) !== false
      : sourceNode
        ? handleIdsOf(sourceNode).has(sourceHandle)
        : true;
    if (sourceNode && !sourceHandleKnown) {
      violations.push({
        code: 'INPUT-UNKNOWN-HANDLE',
        detail: `Quell-Anschluss ${sourceId}/${sourceHandle} ist nicht gemessen`,
        edgeId: id,
        nodeId: sourceId,
      });
    }
    const targetHandleKnown = allowUnmeasuredFallbacks
      ? measuredHandleMatch(targetNode ?? {}, 'target', targetHandle) !== false
      : targetNode
        ? handleIdsOf(targetNode).has(targetHandle)
        : true;
    if (targetNode && !targetHandleKnown) {
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
