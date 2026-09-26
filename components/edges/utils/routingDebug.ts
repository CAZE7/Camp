import { isPresentationOnlyNode, type PresentationAwareNode } from './routableNodes';
import { nodeGeometrySnapshot, type GeometryNode, type NodeGeometrySnapshot } from './nodeGeometry';

/**
 * Diagnose des Live-Routings („Routing springt zwischen 0 und 20“).
 *
 * Standardmäßig **aus**: Der Router läuft pro Drag-Frame-Serie dutzende
 * Male, eine unbedingte Ausgabe würde die Konsole fluten und im
 * Produktivbetrieb Kosten ohne Nutzen erzeugen.
 *
 * Einschalten:
 *
 * ```bash
 * NEXT_PUBLIC_ROUTING_DEBUG=1 npm run dev
 * ```
 *
 * oder zur Laufzeit (Browser-Konsole, vor dem nächsten Routing-Lauf):
 *
 * ```js
 * globalThis.__PLANNER_ROUTING_DEBUG__ = true;
 * ```
 *
 * Ausgegeben wird pro Lauf: Anzahl der gerouteten und der ausgeschlossenen
 * (reinen Darstellungs-)Knoten, sowie die Änderung gegenüber dem vorherigen
 * Lauf (`x,y` und `Breite×Höhe` je geänderter Knoten-ID). Damit ist die
 * Frage „warum läuft das Routing schon wieder?“ direkt beantwortbar — und
 * ein Wechsel zwischen „gemessen“ und „nicht gemessen“ ist als `—` sichtbar.
 *
 * `console.warn` ist hier bewusst gewählt: Die ESLint-Konfiguration des
 * Projekts erlaubt ausschließlich `warn`/`error`, und ein Diagnosekanal,
 * den man erst umkonfigurieren muss, wird nicht benutzt.
 */

const ENV_FLAG = process.env.NEXT_PUBLIC_ROUTING_DEBUG;

export const ROUTING_DEBUG_GLOBAL = '__PLANNER_ROUTING_DEBUG__';

type DebugGlobal = { [ROUTING_DEBUG_GLOBAL]?: unknown };

/** Ist die Diagnose aktiv (Build-Zeit-Flag oder Laufzeit-Global)? */
export function routingDebugEnabled(): boolean {
  if (ENV_FLAG === '1' || ENV_FLAG === 'true') return true;
  return (globalThis as DebugGlobal)[ROUTING_DEBUG_GLOBAL] === true;
}

/** Node-Form, die die Diagnose lesen kann (RF-Node, InternalNode, Fixture). */
export type RoutingDebugNode = PresentationAwareNode & { id: string } & GeometryNode;

export type RoutingNodeGeometry = NodeGeometrySnapshot;

/** Geometrie eines Knotens in der Form, die der Router liest. */
export const routingNodeGeometry = (node: RoutingDebugNode): RoutingNodeGeometry =>
  nodeGeometrySnapshot(node);

const formatGeometry = (geometry: RoutingNodeGeometry): string =>
  `${geometry.x},${geometry.y}:${geometry.width ?? '—'}×${geometry.height ?? '—'}`;

let runNumber = 0;
let previous = new Map<string, string>();

/** Zähler und Vergleichsbasis zurücksetzen (Tests, Planwechsel). */
export function resetRoutingDebug(): void {
  runNumber = 0;
  previous = new Map();
}

export type RoutingDebugSnapshot = {
  routable: RoutingNodeGeometry[];
  presentation: RoutingNodeGeometry[];
};

/**
 * Formatiert einen Lauf als Textzeilen — reine Funktion, damit sie ohne
 * Konsole getestet werden kann.
 *
 * Erste Zeile: Anzahl + Dauer-Kontext. Zweite Zeile: die Änderung
 * gegenüber dem vorherigen Lauf (nur geänderte IDs, alphabetisch). Ab der
 * dritten: alle Routing-relevanten Knoten, danach die ausgeschlossenen.
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
  changed.sort((a, b) => a.localeCompare(b));
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
  const routable: RoutingNodeGeometry[] = [];
  const presentation: RoutingNodeGeometry[] = [];
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
