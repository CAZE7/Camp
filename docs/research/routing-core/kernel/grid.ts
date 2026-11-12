/**
 * Hanan-Gitter, Hindernis-Index und Belegungszähler des Routing-Kerns.
 *
 * Das Gitter (§5.1 der Spezifikation) besteht aus den aufgeblähten
 * Bauteilrändern, den Ports und den Stub-Enden. Schritte sind ausschließlich
 * zwischen **benachbarten** Koordinaten erlaubt; damit ist jeder Pfad
 * orthogonal, kann kein Hindernis überspringen und hat Knicke nur auf
 * Gitterlinien.
 *
 * Der Belegungszähler trennt zwei Dinge, die im Bestandsrouter vermischt sind:
 *
 * * **Kantenbelegung** `usage` — kollineare Nutzung einer Gitterkante. Sie darf
 *   höchstens 1 sein (Regel L: Überdeckung verboten); genau das erzwingt das
 *   Verhandlungsverfahren über Preise statt über Sperrflächen.
 * * **Durchquerungszähler** `vThrough`/`hThrough` — wie viele fremde Routen
 *   einen Gitterknoten *durchfahren*. Nur ein Durchfahren ist eine Kreuzung;
 *   ein Enden am Knoten (T-Stoß) ist keine.
 */

import type { Point, Rect, Segment } from '../../../../lib/routing/geometry';
import type { CoreHandle, CoreNode } from './model';
import { CORE_TOKENS } from './tokens';

const EPS = 1e-6;

const QUANT = 1000;
/** Kanonischer Schlüssel einer Koordinate (1/1000 px) — deterministische Gleichheit. */
export const q = (value: number): number => Math.round(value * QUANT);

/** Kanonischer Schlüssel einer ungerichteten Gitterkante. */
export const edgeKey = (ax: number, ay: number, bx: number, by: number): string => {
  const ka = `${q(ax)}|${q(ay)}`;
  const kb = `${q(bx)}|${q(by)}`;
  return ka < kb ? `${ka}>${kb}` : `${kb}>${ka}`;
};

export const vertexKey = (x: number, y: number): string => `${q(x)}|${q(y)}`;

export type Grid = {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly xIndex: ReadonlyMap<number, number>;
  readonly yIndex: ReadonlyMap<number, number>;
};

const uniqueSorted = (values: readonly number[]): number[] => {
  const seen = new Map<number, number>();
  for (const value of values) {
    const key = q(value);
    if (!seen.has(key)) seen.set(key, Math.round(value * QUANT) / QUANT);
  }
  return [...seen.values()].sort((a, b) => a - b);
};

const sidesOf = (rect: Rect): { x0: number; x1: number; y0: number; y1: number } => ({
  x0: rect.x,
  x1: rect.x + rect.width,
  y0: rect.y,
  y1: rect.y + rect.height,
});

/**
 * Gitterkoordinaten: **ein globales Kanalraster** plus die exakten Anschluss-
 * und Stub-Koordinaten.
 *
 * Warum ein globales Raster
 * =========================
 * Vorher kamen die Linien aus jedem Bauteil einzeln (Rand ± 14, ± 12, ± 16·k).
 * Zwei Bauteile, die nicht auf demselben Vielfachen liegen, erzeugen dadurch
 * Linien, die 2 px auseinander liegen. Zwei Trassen auf diesen Linien
 * **überdecken sich nicht** — aber sie unterschreiten die Clearance, und das ist
 * eine I3-Verletzung, die keine Suche mehr reparieren kann, weil das Angebot an
 * legalen Nachbarlinien fehlt.
 *
 * Ein Raster mit `laneGrid`-Abstand (16 px ≥ Clearance 12 px) macht die
 * Nachbarschaft **strukturell legal**: zwei Trassen sind entweder auf derselben
 * Linie (dann überdecken sie sich, und die Verhandlung hat etwas zu tun) oder
 * mindestens 16 px auseinander. Genau das ist der Unterschied zwischen
 * „Kanäle gibt es zufällig" und „Kanäle sind geplant".
 *
 * Die Anschluss- und Stub-Koordinaten bleiben exakt: sie sind der Übergang
 * zwischen Bauteil und Raster und dürfen nicht gerundet werden — ein gerundeter
 * Anschluss ist ein falscher Anschluss.
 */
export function buildGrid(
  nodes: readonly CoreNode[],
  stubPoints: readonly { source: { x: number; y: number }; target: { x: number; y: number } }[]
): Grid {
  const xs: number[] = [];
  const ys: number[] = [];
  const spacing = CORE_TOKENS.laneGrid;
  const padding = spacing * 4;

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const track = (x: number, y: number): void => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const node of nodes) {
    const { x0, x1, y0, y1 } = sidesOf(node.rect);
    track(x0, y0);
    track(x1, y1);
  }
  for (const pair of stubPoints) {
    track(pair.source.x, pair.source.y);
    track(pair.target.x, pair.target.y);
  }

  if (Number.isFinite(bounds.minX)) {
    const fromX = Math.floor((bounds.minX - padding) / spacing) * spacing;
    const toX = Math.ceil((bounds.maxX + padding) / spacing) * spacing;
    const fromY = Math.floor((bounds.minY - padding) / spacing) * spacing;
    const toY = Math.ceil((bounds.maxY + padding) / spacing) * spacing;
    for (let x = fromX; x <= toX; x += spacing) xs.push(x);
    for (let y = fromY; y <= toY; y += spacing) ys.push(y);
  }

  // Exakte Verbindungspunkte — nur diese Linien dürfen vom Raster abweichen.
  for (const node of nodes) {
    for (const handle of node.handles) {
      xs.push(handle.x);
      ys.push(handle.y);
    }
  }
  for (const pair of stubPoints) {
    xs.push(pair.source.x, pair.target.x);
    ys.push(pair.source.y, pair.target.y);
  }

  const sortedXs = uniqueSorted(xs);
  const sortedYs = uniqueSorted(ys);
  return {
    xs: sortedXs,
    ys: sortedYs,
    xIndex: new Map(sortedXs.map((value, i) => [q(value), i])),
    yIndex: new Map(sortedYs.map((value, i) => [q(value), i])),
  };
}

/** Achsenparalleles Segment (nur horizontale/vertikale Stücke). */
export const isHorizontal = (segment: Segment): boolean => Math.abs(segment[0].y - segment[1].y) < EPS;
export const isVertical = (segment: Segment): boolean => Math.abs(segment[0].x - segment[1].x) < EPS;

const openOverlap = (a0: number, a1: number, b0: number, b1: number): boolean => {
  const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return hi - lo > EPS;
};

const pointInsideOpen = (value: number, lo: number, hi: number, invert: boolean): boolean =>
  invert ? value > lo + EPS && value < hi - EPS : value > lo - EPS && value < hi + EPS;

/**
 * Hindernis-Index: je Bauteil das um `obstacleMargin` aufgeblähte Rechteck.
 *
 * `blocked(segment, ownNodeIds)` arbeitet in **offenen** Intervallen: eine
 * Gitterlinie exakt auf dem aufgeblähten Rand ist erlaubt (das ist der
 * Korridor), ein Eindringen in das Innere nicht.
 */
export class ObstacleIndex {
  private readonly entries: { id: string; x0: number; x1: number; y0: number; y1: number }[];

  constructor(nodes: readonly CoreNode[]) {
    const margin = CORE_TOKENS.obstacleMargin;
    this.entries = nodes.map((node) => {
      const { x0, x1, y0, y1 } = sidesOf(node.rect);
      return { id: node.id, x0: x0 - margin, x1: x1 + margin, y0: y0 - margin, y1: y1 + margin };
    });
  }

  /**
   * `relaxed = true` ist das **Stub-Recht** (R-7, ROUTING-CONTEXT §4.3,
   * Ausnahme 3): im engen Fenster um einen Anschluss gilt statt des
   * Hindernis-Margins (14 px) nur die Rohbox + 2 px. Ohne diese Ausnahme sind
   * Anschlüsse, die unmittelbar an einem fremden Bauteil liegen (im
   * Referenzplan `simple` z. B. zwei vertikal benachbarte Bauteile), mit
   * keinem Gitterpfad erreichbar — der Bestandsrouter löst genau diesen Fall
   * über `stubCap`/`tightMarginUsed`.
   */
  /** Erste blockierende Bauteil-ID (Diagnose/Tests) oder `null`. */
  blocker(
    segment: Segment,
    ownNodeIds: ReadonlySet<string>,
    margin = CORE_TOKENS.obstacleMargin
  ): string | null {
    const horizontal = isHorizontal(segment);
    const [a, b] = segment;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const line = horizontal ? a.y : a.x;
    const inset = CORE_TOKENS.obstacleMargin - margin;
    for (const entry of this.entries) {
      if (ownNodeIds.has(entry.id)) continue;
      const x0 = entry.x0 + inset;
      const x1 = entry.x1 - inset;
      const y0 = entry.y0 + inset;
      const y1 = entry.y1 - inset;
      const lineOk = horizontal ? pointInsideOpen(line, y0, y1, true) : pointInsideOpen(line, x0, x1, true);
      if (!lineOk) continue;
      const spanOk = horizontal ? openOverlap(lo, hi, x0, x1) : openOverlap(lo, hi, y0, y1);
      if (spanOk) return entry.id;
    }
    return null;
  }

  blocked(segment: Segment, ownNodeIds: ReadonlySet<string>, margin = CORE_TOKENS.obstacleMargin): boolean {
    const horizontal = isHorizontal(segment);
    const [a, b] = segment;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const line = horizontal ? a.y : a.x;
    const inset = CORE_TOKENS.obstacleMargin - margin;
    for (const entry of this.entries) {
      if (ownNodeIds.has(entry.id)) continue;
      const x0 = entry.x0 + inset;
      const x1 = entry.x1 - inset;
      const y0 = entry.y0 + inset;
      const y1 = entry.y1 - inset;
      const lineOk = horizontal ? pointInsideOpen(line, y0, y1, true) : pointInsideOpen(line, x0, x1, true);
      if (!lineOk) continue;
      const spanOk = horizontal ? openOverlap(lo, hi, x0, x1) : openOverlap(lo, hi, y0, y1);
      if (spanOk) return true;
    }
    return false;
  }
}

/**
 * Reservierte Stubs: jede Kante reserviert ihren Stub als Sperrfläche für
 * **fremde** Anschlüsse (eigene Anschlüsse dürfen ihn mitbenutzen — die
 * Port-Bündel-Ausnahme, §5.3).
 */
export type StubReservation = {
  readonly handleKey: string;
  /** Der **ganze** Fächer (Handle → Stub → Lane-Punkt), nicht nur ein Segment. */
  readonly path: readonly Point[];
};

export const handleKey = (nodeId: string, handleId: string): string => `${nodeId}\u0000${handleId}`;

/** Kleinster Abstand eines Segments zu einer Polylinie. */
const polylineDistance = (segment: Segment, path: readonly Point[]): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < path.length; i += 1) {
    const piece: Segment = [path[i] as Point, path[i + 1] as Point];
    best = Math.min(best, segmentDistance(segment, piece));
  }
  return best;
};

export function stubBlocker(
  segment: Segment,
  reservations: readonly StubReservation[],
  ownHandleKeys: ReadonlySet<string>
): string | null {
  for (const reservation of reservations) {
    if (ownHandleKeys.has(reservation.handleKey)) continue;
    if (polylineDistance(segment, reservation.path) < CORE_TOKENS.stubReserveMargin - EPS) {
      return reservation.handleKey;
    }
  }
  return null;
}

export function stubBlocks(
  segment: Segment,
  reservations: readonly StubReservation[],
  ownHandleKeys: ReadonlySet<string>
): boolean {
  // Nur echte Berührung sperrt. Die 12-px-Clearance gilt für Bauteile; an
  // Anschlüssen ist sie in den Referenzplänen physikalisch unmöglich
  // (Busbar-Anschlüsse liegen 8 px auseinander). Ein Stub reserviert deshalb
  // nur seinen eigenen Querschnitt plus 2 px — der Rest ist Sache der
  // Prüfinstanz (I3), die solche Nähe ehrlich meldet.
  for (const reservation of reservations) {
    if (ownHandleKeys.has(reservation.handleKey)) continue;
    if (polylineDistance(segment, reservation.path) < CORE_TOKENS.stubReserveMargin - EPS) return true;
  }
  return false;
}

/**
 * Abstand zweier achsenparalleler Segmente.
 *
 * Der Abstand zweier „Nullbreiten-Rechtecke" ist der Abstand ihrer
 * Bounding-Boxen: `hypot(Lücke in x, Lücke in y)`. Überlappen sich beide
 * Achsen, ist er 0 (Schnitt oder Berührung). Die frühere, achsenweise
 * Prüfung war zu grob: ein **senkrechter** Stub blockierte jedes waagerechte
 * Segment, das seinen x-Wert querte — unabhängig vom y-Abstand.
 */
export function segmentDistance(a: Segment, b: Segment): number {
  const ax0 = Math.min(a[0].x, a[1].x);
  const ax1 = Math.max(a[0].x, a[1].x);
  const ay0 = Math.min(a[0].y, a[1].y);
  const ay1 = Math.max(a[0].y, a[1].y);
  const bx0 = Math.min(b[0].x, b[1].x);
  const bx1 = Math.max(b[0].x, b[1].x);
  const by0 = Math.min(b[0].y, b[1].y);
  const by1 = Math.max(b[0].y, b[1].y);
  const gapX = Math.max(ax0 - bx1, bx0 - ax1, 0);
  const gapY = Math.max(ay0 - by1, by0 - ay1, 0);
  return Math.hypot(gapX, gapY);
}

/** Ein Gitterschritt in Richtung `dir`. */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly { dx: number; dy: number; dir: Dir }[] = [
  { dx: 1, dy: 0, dir: 0 },
  { dx: 0, dy: 1, dir: 1 },
  { dx: -1, dy: 0, dir: 2 },
  { dx: 0, dy: -1, dir: 3 },
];

/**
 * Belegungs- und Durchfahrtszähler.
 *
 * `history` wächst monoton (Verhandlungspreise), `usage` ist der Ist-Zustand
 * der aktuell verlegten Routen, `vThrough`/`hThrough` zählen Durchfahrten je
 * Gitterknoten (Kreuzungserkennung).
 */
export class Occupancy {
  private readonly usage = new Map<string, number>();
  // Per edge and endpoint-port group: lets the local A* retry identify shared-port I2 conflicts.
  private readonly portUsage = new Map<string, Map<string, number>>();
  private readonly history = new Map<string, number>();
  private readonly vThrough = new Map<string, number>();
  private readonly hThrough = new Map<string, number>();

  get(ax: number, ay: number, bx: number, by: number): number {
    return this.usage.get(edgeKey(ax, ay, bx, by)) ?? 0;
  }

  add(ax: number, ay: number, bx: number, by: number, delta: number): void {
    const key = edgeKey(ax, ay, bx, by);
    const next = (this.usage.get(key) ?? 0) + delta;
    if (next <= 0) this.usage.delete(key);
    else this.usage.set(key, next);
  }

  /** Add one usage count and retain the endpoint port groups that own this route step. */
  addWithPorts(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    portKeys: readonly string[],
    delta: 1 | -1
  ): void {
    this.add(ax, ay, bx, by, delta);
    const key = edgeKey(ax, ay, bx, by);
    let owners = this.portUsage.get(key);
    if (!owners) {
      if (delta < 0) return;
      owners = new Map<string, number>();
      this.portUsage.set(key, owners);
    }
    for (const portKey of new Set(portKeys)) {
      const next = (owners.get(portKey) ?? 0) + delta;
      if (next <= 0) owners.delete(portKey);
      else owners.set(portKey, next);
    }
    if (owners.size === 0) this.portUsage.delete(key);
  }

  /** Is this grid step already used by a route sharing any queried endpoint port? */
  overlapsPort(ax: number, ay: number, bx: number, by: number, portKeys: ReadonlySet<string>): boolean {
    const owners = this.portUsage.get(edgeKey(ax, ay, bx, by));
    if (!owners) return false;
    for (const portKey of portKeys) if ((owners.get(portKey) ?? 0) > 0) return true;
    return false;
  }

  historyOf(ax: number, ay: number, bx: number, by: number): number {
    return this.history.get(edgeKey(ax, ay, bx, by)) ?? 0;
  }

  raiseHistory(ax: number, ay: number, bx: number, by: number, amount: number): void {
    const key = edgeKey(ax, ay, bx, by);
    this.history.set(key, (this.history.get(key) ?? 0) + amount);
  }

  totalHistory(): number {
    let sum = 0;
    for (const value of this.history.values()) sum += value;
    return sum;
  }

  throughVertical(x: number, y: number): number {
    return this.vThrough.get(vertexKey(x, y)) ?? 0;
  }

  throughHorizontal(x: number, y: number): number {
    return this.hThrough.get(vertexKey(x, y)) ?? 0;
  }

  addThrough(x: number, y: number, vertical: boolean, delta: number): void {
    const map = vertical ? this.vThrough : this.hThrough;
    const key = vertexKey(x, y);
    const next = (map.get(key) ?? 0) + delta;
    if (next <= 0) map.delete(key);
    else map.set(key, next);
  }

  // --- Klarheitsfeld ------------------------------------------------------
  //
  // `usage` zählt **Überdeckung** (gleicher Schritt). Zwei Trassen können sich
  // aber auch *neben*einander mit 2 px Abstand bewegen — das ist keine
  // Überdeckung, sondern ein Clearance-Verstoß (I3), und den konnte die
  // Verhandlung bisher nicht sehen. Das Klarheitsfeld markiert jeden
  // Gitterschritt, der einer verlegten Route **parallel** näher als die
  // Clearance kommt, und merkt sich den Eigentümer. Eigene Schritte und
  // Schritte, die nur demselben Anschluss-Bündel gehören, sind frei.
  private readonly proximity = new Map<string, string | '*'>();

  addProximity(ax: number, ay: number, bx: number, by: number, owner: string, delta: number): void {
    const key = edgeKey(ax, ay, bx, by);
    if (delta > 0) {
      const current = this.proximity.get(key);
      if (current === undefined) this.proximity.set(key, owner);
      else if (current !== owner) this.proximity.set(key, '*');
    } else {
      const current = this.proximity.get(key);
      if (current === undefined) return;
      if (current === owner) this.proximity.delete(key);
      // '*': mehrere Eigentümer — der Eintrag bleibt, bis die Route neu gebaut
      // wird; ein veralteter Eintrag ist unschädlich (er blockt nur).
    }
  }

  proximityOwner(ax: number, ay: number, bx: number, by: number): string | undefined {
    return this.proximity.get(edgeKey(ax, ay, bx, by));
  }

  /** Ist der Schritt für `ownEdgeId` durch fremde Klarheit gesperrt? */
  proximityBlocked(ax: number, ay: number, bx: number, by: number, ownOwners: ReadonlySet<string>): boolean {
    const owner = this.proximity.get(edgeKey(ax, ay, bx, by));
    if (owner === undefined) return false;
    if (owner === '*') return true;
    return !ownOwners.has(owner);
  }

  clearProximity(): void {
    this.proximity.clear();
  }

  /** Alle überbelegten Gitterkanten (für die History-Aktualisierung). */
  overloaded(): { a: { x: number; y: number }; b: { x: number; y: number }; count: number }[] {
    const out: { a: { x: number; y: number }; b: { x: number; y: number }; count: number }[] = [];
    const keys = [...this.usage.keys()].sort();
    for (const key of keys) {
      const count = this.usage.get(key) ?? 0;
      if (count <= 1) continue;
      const [left, right] = key.split('>') as [string, string];
      const [xa, ya] = left.split('|').map(Number) as [number, number];
      const [xb, yb] = right.split('|').map(Number) as [number, number];
      out.push({
        a: { x: xa / QUANT, y: ya / QUANT },
        b: { x: xb / QUANT, y: yb / QUANT },
        count,
      });
    }
    return out;
  }

  maxUsage(): number {
    let max = 0;
    for (const value of this.usage.values()) max = Math.max(max, value);
    return max;
  }

  clear(): void {
    this.usage.clear();
    this.portUsage.clear();
  }
}

/**
 * Trägt eine fertige Route in die Zähler ein oder aus.
 * `delta = +1` beim Verlegen, `−1` beim Rip-up.
 *
 * Die Durchfahrtszähler werden für **alle** Gitterknoten im Inneren eines
 * Segments gesetzt (nicht nur für die Knicke): nur so ist eine Kreuzung
 * erkennbar, die mitten auf einem langen Segment liegt.
 */

/**
 * Stempelt das Klarheitsfeld entlang einer Route: jeder **parallele**
 * Gitterschritt, der der Route näher als `clearance` kommt, wird markiert.
 * Senkrechte Schritte (echte Kreuzungen) bleiben frei — Kreuzen ist erlaubt
 * (I10), Nebeneinanderlaufen unter der Clearance nicht (I3).
 */
export function applyClearance(
  occupancy: Occupancy,
  grid: Grid,
  waypoints: readonly Point[],
  owner: string,
  delta: 1 | -1
): void {
  const clearance = CORE_TOKENS.clearance;
  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i] as Point;
    const b = waypoints[i + 1] as Point;
    const horizontal = Math.abs(a.y - b.y) < EPS;
    const line = horizontal ? a.y : a.x;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const crossCoords = horizontal ? grid.ys : grid.xs;
    const alongCoords = horizontal ? grid.xs : grid.ys;
    for (let r = 0; r < crossCoords.length; r += 1) {
      const other = crossCoords[r] as number;
      const gap = Math.abs(other - line);
      if (gap <= EPS || gap >= clearance - EPS) continue;
      for (let k = 0; k + 1 < alongCoords.length; k += 1) {
        const from = alongCoords[k] as number;
        const to = alongCoords[k + 1] as number;
        if (to <= lo + EPS || from >= hi - EPS) continue;
        if (horizontal) occupancy.addProximity(from, other, to, other, owner, delta);
        else occupancy.addProximity(other, from, other, to, owner, delta);
      }
    }
  }
}

/**
 * `portKeys` is optional for geometric callers; the core supplies both endpoint
 * groups so the local alternate search can distinguish a port-bundle conflict
 * from ordinary negotiated congestion.
 */
export function applyRoute(
  occupancy: Occupancy,
  grid: Grid,
  waypoints: readonly { x: number; y: number }[],
  delta: 1 | -1,
  portKeys?: readonly string[]
): void {
  const add = (ax: number, ay: number, bx: number, by: number): void => {
    if (portKeys) occupancy.addWithPorts(ax, ay, bx, by, portKeys, delta);
    else occupancy.add(ax, ay, bx, by, delta);
  };
  const interiorIndices = (
    values: readonly number[],
    index: ReadonlyMap<number, number>,
    from: number,
    to: number
  ) => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const out: [number, number][] = [];
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] as number;
      if (value > lo + EPS && value < hi - EPS) out.push([value, i]);
    }
    void index;
    return out;
  };

  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i] as Point;
    const b = waypoints[i + 1] as Point;
    const vertical = Math.abs(a.x - b.x) < EPS;
    // Belegung muss in **Gitterschritten** gezählt werden, nicht in
    // Polylinien-Segmenten: der A* fragt `occupancy.get(nachbar, nachbar)` für
    // einen einzelnen Schritt ab. Ein langes Segment als Ganzes zu zählen
    // erzeugt einen Schlüssel, den die Suche nie abfragt — die Überlast war
    // damit unsichtbar, und nur exakt gleiche Segmente (gemeinsame Stubs)
    // wurden überhaupt als Konflikt erkannt.
    const stairs = vertical ? grid.ys : grid.xs;
    const index = vertical ? grid.yIndex : grid.xIndex;
    const from = vertical ? a.y : a.x;
    const to = vertical ? b.y : b.x;
    const stops: number[] = [from];
    for (const [value] of interiorIndices(stairs, index, from, to)) stops.push(value);
    stops.push(to);
    for (let k = 0; k + 1 < stops.length; k += 1) {
      const lo = stops[k] as number;
      const hi = stops[k + 1] as number;
      if (vertical) add(a.x, lo, a.x, hi);
      else add(lo, a.y, hi, a.y);
    }
    if (vertical) {
      for (const [y] of interiorIndices(grid.ys, grid.yIndex, a.y, b.y)) {
        occupancy.addThrough(a.x, y, true, delta);
      }
    } else {
      for (const [x] of interiorIndices(grid.xs, grid.xIndex, a.x, b.x)) {
        occupancy.addThrough(x, a.y, false, delta);
      }
    }
  }
}

/** Stub-Ende eines Anschlusses: Port plus `stubMin` in Austrittsrichtung. */
export function stubBase(handle: CoreHandle): Point {
  const length = CORE_TOKENS.stubMin;
  switch (handle.side) {
    case 'right':
      return { x: handle.x + length, y: handle.y };
    case 'left':
      return { x: handle.x - length, y: handle.y };
    case 'top':
      return { x: handle.x, y: handle.y - length };
    case 'bottom':
    default:
      return { x: handle.x, y: handle.y + length };
  }
}

/** Fester, orthogonaler Portstub vom Handle bis zum Stub-Ende. */
export function fanoutPath(handle: CoreHandle): Point[] {
  return [{ x: handle.x, y: handle.y }, stubBase(handle)];
}

/** Austrittsrichtung (als `Dir`) einer Portseite. */
export function sideDir(side: CoreHandle['side']): Dir {
  switch (side) {
    case 'right':
      return 0;
    case 'bottom':
      return 1;
    case 'left':
      return 2;
    case 'top':
    default:
      return 3;
  }
}
