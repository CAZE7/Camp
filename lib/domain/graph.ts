/**
 * lib/domain/graph.ts — Domänen-eigene Graph-Typen (AUDIT ARCH-001).
 *
 * ADR-0008 („Domain Model wird unabhängig von React Flow") war bisher nur
 * zur Laufzeit erfüllt: lib/ lief ohne React, importierte aber `Node`/`Edge`
 * als Typen aus @xyflow/react — und primitives.ts sogar CableEdgeData aus
 * components/. Typ-Imports werden zwar zur Laufzeit entfernt, aber jede
 * Wiederverwendung (anderer Renderer, Fuzzing-Harness, Node-CLI) erbt die
 * Kopplung weiter.
 *
 * Diese Typen sind STRUKTURELL kompatibel zu React-Flow-Nodes/-Edges:
 * - Lesen: React-Flow-Werte (auch mit Interface-Daten wie CommonNodeData)
 *   bleiben an lib-Funktionen übergebbar — `Data`-Default ist `object`.
 * - Schreiben: lib-Produzenten (AutoWire) deklarieren ihre Ergebnisse als
 *   `PlannerNode<Record<string, unknown>>` und bleiben damit vom Store
 *   konsumierbar, exakt wie zuvor die RF-Default-Typen.
 * Bewusst MINIMAL (id/position/data/type + die von lib gelesenen Felder) —
 * kein Abbild des kompletten React-Flow-Internalschemas. Die Verkopplung
 * an die UI passiert ausschließlich in components/ und store/ (Adapter).
 */

/**
 * Knoten des Planer-Graphen (elektrisch + wasser).
 * Default-Datenform: `Record<string, unknown>` — identisch zur React-Flow-
 * Voreinstellung und zur App-Datenform `CommonNodeData` (die eine Index-
 * Signatur trägt). Beide Richtungen bleiben damit zuweisbar.
 */
export interface PlannerNode<Data extends object = Record<string, unknown>> {
  id: string;
  /** Bauteiltyp ('battery', 'solar', …). */
  type?: string;
  position: { x: number; y: number };
  /** Freies Datenfeld — Struktur wird über lib/nodeSchema.ts deklariert. */
  data: Data;
  /** Von AutoWire/Store/ELK gelesene React-Flow-Optionalitäten. */
  selected?: boolean;
  hidden?: boolean;
  dragging?: boolean;
  parentId?: string;
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
}

/** Kante des Planer-Graphens (Kabel, Wasserleitungen). */
export interface PlannerEdge<Data extends object = object> {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  /** Freies Datenfeld (CableEdgeData u. a.). */
  data?: Data;
  selected?: boolean;
  hidden?: boolean;
  animated?: boolean;
}

/**
 * Schmale Verbindungssicht — für Regeln, die nur Quelle/Ziel/Handles
 * brauchen (Verbindungsregeln, Solar-Strings, Duplikat-Prüfung).
 */
export type PlannerConnection = Pick<PlannerEdge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'> & {
  id?: string;
};

/**
 * Kurznamen für die Domänen-Module: `Node`/`Edge` ohne React-Flow-Import.
 * (Bewusst Alias statt Neuname — die Domäne soll den Begriff besitzen,
 * nicht die UI-Bibliothek.)
 */
export type { PlannerNode as Node, PlannerEdge as Edge };

/**
 * Alle Knoten, die von `startId` aus über Kanten erreichbar sind — **ohne
 * Richtung**: Eine Sammelschiene verbindet, sie „fließt" nicht; wer an ihr
 * hängt, hängt elektrisch zusammen, egal in welcher Richtung die Kante
 * gezeichnet wurde.
 *
 * Warum zentral (Befund 2026-09-28): Dieselbe Breitensuche lag bereits dreimal
 * im Baum — als AC-Insel in `lib/vde-standards.ts`, als Panel-Erreichbarkeit
 * im Planner-Hook und (neu) als Pfadprüfung „Ladebooster erreicht
 * Aufbaubatterie". Die dritte Kopie war der Anlass, sie einmal zu schreiben.
 *
 * `accepts` filtert Kanten VOR dem Betreten (z. B. nur `AC_230V`-Kanten) —
 * ohne Kanten (oder mit leerer Liste) bleibt der Startknoten allein.
 */
export function reachableNodeIds<E extends Pick<PlannerEdge, 'source' | 'target'>>(
  startId: string,
  edges: readonly E[],
  accepts?: (edge: E) => boolean
): Set<string> {
  const adjacent = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    const list = adjacent.get(from);
    if (list) list.push(to);
    else adjacent.set(from, [to]);
  };
  for (const edge of edges) {
    if (accepts && !accepts(edge)) continue;
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }

  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const next of adjacent.get(currentId) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}
