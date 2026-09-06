import type { Node, Position, XYPosition } from '@xyflow/react';

/**
 * React-Flow-Adapter für Node-Geometrie (S-1, React Flow 12).
 *
 * Warum diese Schicht existiert: v12 hat die gemessene Geometrie eines Knotens
 * umgezogen. Die Felder, die v11 flach auf dem Node hielt, liegen jetzt an zwei
 * Stellen:
 *
 * | Angabe               | React Flow 11        | React Flow 12                        |
 * | -------------------- | -------------------- | ------------------------------------ |
 * | gemessene Größe      | `node.width/height`  | `node.measured.width/height`         |
 * | absolute Position    | `node.positionAbsolute` | `internalNode.internals.positionAbsolute` |
 * | Handle-Rechtecke     | `node.handleBounds`  | `internalNode.internals.handleBounds` |
 *
 * In v12 bleiben `node.width/height` erhalten, sind aber die vom Nutzer
 * *gesetzten* Maße (meist undefined) — nicht die gemessenen. Die Funktionen
 * hier lesen deshalb zuerst die v12-Quelle und fallen auf die flache Form
 * zurück. Das ist kein Alt-Ballast, sondern die Persistenz-/Fixture-Grenze:
 * gespeicherte Pläne, `knownPlans/`, Golden Layouts und die Routing-Szenarien
 * beschreiben Knoten in der flachen Form und dürfen sich durch ein
 * Bibliotheks-Update nicht ändern (Golden Master byte-identisch).
 *
 * Reine Lesefunktionen ohne Seiteneffekte — die Routing Engine bekommt
 * weiterhin nur Zahlen (Architektur-Prinzip 3: „Routing kennt keine UI“).
 */

/** Ein Handle-Rechteck, relativ zum Node-Ursprung (React Flow misst so). */
export type HandleBox = {
  id?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
};

export type HandleBoundsMap = {
  source?: HandleBox[] | null;
  target?: HandleBox[] | null;
};

/**
 * Kleinster gemeinsamer Nenner aus `Node` (v12), `InternalNode` (v12) und der
 * flachen Fixture-/Persistenzform (v11). Bewusst strukturell statt als Union
 * der Bibliothekstypen: Tests und Golden-Master-Pläne bauen Knoten als
 * Objektliterale, ohne die 20 Pflichtfelder von `Node` zu erfinden.
 */
export type GeometryNode = {
  position: XYPosition;
  width?: number | null;
  height?: number | null;
  measured?: { width?: number | null; height?: number | null } | null;
  positionAbsolute?: XYPosition | null;
  handleBounds?: HandleBoundsMap | null;
  internals?: {
    positionAbsolute?: XYPosition | null;
    handleBounds?: HandleBoundsMap | null;
  } | null;
};

/** Node-Typ, wie ihn die Routing-Pipeline entgegennimmt. */
export type RoutableNode = Node & Partial<GeometryNode>;

/**
 * Absolute Canvas-Position des Knotens.
 *
 * Für Kindknoten einer Gruppe (`parentId`) liefert `node.position` die
 * Position relativ zum Elternknoten — Hindernisse und Handles lägen dann an
 * der falschen Stelle.
 */
export function nodeOrigin(node: GeometryNode): XYPosition {
  const absolute = node.internals?.positionAbsolute ?? node.positionAbsolute;
  if (absolute) return { x: absolute.x, y: absolute.y };
  return { x: node.position.x, y: node.position.y };
}

/** Absolute X-Position (siehe `nodeOrigin`). */
export function nodeOriginX(node: GeometryNode): number {
  return node.internals?.positionAbsolute?.x ?? node.positionAbsolute?.x ?? node.position.x;
}

/** Absolute Y-Position (siehe `nodeOrigin`). */
export function nodeOriginY(node: GeometryNode): number {
  return node.internals?.positionAbsolute?.y ?? node.positionAbsolute?.y ?? node.position.y;
}

/**
 * Gemessene Breite. `fallback` gilt, solange React Flow den Knoten noch nicht
 * gemessen hat (erste Frame, Server-Render, Fixture ohne Maße).
 */
export function nodeWidth(node: GeometryNode, fallback: number): number {
  return node.measured?.width || node.width || fallback;
}

/** Gemessene Höhe (siehe `nodeWidth`). */
export function nodeHeight(node: GeometryNode, fallback: number): number {
  return node.measured?.height || node.height || fallback;
}

/**
 * Rohwerte der Messung ohne Ersatzwert — für Signaturen, die „noch nicht
 * gemessen“ von „gemessen“ unterscheiden müssen (R-9: Cache-Invalidierung).
 */
export function measuredWidth(node: GeometryNode): number | undefined {
  return node.measured?.width ?? node.width ?? undefined;
}

/** Rohwert der gemessenen Höhe (siehe `measuredWidth`). */
export function measuredHeight(node: GeometryNode): number | undefined {
  return node.measured?.height ?? node.height ?? undefined;
}

/** Handle-Rechtecke des Knotens, unabhängig von der React-Flow-Version. */
export function nodeHandleBounds(node: GeometryNode): HandleBoundsMap | undefined {
  return node.internals?.handleBounds ?? node.handleBounds ?? undefined;
}
