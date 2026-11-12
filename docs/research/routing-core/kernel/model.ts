/**
 * Eingabe-/Ausgabemodell des globalen Routing-Kerns.
 *
 * Der Kern kennt **kein** React Flow, **kein** Store-Objekt und **kein**
 * `PlannerNode`. Er nimmt reine Zahlen: Rechtecke in Canvas-px, Anschlüsse mit
 * Position und Austrittsseite, Kanten mit Endpunkt-Kennungen. Der Adapter in
 * der App-Schicht (`scripts/routing-core/adapt.ts`, später
 * `components/edges/utils/coreRoutingAdapter.ts`) übersetzt
 * `RoutableNode`/`RouteEdgeRef` genau einmal in dieses Modell.
 *
 * Begründung: Regel A (Schichtung) und Regel K (Determinismus) — ein Kern, der
 * nur Zahlen sieht, ist ohne DOM und ohne Store testbar, und ein Plan mit
 * gleichen Zahlen ergibt immer dasselbe Ergebnis.
 */

import type { Point, Rect } from '../../../../lib/routing/geometry';

/** Austrittsseite eines Anschlusses — strukturgleich zu React Flows `Position`. */
export type CoreSide = 'left' | 'right' | 'top' | 'bottom';

export type CoreHandle = {
  readonly id: string;
  /** Anschlusspunkt in Canvas-Koordinaten (px). */
  readonly x: number;
  readonly y: number;
  /** Austrittsrichtung des Stubs. */
  readonly side: CoreSide;
};

export type CoreNode = {
  readonly id: string;
  /** Bauteil-Rechteck in Canvas-Koordinaten (px). */
  readonly rect: Rect;
  readonly handles: readonly CoreHandle[];
};

export type CoreEdge = {
  readonly id: string;
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
  /** Bestätigte Route: der Kern lässt sie unverändert (J5). */
  readonly locked?: boolean;
  /** Zugehörige Route einer gesperrten Kante (nur wenn `locked`). */
  readonly lockedWaypoints?: readonly Point[];
};

export type CoreInput = {
  readonly nodes: readonly CoreNode[];
  readonly edges: readonly CoreEdge[];
};

/**
 * Wie eine Route entstanden ist.
 *
 * `unroutable` ist ein **ehrlicher** Zustand: der Kern liefert nie einen Pfad
 * ohne Freigabe-Garantie (J6). Fehlt eine Lösung, steht der Grund im Feld
 * `reason` und die Kante ist im Bericht sichtbar — nicht als stiller Fallback.
 */
export type CoreRouteKind = 'locked' | 'catalog' | 'grid';

export type CoreRoute = {
  readonly id: string;
  readonly waypoints: readonly Point[];
  readonly length: number;
  readonly bends: number;
  /** Kreuzungen mit **fremden** Kanten (Segment-Paare, diese Kante zählt). */
  readonly crossings: number;
  /** Lane-Offset am Quell-Port (Vielfaches von `laneGrid`). */
  readonly lane: number;
  readonly kind: CoreRouteKind;
};

export type CoreUnroutable = {
  readonly id: string;
  readonly reason: string;
};

export type CoreMetrics = {
  /** Verhandlungs-Iterationen bis zur Zulässigkeit (0 = keine nötig). */
  readonly iterations: number;
  /** Größte Belegung einer Gitterkante am Ende (1 = überdeckungsfrei). */
  readonly maxCongestion: number;
  /** Summe der History-Preise am Ende — Maß für Engstellen (§5.3). */
  readonly totalHistoryCost: number;
  /** Kreuzungs-Refinement-Runden. */
  readonly crossingPasses: number;
  /** Gesamtlänge aller Routen (px). */
  readonly totalLength: number;
  readonly totalBends: number;
  readonly totalCrossings: number;
  /** Gridknoten (Diagnose). */
  readonly gridNodes: number;
  readonly durationMs: number;
};

export type CoreResult = {
  readonly routes: ReadonlyMap<string, CoreRoute>;
  readonly unroutable: readonly CoreUnroutable[];
  readonly metrics: CoreMetrics;
};
