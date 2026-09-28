import { isPresentationOnlyNode, type PresentationAwareNode } from './routableNodes';
import {
  nodeGeometrySnapshot,
  nodeGeometryTraceSnapshot,
  nodeHeight,
  nodeWidth,
  type GeometryNode,
  type NodeGeometrySnapshot,
  type NodeGeometryTraceSnapshot,
} from './nodeGeometry';
import type { FinalValidationReport } from '../../../lib/routing/finalValidation';
import { NODE_FALLBACK_HEIGHT, NODE_FALLBACK_WIDTH, type PathResult } from './pathfinding';
import { compareIds } from '../../../lib/sortOrder';

/**
 * Opt-in Diagnose des Live-Routings. Standardmäßig aus, da große Pläne
 * umfangreiche Mess- und Routendaten erzeugen können.
 *
 * Aktivierung beim Start:
 * `NEXT_PUBLIC_ROUTING_DEBUG=1 npm run dev`
 *
 * Aktivierung in der Browser-Konsole vor einer Änderung:
 * `globalThis.__PLANNER_ROUTING_DEBUG__ = true`
 *
 * Für automatisierte Laufzeit-Traces kann zusätzlich vor dem Laden der Seite
 * `globalThis.__PLANNER_ROUTING_TRACE__ = []` gesetzt werden. Der Ringpuffer
 * enthält strukturierte Input-, Presentation-only- und Routing-Ergebnis-Events.
 */

const ENV_FLAG = process.env.NEXT_PUBLIC_ROUTING_DEBUG;
const MAX_TRACE_EVENTS = 200;

export const ROUTING_DEBUG_GLOBAL = '__PLANNER_ROUTING_DEBUG__';
export const ROUTING_TRACE_GLOBAL = '__PLANNER_ROUTING_TRACE__';

type DebugGlobal = {
  [ROUTING_DEBUG_GLOBAL]?: unknown;
  [ROUTING_TRACE_GLOBAL]?: unknown;
};

/** Ist die Diagnose aktiv (Build-Zeit-Flag oder Laufzeit-Global)? */
export function routingDebugEnabled(): boolean {
  if (ENV_FLAG === '1' || ENV_FLAG === 'true') return true;
  return (globalThis as DebugGlobal)[ROUTING_DEBUG_GLOBAL] === true;
}

/** Node-Form, die die Diagnose lesen kann (RF-Node, InternalNode, Fixture). */
export type RoutingDebugNode = PresentationAwareNode & { id: string } & GeometryNode;
export type RoutingNodeGeometry = NodeGeometrySnapshot;

/** Geometrie eines Knotens in der Form, die der Router liest. */
export const routingNodeGeometry = (node: RoutingDebugNode): NodeGeometrySnapshot =>
  nodeGeometrySnapshot(node);

const formatGeometry = (geometry: NodeGeometrySnapshot): string =>
  `${geometry.x},${geometry.y}:${geometry.width ?? '—'}×${geometry.height ?? '—'}`;

let runNumber = 0;
let previous = new Map<string, string>();
let traceSequence = 0;

/** Zähler und Vergleichsbasis zurücksetzen (Tests, Planwechsel). */
export function resetRoutingDebug(): void {
  runNumber = 0;
  previous = new Map();
  traceSequence = 0;
}

export type RoutingDebugSnapshot = {
  routable: NodeGeometrySnapshot[];
  presentation: NodeGeometrySnapshot[];
};

/**
 * Formatiert einen Lauf als Textzeilen — reine Funktion, damit sie ohne
 * Konsole getestet werden kann.
 */
export function formatRoutingDebugRun(
  run: number,
  snapshot: RoutingDebugSnapshot,
  before: ReadonlyMap<string, string>
): string[] {
  const lines: string[] = [
    `[ROUTING] Lauf ${run}: ${snapshot.routable.length} geroutet, ` +
      `${snapshot.presentation.length} übersprungen (Darstellung)`,
  ];

  const changed: string[] = [];
  const current = new Map<string, string>();
  for (const node of [...snapshot.routable, ...snapshot.presentation]) {
    const geometry = formatGeometry(node);
    current.set(node.id, geometry);
    const was = before.get(node.id);
    if (was === undefined) changed.push(`${node.id} (neu) ${geometry}`);
    else if (was !== geometry) changed.push(`${node.id} ${was} → ${geometry}`);
  }
  for (const id of before.keys()) {
    if (!current.has(id)) changed.push(`${id} ${before.get(id)} → (entfernt)`);
  }
  changed.sort(compareIds);
  lines.push(changed.length > 0 ? `[ROUTING] Δ ${changed.join(' | ')}` : '[ROUTING] Δ (unverändert)');

  if (snapshot.routable.length > 0) {
    lines.push(
      `[ROUTING] nodes ${snapshot.routable
        .map((node) => `${node.id} ${node.type ?? '-'} ${formatGeometry(node)}`)
        .join(' | ')}`
    );
  }
  if (snapshot.presentation.length > 0) {
    lines.push(
      `[ROUTING] übersprungen ${snapshot.presentation
        .map((node) => `${node.id} ${node.type ?? '-'} ${formatGeometry(node)}`)
        .join(' | ')}`
    );
  }
  return lines;
}

/**
 * Schreibt einen Routing-Lauf in die Konsole. Setzt den internen
 * Vergleichsstand auf den aktuellen Lauf — der nächste Aufruf zeigt damit
 * genau die Knoten, die sich seither geändert haben.
 */
export function logRoutingRun(nodes: readonly RoutingDebugNode[]): void {
  const routable: NodeGeometrySnapshot[] = [];
  const presentation: NodeGeometrySnapshot[] = [];
  for (const node of nodes) {
    const geometry = routingNodeGeometry(node);
    if (isPresentationOnlyNode(node)) presentation.push(geometry);
    else routable.push(geometry);
  }

  runNumber += 1;
  const lines = formatRoutingDebugRun(runNumber, { routable, presentation }, previous);
  previous = new Map([...routable, ...presentation].map((node) => [node.id, formatGeometry(node)]));
  for (const line of lines) console.warn(line);
}

export type RoutingTraceEdgeInput = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

export type RoutingTraceNode = NodeGeometryTraceSnapshot & { presentationOnly: boolean };

export type RoutingTraceEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  edgeDomain: string | null;
  crossSection: number | null;
  locked: boolean | null;
};

export type RoutingTraceSnapshot = {
  routingSignature: string;
  routingSignatureHash: string;
  nodeHash: string;
  presentationHash: string;
  edgeHash: string;
  graphHash: string;
  routableNodes: RoutingTraceNode[];
  presentationNodes: RoutingTraceNode[];
  edges: RoutingTraceEdge[];
};

export type RoutingTraceEntityChange<T> = {
  id: string;
  change: 'added' | 'removed' | 'updated';
  fields: string[];
  before?: T;
  after?: T;
};

export type RoutingTraceStateChange = {
  kind: 'initial' | 'routing-input-change' | 'presentation-only-change' | 'non-routing-geometry-change';
  routingInputChanged: boolean;
  presentationOnlyChanged: boolean;
  previousSignatureHash: string | null;
  changedNodes: RoutingTraceEntityChange<RoutingTraceNode>[];
  changedEdges: RoutingTraceEntityChange<RoutingTraceEdge>[];
};

export type RoutingTraceCycle = {
  period: 2;
  signatureHashes: [string, string];
};

export type RoutingTraceTriggerReference = {
  sequence: number;
  timestamp: string;
  kind: RoutingTraceStateChange['kind'];
  routingInputChanged: boolean;
  changedNodeIds: string[];
  changedEdgeIds: string[];
  routingSignatureHash: string;
};

function hashText(text: string): string {
  // FNV-1a is a compact diagnostic fingerprint, not a security hash.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hashValue(value: unknown): string {
  return hashText(JSON.stringify(value) ?? 'undefined');
}

function traceNode(node: RoutingDebugNode): RoutingTraceNode {
  return {
    ...nodeGeometryTraceSnapshot(node, {
      width: nodeWidth(node, NODE_FALLBACK_WIDTH),
      height: nodeHeight(node, NODE_FALLBACK_HEIGHT),
    }),
    presentationOnly: isPresentationOnlyNode(node),
  };
}

/** Raw declared/measured geometry signature used only when tracing is enabled. */
export function routingDebugGeometrySignature(nodes: Iterable<RoutingDebugNode>): string {
  return JSON.stringify(byId([...nodes].map(traceNode)));
}

function traceEdge(edge: RoutingTraceEdgeInput): RoutingTraceEdge {
  const data =
    typeof edge.data === 'object' && edge.data !== null ? (edge.data as Record<string, unknown>) : undefined;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    edgeDomain: typeof data?.edgeDomain === 'string' ? data.edgeDomain : null,
    crossSection: typeof data?.crossSection === 'number' ? data.crossSection : null,
    locked: typeof data?.locked === 'boolean' ? data.locked : null,
  };
}

const byId = <T extends { id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => compareIds(a.id, b.id));

/** Creates a complete, deterministic snapshot of the inputs and their hashes. */
export function createRoutingTraceSnapshot(
  nodes: readonly RoutingDebugNode[],
  edges: readonly RoutingTraceEdgeInput[],
  routingSignature: string
): RoutingTraceSnapshot {
  const routableNodes: RoutingTraceNode[] = [];
  const presentationNodes: RoutingTraceNode[] = [];
  for (const node of nodes) {
    const snapshot = traceNode(node);
    if (snapshot.presentationOnly) presentationNodes.push(snapshot);
    else routableNodes.push(snapshot);
  }

  const routable = byId(routableNodes);
  const presentation = byId(presentationNodes);
  const edgeSnapshots = byId(edges.map(traceEdge));
  const nodeHash = hashValue(routable);
  const presentationHash = hashValue(presentation);
  const edgeHash = hashValue(edgeSnapshots);

  return {
    routingSignature,
    routingSignatureHash: hashText(routingSignature),
    nodeHash,
    presentationHash,
    edgeHash,
    graphHash: hashValue({ routable, edges: edgeSnapshots }),
    routableNodes: routable,
    presentationNodes: presentation,
    edges: edgeSnapshots,
  };
}

function changedFields<T extends object>(before: T | undefined, after: T | undefined): string[] {
  if (!before || !after) return ['*'];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key as keyof T]) !== JSON.stringify(after[key as keyof T]))
    .sort(compareIds);
}

function diffById<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[]
): RoutingTraceEntityChange<T>[] {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(compareIds);
  const changes: RoutingTraceEntityChange<T>[] = [];

  for (const id of ids) {
    const prior = beforeById.get(id);
    const next = afterById.get(id);
    if (!prior && next) changes.push({ id, change: 'added', fields: ['*'], after: next });
    else if (prior && !next) changes.push({ id, change: 'removed', fields: ['*'], before: prior });
    else if (prior && next) {
      const fields = changedFields(prior, next);
      if (fields.length > 0) changes.push({ id, change: 'updated', fields, before: prior, after: next });
    }
  }
  return changes;
}

/** Explains which routing-visible state changes triggered a new signature. */
export function describeRoutingStateChange(
  before: RoutingTraceSnapshot | undefined,
  after: RoutingTraceSnapshot
): RoutingTraceStateChange {
  const changedNodes = diffById(
    [...(before?.routableNodes ?? []), ...(before?.presentationNodes ?? [])],
    [...after.routableNodes, ...after.presentationNodes]
  );
  const changedEdges = diffById(before?.edges ?? [], after.edges);
  const routingInputChanged = before === undefined || before.routingSignature !== after.routingSignature;
  const presentationOnlyChanged = before === undefined || before.presentationHash !== after.presentationHash;

  const anyGeometryChanged = changedNodes.length > 0 || changedEdges.length > 0;

  return {
    kind:
      before === undefined
        ? 'initial'
        : routingInputChanged
          ? 'routing-input-change'
          : presentationOnlyChanged
            ? 'presentation-only-change'
            : 'non-routing-geometry-change',
    routingInputChanged,
    presentationOnlyChanged,
    previousSignatureHash: before?.routingSignatureHash ?? null,
    changedNodes: anyGeometryChanged ? changedNodes : [],
    changedEdges,
  };
}

/** Detects an A → B → A routing-input oscillation in observed signatures. */
export function detectAlternatingRoutingCycle(
  history: readonly string[],
  currentSignatureHash: string
): RoutingTraceCycle | undefined {
  const previous = history.at(-1);
  const alternating = history.at(-2);
  if (
    !previous ||
    !alternating ||
    previous === currentSignatureHash ||
    alternating !== currentSignatureHash
  ) {
    return undefined;
  }
  return { period: 2, signatureHashes: [alternating, previous] };
}

function emitTrace(event: Record<string, unknown>): void {
  const global = globalThis as DebugGlobal;
  const rawBuffer = global[ROUTING_TRACE_GLOBAL];
  if (Array.isArray(rawBuffer)) {
    const buffer: unknown[] = rawBuffer;
    buffer.push(event);
    if (buffer.length > MAX_TRACE_EVENTS) buffer.splice(0, buffer.length - MAX_TRACE_EVENTS);
  }
  console.warn(`[ROUTING_TRACE] ${JSON.stringify(event)}`);
}

/** Logs each signature transition and returns a compact link for the route event. */
export function logRoutingInputChange(
  snapshot: RoutingTraceSnapshot,
  change: RoutingTraceStateChange,
  cycle?: RoutingTraceCycle
): RoutingTraceTriggerReference {
  const sequence = ++traceSequence;
  const timestamp = new Date().toISOString();
  const reference: RoutingTraceTriggerReference = {
    sequence,
    timestamp,
    kind: change.kind,
    routingInputChanged: change.routingInputChanged,
    changedNodeIds: change.changedNodes.map((item) => item.id),
    changedEdgeIds: change.changedEdges.map((item) => item.id),
    routingSignatureHash: snapshot.routingSignatureHash,
  };

  emitTrace({
    event: 'input-change',
    epochMs: Date.now(),
    ...reference,
    triggerStateChange: change,
    ...(cycle ? { detectedCycle: cycle } : {}),
    input: snapshot,
  });
  return reference;
}

/** Logs the route geometry and exact final-validation outcome for an input. */
export function logRoutingResult(
  snapshot: RoutingTraceSnapshot,
  routes: ReadonlyMap<string, PathResult>,
  report: FinalValidationReport,
  triggers: readonly RoutingTraceTriggerReference[],
  runtimeMs: number
): void {
  const routeGeometry = [...routes.entries()]
    .map(([id, route]) => ({ id, waypoints: route.waypoints }))
    .sort((a, b) => compareIds(a.id, b.id));
  const violationCount =
    report.counts.edgeNodeCollisions + report.counts.edgeEdgeOverlaps + report.counts.clearanceViolations;

  emitTrace({
    event: 'route-result',
    epochMs: Date.now(),
    timestamp: new Date().toISOString(),
    routingSignature: snapshot.routingSignature,
    routingSignatureHash: snapshot.routingSignatureHash,
    nodeHash: snapshot.nodeHash,
    edgeHash: snapshot.edgeHash,
    graphHash: snapshot.graphHash,
    routeHash: hashValue(routeGeometry),
    cableCount: routes.size,
    violationCount,
    validationStatus: report.status,
    validationCounts: report.counts,
    tightMarginRoutes: report.tightMarginRoutes ?? 0,
    edgeCount: report.edgeCount,
    violations: report.violations.map(({ invariant, edgeId, otherId, detail }) => ({
      invariant,
      edgeId,
      otherId: otherId ?? null,
      detail,
    })),
    triggerStateChanges: triggers,
    runtimeMs,
  });
}
