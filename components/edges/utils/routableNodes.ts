/**
 * Präsentations-Grenze des Routings.
 *
 * ## Befund (2026-09-26, „Routing springt zwischen 0 und 20 Zwängen“)
 *
 * Der Hauptstromkreis-Rahmen (`backboneGroup`) ist laut eigener Doku
 * „presentation-only“ — er landete aber ungefiltert im Routing:
 *
 * ```text
 * <FlowCanvas>  →  withBackboneGroup()          Rahmen entsteht
 *               →  <ReactFlow nodes>            Rahmen ist eine Node
 *               →  nodeLookup                   Rahmen ist gemessen
 *               →  routeAllCables(nodes)        Rahmen ist ein Hindernis
 *               →  validateFinalRouting(rects)  Rahmen ist ein Bauteil
 * ```
 *
 * Der Rahmen umschließt die Kern-Bauteile. Jede Leitung, die ein
 * Kern-Bauteil verlässt, schneidet damit seinen Rand und zählt als
 * **I1-Verletzung (edge × node)** — obwohl kein Kabel durch ein Bauteil
 * läuft. Zusätzlich routete der A*-Pass um die Rahmenbox herum (Umwege),
 * und die Rahmenbox hing an der DOM-Messung: kein `measured` ⇒
 * 192 × 120 statt 844 × 392 ⇒ andere Hindernisse ⇒ **anderes Routing**.
 * Genau daraus entstand das sichtbare Umschalten des Status-Badges
 * zwischen „verifiziert“ und „20 Zwänge nicht erreicht“.
 *
 * ## Regel
 *
 * Reine Darstellungs-Knoten sind **kein** Routing-Input. Sie sind weder
 * Hindernis, noch Port, noch Prüfgegenstand, und sie stehen nicht in der
 * Layout-Signatur (eine Änderung, die den Router nicht betrifft, darf
 * keinen Routing-Lauf auslösen).
 *
 * Die Kennzeichnung ist doppelt: `type` (der konkrete UI-Typ, damit auch
 * gespeicherte Pläne ohne `data`-Marker geschützt sind) und
 * `data.presentationOnly` (der generische Marker für künftige
 * Darstellungs-Knoten — z. B. Fokus- oder Kollisions-Overlays).
 *
 * Warum die UI-Typ-Konstante hier und nicht in `components/planner/` steht:
 * Diese Datei ist die Grenze, an der die Kette „UI → Router“ abgeschnitten
 * wird. Das Wissen um den Typ gehört dorthin, wo es durchgesetzt wird —
 * sonst driftet die Kopie in der UI weg (wie in `collidingNodeIds`, das
 * den Typ bis hierher als zweite Kopie führte).
 */

/** Generic marker on `node.data` for nodes that exist for display only. */
export const PRESENTATION_ONLY_FLAG = 'presentationOnly';

/** Node type of the main-circuit frame drawn behind the core components. */
export const PRESENTATION_GROUP_TYPE = 'backboneGroup';

/**
 * Kleinster gemeinsamer Nenner aller Knoten, die an der Grenze ankommen:
 * `Node` (React Flow), `InternalNode` (v12) und die flache Fixture-Form.
 */
export type PresentationAwareNode = {
  type?: string | null;
  data?: unknown;
};

const hasPresentationFlag = (data: unknown): boolean =>
  typeof data === 'object' &&
  data !== null &&
  (data as Record<string, unknown>)[PRESENTATION_ONLY_FLAG] === true;

/**
 * Ist der Knoten reine Darstellung? `null`/`undefined` sind es nicht
 * (ein fehlender Knoten ist ein Aufruferfehler, kein UI-Element).
 */
export function isPresentationOnlyNode(node: PresentationAwareNode | null | undefined): boolean {
  if (!node) return false;
  if (node.type === PRESENTATION_GROUP_TYPE) return true;
  return hasPresentationFlag(node.data);
}

/**
 * Knoten, die der Router sehen darf.
 *
 * Gibt **dasselbe Array** zurück, wenn nichts gefiltert wurde: die
 * Identität ist selbst ein Vertrag (Memoization, React-Flow-Vergleich) —
 * ein bedingungsloses `filter` würde bei jedem Aufruf ein neues Array
 * erzeugen und genau die Instabilität wieder einführen, die hier behoben
 * wird.
 */
export function routableNodes<T extends PresentationAwareNode>(nodes: T[]): T[] {
  let firstPresentationIndex = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (isPresentationOnlyNode(nodes[i])) {
      firstPresentationIndex = i;
      break;
    }
  }
  if (firstPresentationIndex === -1) return nodes;

  const routable: T[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node !== undefined && !isPresentationOnlyNode(node)) routable.push(node);
  }
  return routable;
}

/**
 * Dasselbe für eine Iterable — der Produktivpfad liest in React Flow 12
 * `nodeLookup.values()`, also eine Map-Iteration. Beide Listen kommen
 * getrennt zurück, damit die Diagnose (`routingDebug.ts`) zeigen kann,
 * was ausgeschlossen wurde.
 */
export function collectRoutableNodes<T extends PresentationAwareNode>(
  nodes: Iterable<T>
): { routable: T[]; presentation: T[] } {
  const routable: T[] = [];
  const presentation: T[] = [];
  for (const node of nodes) {
    if (isPresentationOnlyNode(node)) presentation.push(node);
    else routable.push(node);
  }
  return { routable, presentation };
}
