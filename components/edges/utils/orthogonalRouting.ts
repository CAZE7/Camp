import { Position, Node } from 'reactflow';

/**
 * Orthogonales Kabel-Routing mit Hindernisvermeidung und parallelen Lanes.
 *
 * Die Basis ist ein rechtwinkliger Pfad (Manhattan, abgerundete Ecken) zwischen
 * zwei orientierten Handle-Punkten. Vor dem Rendern wird jeder achsenparallele
 * Segmentabschnitt gegen Node-Bounding-Boxes geprüft; kreuzen sie einen Node,
 * wird ein kleiner Detour um dessen (aufgeblähte) Box gelegt. So laufen Kabel
 * nicht mehr quer durch Komponenten hindurch.
 *
 * Pure Funktionen ohne React-Flow-Abhängigkeit — leicht unit-testbar.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const ROUTE_BORDER_RADIUS = 10;
export const ROUTE_MIN_STUB = 24;
export const OBSTACLE_MARGIN = 14;

/** Fallback-Maße für Nodes ohne gemessene width/height (entspricht w-48 ~ 192px). */
export const NODE_FALLBACK_WIDTH = 192;
export const NODE_FALLBACK_HEIGHT = 120;

/** Richtung, in der eine Kante den Source-Node verlässt. */
export const sourceExitVector = (position?: Position): Point => {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    case Position.Right:
    default:
      return { x: 1, y: 0 };
  }
};

/** Richtung, in der eine Kante in den Target-Node eintritt. */
export const targetEntryVector = (position?: Position): Point => {
  const d = sourceExitVector(position);
  // Explizite 0-Normalisierung: `-0` ist in JavaScript falsy UND ungleich 0
  // (Object.is), was toEqual-Assertions und potenzielle Pfadlogik brechen
  // würde. Das frühere `-d.x || 0` erzeugte zwar 0, verdeckte die Absicht.
  return { x: d.x === 0 ? 0 : -d.x, y: d.y === 0 ? 0 : -d.y };
};

const isHorizontal = (d: Point): boolean => Math.abs(d.x) === 1;

/**
 * Erzeugt die Basis-Wegpunkte (ohne Rundung, ohne Hindernisse) für einen
 * orthogonalen Pfad zwischen zwei orientierten Punkten. Reihenfolge:
 * [Start, ...Ecken..., Ende].
 */
export function routeWaypoints(input: {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  offset?: number;
}): Point[] {
  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const offset = input.offset ?? 0;
  const S: Point = { x: input.sourceX, y: input.sourceY };
  const T: Point = { x: input.targetX, y: input.targetY };

  const points: Point[] = [S];

  if (isHorizontal(ds) && isHorizontal(dt)) {
    if (ds.x === dt.x) {
      // Gleiche Richtung: Ziel liegt in Fahrtrichtung vor der Kante
      if (S.x === T.x && S.y === T.y) {
        return [S];
      }
      if (S.y === T.y && offset === 0 && ((ds.x > 0 && T.x >= S.x) || (ds.x < 0 && T.x <= S.x))) {
        // Exakt waagerechte Gerade ohne Versatz
        points.push(T);
        return points;
      }
      const midX = (S.x + T.x) / 2 + offset;
      points.push({ x: midX, y: S.y });
      points.push({ x: midX, y: T.y });
    } else {
      // Gegenrichtung: Ziel liegt "hinter" der Kante → Schlaufe aussen herum.
      const dir = ds.x > 0 ? 1 : -1;
      const loopX =
        (dir > 0 ? Math.max(S.x, T.x) : Math.min(S.x, T.x)) + dir * (ROUTE_MIN_STUB * 2 + Math.abs(offset));
      points.push({ x: loopX, y: S.y });
      points.push({ x: loopX, y: T.y });
    }
  } else if (!isHorizontal(ds) && !isHorizontal(dt)) {
    if (ds.y === dt.y) {
      if (S.x === T.x && S.y === T.y) {
        return [S];
      }
      if (S.x === T.x && offset === 0 && ((ds.y > 0 && T.y >= S.y) || (ds.y < 0 && T.y <= S.y))) {
        // Exakt senkrechte Gerade ohne Versatz
        points.push(T);
        return points;
      }
      const midY = (S.y + T.y) / 2 + offset;
      points.push({ x: S.x, y: midY });
      points.push({ x: T.x, y: midY });
    } else {
      const dir = ds.y > 0 ? 1 : -1;
      const loopY =
        (dir > 0 ? Math.max(S.y, T.y) : Math.min(S.y, T.y)) + dir * (ROUTE_MIN_STUB * 2 + Math.abs(offset));
      points.push({ x: S.x, y: loopY });
      points.push({ x: T.x, y: loopY });
    }
  } else if (isHorizontal(ds)) {
    // Quelle horizontal, Ziel vertikal → eine Ecke.
    points.push({ x: T.x, y: S.y });
  } else {
    // Quelle vertikal, Ziel horizontal → eine Ecke.
    points.push({ x: S.x, y: T.y });
  }

  points.push(T);
  return points;
}

/** Vergrößert eine Node-Box um den Sicherheitsabstand. */
const inflate = (r: Rect, margin: number): Rect => ({
  x: r.x - margin,
  y: r.y - margin,
  width: r.width + margin * 2,
  height: r.height + margin * 2,
});

/** Prüft, ob ein achsenparalleles Segment eine Box kreuzt (echter Schnitt). */
export function segmentCrossesRect(a: Point, b: Point, r: Rect): boolean {
  if (a.x === b.x) {
    const x = a.x;
    if (x <= r.x || x >= r.x + r.width) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > r.y && lo < r.y + r.height;
  }
  if (a.y === b.y) {
    const y = a.y;
    if (y <= r.y || y >= r.y + r.height) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > r.x && lo < r.x + r.width;
  }
  return false;
}

/**
 * Ersetzt ein einzelnes Segment durch einen Detour um die Box (ohne die
 * Endpunkte a/b selbst). Liefert `null`, wenn kein Schnitt vorliegt.
 */
function detourAround(a: Point, b: Point, r: Rect, margin: number): Point[] | null {
  if (!segmentCrossesRect(a, b, r)) return null;
  const inflated = inflate(r, margin);

  if (a.x === b.x) {
    // Vertikales Segment → links oder rechts vorbei (nähere Seite wählen).
    const x = a.x;
    const detourX = x < inflated.x + inflated.width / 2 ? inflated.x : inflated.x + inflated.width;
    return [
      { x, y: inflated.y },
      { x: detourX, y: inflated.y },
      { x: detourX, y: inflated.y + inflated.height },
      { x, y: inflated.y + inflated.height },
    ];
  }

  // Horizontales Segment → oben oder unten vorbei (nähere Seite wählen).
  const y = a.y;
  const detourY = y < inflated.y + inflated.height / 2 ? inflated.y : inflated.y + inflated.height;
  return [
    { x: inflated.x, y },
    { x: inflated.x, y: detourY },
    { x: inflated.x + inflated.width, y: detourY },
    { x: inflated.x + inflated.width, y },
  ];
}

/** Liegt ein Punkt echt innerhalb einer Box? */
const containsPoint = (r: Rect, p: Point): boolean =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

/**
 * Liegt `candidate` auf derselben Achse wie das Segment a→b und *hinter*
 * dem Punkt `end`, also entgegen der Fahrtrichtung?
 *
 * Solche Punkte entstehen, wenn ein Detour über das ursprüngliche
 * Segmentende hinausführt (das Hindernis ist breiter als das Segment).
 * Ohne diese Prüfung liefe der Pfad zurück in das gerade umfahrene
 * Hindernis — und würde im nächsten Durchlauf erneut umfahren. Genau so
 * entstand die beobachtete Zickzack-Schleife.
 */
function isBehind(a: Point, b: Point, end: Point, candidate: Point): boolean {
  if (a.y === b.y && candidate.y === a.y && end.y === a.y) {
    const direction = Math.sign(b.x - a.x) || 1;
    return (candidate.x - end.x) * direction < 0;
  }
  if (a.x === b.x && candidate.x === a.x && end.x === a.x) {
    const direction = Math.sign(b.y - a.y) || 1;
    return (candidate.y - end.y) * direction < 0;
  }
  return false;
}

/**
 * Stellt sicher, dass aufeinanderfolgende Punkte achsenparallel verbunden
 * sind. Nötig, weil beim Verwerfen überholter Wegpunkte (siehe `isBehind`)
 * zwei Punkte nebeneinander landen können, die weder x noch y teilen.
 * Der eingefügte Ellbogen ist deterministisch: erst waagerecht, dann
 * senkrecht.
 */
function enforceOrthogonal(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && last.x !== point.x && last.y !== point.y) {
      out.push({ x: point.x, y: last.y });
    }
    out.push(point);
  }
  return out;
}

/**
 * Legt einen Detour um das erste kreuzende Hindernis und wiederholt das
 * iterativ, bis keine Kreuzung mehr besteht (max. begrenzte Durchläufe).
 *
 * Zwei Regeln machen das Verfahren stabil:
 *
 *  1. Hindernisse, die den Start- oder Zielpunkt enthalten, werden ignoriert.
 *     Eine Leitung zu einem Bauteil *in* einer Box muss diese Box betreten;
 *     ein Ausweichversuch wäre endlos (dokumentierte Ausnahme, siehe
 *     `routingScenarios.ts`, Fälle 20/21).
 *  2. Führt ein Detour über das Segmentende hinaus, werden die dadurch
 *     überholten Wegpunkte verworfen statt rückwärts angefahren. Der
 *     Zielpunkt bleibt dabei immer erhalten.
 */
export function avoidObstacles(
  waypoints: Point[],
  obstacles: Rect[],
  margin: number = OBSTACLE_MARGIN
): Point[] {
  if (obstacles.length === 0 || waypoints.length < 2) return waypoints;

  const start = waypoints[0];
  const finish = waypoints[waypoints.length - 1];
  const relevant = obstacles.filter(
    (obstacle) => !containsPoint(obstacle, start) && !containsPoint(obstacle, finish)
  );
  if (relevant.length === 0) return waypoints;

  let current = waypoints;
  for (let iteration = 0; iteration < 12; iteration++) {
    let changed = false;
    const next: Point[] = [];

    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      next.push(a);

      let detoured = false;
      for (const obstacle of relevant) {
        const replacement = detourAround(a, b, obstacle, margin);
        if (!replacement) continue;

        for (const p of replacement) next.push(p);
        detoured = true;
        changed = true;

        // Rest anhängen — aber ohne die Punkte, die der Detour bereits
        // überholt hat (sonst Rückwärtsfahrt ins Hindernis).
        const end = replacement[replacement.length - 1];
        for (let j = i + 1; j < current.length; j++) {
          const isLast = j === current.length - 1;
          if (!isLast && isBehind(a, b, end, current[j])) continue;
          next.push(current[j]);
        }
        break;
      }
      if (detoured) break;
    }

    if (!changed) {
      // Kein Detour in diesem Durchlauf: die Schleife oben hat nur die
      // Segment-Anfänge übernommen, der Zielpunkt fehlt noch.
      next.push(current[current.length - 1]);
    }

    current = dedupe(enforceOrthogonal(next));
    if (!changed) break;
  }
  return current;
}

/** Entfernt aufeinanderfolgende Duplikate (Punkt direkt hinter Punkt). */
export function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  return out;
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** Punkt auf der Strecke a→b im Abstand `d` von `a`. */
const toward = (a: Point, b: Point, d: number): Point => {
  const len = distance(a, b);
  if (len === 0) return { ...a };
  const t = Math.min(1, d / len);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/** Wandelt Wegpunkte in einen SVG-Pfad mit abgerundeten Ecken um. */
export function waypointsToPath(waypoints: Point[], radius: number): string {
  if (waypoints.length < 2) return '';
  let d = `M ${fmt(waypoints[0].x)} ${fmt(waypoints[0].y)}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    const r = Math.min(radius, distance(prev, curr) / 2, distance(curr, next) / 2);
    const inPt = toward(curr, prev, r);
    const outPt = toward(curr, next, r);
    d += ` L ${fmt(inPt.x)} ${fmt(inPt.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(outPt.x)} ${fmt(outPt.y)}`;
  }
  const last = waypoints[waypoints.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

/** Punkt in der Mitte der Polylinie (nach kumulierter Länge) — für das Label. */
export function polylineMidpoint(waypoints: Point[]): Point {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { ...waypoints[0] };

  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = distance(waypoints[i], waypoints[i + 1]);
    lengths.push(len);
    total += len;
  }
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= total / 2) {
      return toward(waypoints[i], waypoints[i + 1], total / 2 - acc);
    }
    acc += lengths[i];
  }
  return { ...waypoints[waypoints.length - 1] };
}

/* ------------------------------------------------------------------ *
 * Kreuzungs-Reduktion
 *
 * Ein orthogonaler Pfad ist erst dann übersichtlich, wenn er möglichst
 * wenige fremde Leitungen schneidet. Wir zählen die Schnitte gegen die
 * (grob genäherten) Verläufe der übrigen Kanten und weichen bei mehr als
 * MAX_ACCEPTABLE_CROSSINGS auf eine Variante mit größerem Abstand aus.
 * ------------------------------------------------------------------ */

export type Segment = [Point, Point];

/** Ab dieser Zahl an Kreuzungen wird eine Alternativroute gesucht. */
export const MAX_ACCEPTABLE_CROSSINGS = 2;

/** Zusätzlicher Abstand je Ausweich-Versuch (ein Vielfaches der Lane-Breite). */
export const ALTERNATIVE_ROUTE_GAP = 40;

/** Zerlegt eine Polylinie in einzelne Segmente. */
export function waypointsToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) segments.push([points[i], points[i + 1]]);
  return segments;
}

const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a: Point, b: Point, c: Point): boolean =>
  b.x <= Math.max(a.x, c.x) + 1e-9 &&
  b.x >= Math.min(a.x, c.x) - 1e-9 &&
  b.y <= Math.max(a.y, c.y) + 1e-9 &&
  b.y >= Math.min(a.y, c.y) - 1e-9;

/** Echter Schnitt zweier Strecken (auch für kollineare Überlappung). */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * Zählt, wie viele fremde Leitungen eine Route kreuzt.
 *
 * Gezählt werden *fremde Segmente*, nicht Segment-Paare: Läuft eine Kante
 * durch die Ecke unserer Route, ist das eine Kreuzung — nicht zwei, nur weil
 * dort zwei eigene Segmente aneinanderstoßen.
 */
export function countCrossings(waypoints: Point[], others: Segment[]): number {
  if (others.length === 0 || waypoints.length < 2) return 0;
  const own = waypointsToSegments(dedupe(waypoints)).filter(([a, b]) => a.x !== b.x || a.y !== b.y);
  let count = 0;
  for (const other of others) {
    if (own.some((segment) => segmentsIntersect(segment, other))) count++;
  }
  return count;
}

export type OrthogonalPathInput = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  offset?: number;
  obstacles?: Rect[];
  borderRadius?: number;
  /** Grob genäherte Verläufe anderer Leitungen für die Kreuzungszählung. */
  crossingSegments?: Segment[];
};

export type OrthogonalPathResult = {
  path: string;
  labelX: number;
  labelY: number;
  offsetX: number;
  offsetY: number;
  /** Kreuzungen der gewählten Route (0, wenn keine Fremdsegmente übergeben wurden). */
  crossings: number;
};

/**
 * Baut den vollständigen, hindernisfreien, abgerundeten Pfad.
 *
 * Sind Fremdsegmente bekannt und kreuzt die Standardroute mehr als
 * MAX_ACCEPTABLE_CROSSINGS davon, werden Varianten mit größerem
 * Lane-Abstand (±32 px, ±64 px) geprüft und die kreuzungsärmste gewählt.
 * Bei Gleichstand gewinnt die Route, die am nächsten an der Standard-Lane liegt —
 * so bleibt das Bild ruhig, wenn ohnehin nichts zu gewinnen ist.
 */
export type OrthogonalWaypointResult = {
  /** Wegpunkte der gewählten Route, Duplikate entfernt. */
  waypoints: Point[];
  /** Kreuzungen der gewählten Route mit fremden Leitungen. */
  crossings: number;
  /** Tatsächlich verwendeter Lane-Offset (kann von `input.offset` abweichen). */
  offset: number;
};

/**
 * Wählt die Route und liefert die reinen Wegpunkte.
 *
 * Ausgelagert aus `buildOrthogonalPath`, damit die Routing-Invarianten
 * (Orthogonalität, Hindernisfreiheit, Pfadlänge, Determinismus) direkt auf
 * der Geometrie geprüft werden können und nicht über das Parsen eines
 * SVG-Strings. `buildOrthogonalPath` ist seitdem nur noch die Formatierung.
 *
 * Rein: die Eingabe wird nicht verändert.
 */
export function orthogonalWaypoints(input: OrthogonalPathInput): OrthogonalWaypointResult {
  const baseOffset = input.offset ?? 0;
  const obstacles = input.obstacles ?? [];
  const crossingSegments = input.crossingSegments ?? [];

  const route = (offset: number): Point[] =>
    dedupe(avoidObstacles(routeWaypoints({ ...input, offset }), obstacles));

  let best = route(baseOffset);
  let bestCrossings = countCrossings(best, crossingSegments);
  let bestOffset = baseOffset;

  if (crossingSegments.length > 0 && bestCrossings > MAX_ACCEPTABLE_CROSSINGS) {
    const candidateOffsets = [
      baseOffset + ALTERNATIVE_ROUTE_GAP,
      baseOffset - ALTERNATIVE_ROUTE_GAP,
      baseOffset + ALTERNATIVE_ROUTE_GAP * 2,
      baseOffset - ALTERNATIVE_ROUTE_GAP * 2,
    ];
    for (const offset of candidateOffsets) {
      const candidate = route(offset);
      const crossings = countCrossings(candidate, crossingSegments);
      if (crossings < bestCrossings) {
        best = candidate;
        bestCrossings = crossings;
        bestOffset = offset;
        if (bestCrossings <= MAX_ACCEPTABLE_CROSSINGS) break;
      }
    }
  }

  return { waypoints: best, crossings: bestCrossings, offset: bestOffset };
}

export function buildOrthogonalPath(input: OrthogonalPathInput): OrthogonalPathResult {
  const radius = input.borderRadius ?? ROUTE_BORDER_RADIUS;
  const { waypoints, crossings } = orthogonalWaypoints(input);

  const path = waypointsToPath(waypoints, radius);
  const midpoint = polylineMidpoint(waypoints);
  return {
    path,
    labelX: midpoint.x,
    labelY: midpoint.y,
    offsetX: 0,
    offsetY: 0,
    crossings,
  };
}

/** Erstellt Sperr-Rechtecke aus Nodes (ohne Source/Target). */
export function nodesToObstacles(nodes: Node[], excludeIds: Set<string>): Rect[] {
  const rects: Rect[] = [];
  for (const node of nodes) {
    if (!node || excludeIds.has(node.id)) continue;
    const width = node.width || NODE_FALLBACK_WIDTH;
    const height = node.height || NODE_FALLBACK_HEIGHT;
    rects.push({
      // positionAbsolute statt position: React Flow liefert für Kindknoten
      // einer Gruppe (parentId) die Position relativ zum Parent; geroutet
      // wird im Canvas-Koordinatensystem. Aktuell vergibt die App keine
      // parentId — der Fix ist defensiv für zukünftige Gruppen.
      x: node.positionAbsolute?.x ?? node.position.x,
      y: node.positionAbsolute?.y ?? node.position.y,
      width,
      height,
    });
  }
  return rects;
}

export type CrossingEdgeRef = { id: string; source: string; target: string };

/**
 * Näherung der übrigen Leitungsverläufe als Mittelpunkt-zu-Mittelpunkt-Strecken.
 *
 * Warum genähert? Die exakten Handle-Koordinaten fremder Kanten kennt eine
 * einzelne Kante nicht (React Flow reicht sie nur an die jeweils eigene Kante
 * durch). Für die Frage „liegt hier ein Kabelknäuel?“ genügt die Näherung —
 * sie ist O(E), deterministisch und rein.
 */
export function edgesToCrossingSegments(
  edges: CrossingEdgeRef[],
  nodes: Node[],
  skip: (edge: CrossingEdgeRef) => boolean
): Segment[] {
  const centers = new Map<string, Point>();
  for (const node of nodes) {
    if (!node) continue;
    centers.set(node.id, {
      x: node.position.x + (node.width || NODE_FALLBACK_WIDTH) / 2,
      y: node.position.y + (node.height || NODE_FALLBACK_HEIGHT) / 2,
    });
  }

  const segments: Segment[] = [];
  for (const edge of edges) {
    if (skip(edge)) continue;
    const a = centers.get(edge.source);
    const b = centers.get(edge.target);
    if (!a || !b) continue;
    segments.push([a, b]);
  }
  return segments;
}
