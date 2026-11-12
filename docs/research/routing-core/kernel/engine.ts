/**
 * CAMP Global Routing Engine — Kern (Phase 2).
 *
 * Ablauf (§5 der Spezifikation):
 *
 *   1. Ports auflösen, Lanes deterministisch vergeben, Stubs reservieren
 *   2. Gitter bauen, Hindernis-Index bauen
 *   3. Startlösung: Kanten in ID-Reihenfolge, je Kante A* (Stufe 0: Katalog
 *      für gerade Lagen, sonst Gittersuche)
 *   4. Verhandlung (Negotiated Congestion): Rip-up aller Kanten, Neuverlegung
 *      mit Überlastpreisen + History, bis keine Gitterkante doppelt belegt ist
 *   5. Kreuzungs-Refinement: Kanten mit den meisten Kreuzungen zuerst neu
 *      verlegen, Kreuzungen bepreist
 *   6. Geometrische Nachbearbeitung (Kollinear-Merge, Dogleg-Kürzung,
 *      Bend-Merge) — nur akzeptierend
 *   7. Ausgabe in sortierter ID-Reihenfolge (Determinismus, I9)
 *
 * Der Kern ist frei von React, Store und Bestandsrouting. Er benutzt nur
 * Tokens, Geometrie und (in `validate.ts`) die eingefrorene Prüfinstanz.
 */

import {
  countBends,
  isOrthogonalPath,
  mergeCloseBends,
  pathLength,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
} from '../../../../lib/routing/geometry';
import { compareIds } from '../../../../lib/sortOrder';
import { gridAStar } from './astar';
import {
  applyClearance,
  applyRoute,
  buildGrid,
  stubBlocks,
  fanoutPath,
  handleKey,
  ObstacleIndex,
  Occupancy,
  sideDir,
  type Grid,
  type StubReservation,
} from './grid';
import type {
  CoreEdge,
  CoreHandle,
  CoreInput,
  CoreMetrics,
  CoreResult,
  CoreRoute,
  CoreUnroutable,
} from './model';
import { CORE_TOKENS } from './tokens';

const EPS = 1e-6;

type ResolvedEnd = {
  readonly handle: CoreHandle;
  readonly nodeId: string;
  /** Orthogonaler Portstub vom Handle zum festen Stub-Ende. */
  readonly fanout: readonly Point[];
  /** Stub-Ende = letzter Punkt des Portstubs = Start/Ziel der Gittersuche. */
  readonly stub: Point;
  /** Currently fixed at zero; lane planning is not active in this kernel. */
  readonly lane: number;
  readonly handleKey: string;
};

type ResolvedEdge = {
  readonly edge: CoreEdge;
  readonly source: ResolvedEnd;
  readonly target: ResolvedEnd;
  readonly ownNodeIds: ReadonlySet<string>;
  readonly ownHandleKeys: ReadonlySet<string>;
};

/** Kantenkosten wie im Bestandsrouter: Länge + 80·Knick + 120·Kreuzung. */
const routeCost = (waypoints: readonly Point[], crossings: number): number =>
  pathLength(waypoints) + CORE_TOKENS.bendCost * countBends(waypoints) + CORE_TOKENS.crossingCost * crossings;

/** Baut die Geometrie einer Route: Handle → Stub → Gitterpfad → Stub → Handle. */
function assemble(source: ResolvedEnd, target: ResolvedEnd, gridPath: readonly Point[]): Point[] {
  const points: Point[] = source.fanout.map((p) => ({ x: p.x, y: p.y }));
  for (const point of gridPath) {
    const last = points[points.length - 1] as Point;
    if (Math.abs(last.x - point.x) > EPS || Math.abs(last.y - point.y) > EPS)
      points.push({ x: point.x, y: point.y });
  }
  // Zielstub rückwärts: Stub-Ende → Handle.
  for (let i = target.fanout.length - 1; i >= 0; i -= 1) {
    const point = target.fanout[i] as Point;
    const last = points[points.length - 1] as Point;
    if (Math.abs(last.x - point.x) > EPS || Math.abs(last.y - point.y) > EPS) {
      points.push({ x: point.x, y: point.y });
    }
  }
  return simplifyWaypoints(points);
}

/**
 * Dogleg-Kürzung: ein mittleres Segment kürzer als `segmentMin` wird
 * entfernt, indem die beiden Nachbarn auf die Achse des kürzeren Segments
 * gezogen werden. Nur akzeptierend: bei nicht-orthogonalem Ergebnis verworfen.
 */
function dropShortDoglegs(waypoints: readonly Point[]): Point[] {
  if (waypoints.length < 4) return [...waypoints];
  const out = waypoints.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 1; i + 1 < out.length; i += 1) {
    const a = out[i - 1] as Point;
    const b = out[i] as Point;
    const c = out[i + 1] as Point;
    const vertical = Math.abs(b.x - c.x) < EPS;
    const short = Math.abs(vertical ? c.y - b.y : c.x - b.x);
    if (short >= CORE_TOKENS.segmentMin - EPS) continue;
    // `d` darf kein Endpunkt sein: die Kandidatenkonstruktion zieht `d` auf die
    // Achse von b→c — am Handle würde das den Anschluss verschieben und die
    // Route endete nicht mehr am Port. Dann erkennt die Prüfinstanz den
    // geteilten Port nicht (`sharesPort` vergleicht Endpunkte) und die
    // Port-Bündel-Freigabe (ADR 0009/0031) greift nicht — I3-Vorstöße, die
    // keine sind. Kurze Segmente direkt am Handle bleiben stehen.
    if (i + 2 >= out.length - 1) continue;
    const d = out[i + 2] as Point;
    if (vertical) {
      // b→c ist senkrecht: a und d auf die x-Achse von b ziehen, b/c entfernen.
      const candidate: Point[] = [
        ...out.slice(0, i).map((p) => ({ ...p })),
        { x: b.x, y: a.y },
        { x: b.x, y: d.y },
        ...out.slice(i + 3).map((p) => ({ ...p })),
      ];
      const merged = simplifyWaypoints(candidate);
      if (isOrthogonalPath(merged)) return merged;
    } else {
      const candidate: Point[] = [
        ...out.slice(0, i).map((p) => ({ ...p })),
        { x: a.x, y: b.y },
        { x: d.x, y: b.y },
        ...out.slice(i + 3).map((p) => ({ ...p })),
      ];
      const merged = simplifyWaypoints(candidate);
      if (isOrthogonalPath(merged)) return merged;
    }
  }
  return out;
}

/**
 * Belegungsanteil einer Route: **ohne** die gemeinsamen Fächer an den beiden
 * Anschlüssen.
 *
 * Zwei Kanten an demselben Anschluss teilen sich den senkrechten Stub
 * (Port-Bündel, ADR 0009/0031). Zählte die Verhandlung diese gemeinsame
 * Strecke als Belegung, wäre jede Busbar mit k Kanten per Konstruktion
 * überlastet (`usage = k`) — die Verhandlung hätte dann keine gültige Lösung
 * mehr, und genau das ist auf `simple`, `camper` und `complex` passiert.
 * Getrennt werden die Trassen erst am Lane-Punkt; ab dort zählt die Belegung.
 */
/** Route vollständig buchen: Überdeckung (`applyRoute`) + Klarheit (`applyClearance`). */
function book(
  occupancy: Occupancy,
  grid: Grid,
  entry: ResolvedEdge,
  waypoints: readonly Point[],
  delta: 1 | -1
): void {
  const portion = occupancyPortion(entry, waypoints, entry.source, entry.target);
  applyRoute(occupancy, grid, portion, delta, [entry.source.handleKey, entry.target.handleKey]);
  // Klarheit getrennt buchen: die Fächer gehören der **Anschluss-Gruppe**
  // (`port:<handleKey>`), nicht der einzelnen Kante. Kanten am selben Anschluss
  // teilen sich den Fächer; sie dürfen sich dort nicht aussperren. Fremde
  // Anschlüsse bleiben gesperrt.
  applyClearance(occupancy, grid, entry.source.fanout, `port:${entry.source.handleKey}`, delta);
  applyClearance(occupancy, grid, entry.target.fanout, `port:${entry.target.handleKey}`, delta);
  const middle = waypoints.slice(
    entry.source.fanout.length - 1,
    waypoints.length - (entry.target.fanout.length - 1)
  );
  applyClearance(occupancy, grid, middle, entry.edge.id, delta);
}

function occupancyPortion(
  entry: ResolvedEdge,
  waypoints: readonly Point[],
  sourceEnd: ResolvedEnd,
  targetEnd: ResolvedEnd
): Point[] {
  // Der **ganze** Fächer bleibt aus der Überdeckungszählung heraus: er ist die
  // modellierte Bündelung am Anschluss (Kapazität = Zahl der Kanten am
  // Anschluss). Er wird stattdessen über das Klarheitsfeld geschützt, dessen
  // Eigentümer die Anschluss-Gruppe ist.
  const from = Math.max(0, sourceEnd.fanout.length - 1);
  const to = waypoints.length - Math.max(0, targetEnd.fanout.length - 1);
  if (to <= from) return [...waypoints];
  return waypoints.slice(from, to).map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Überdeckt sich der Pfad **selbst** kollinear (nicht benachbarte Segmente auf
 * derselben Achse mit echtem Überlapp)?
 *
 * Nur ein Akzeptanzfilter der kosmetischen Nachbearbeitung, **keine**
 * Freigabeprüfung — die macht das unabhängige Gate. Er existiert, weil
 * `dropShortDoglegs` auf `simple` einen Pfad erzeugte, der 50 px zurücklief und
 * sich dabei selbst überlappte (I2), während Hindernisse und Belegung frei
 * blieben.
 */
function hasSelfOverlap(points: readonly Point[]): boolean {
  const segments = waypointsToSegments([...points]);
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i] as [Point, Point];
      const b = segments[j] as [Point, Point];
      const aHorizontal = Math.abs(a[0].y - a[1].y) < EPS;
      const bHorizontal = Math.abs(b[0].y - b[1].y) < EPS;
      if (aHorizontal !== bHorizontal) continue;
      const lineA = aHorizontal ? a[0].y : a[0].x;
      const lineB = bHorizontal ? b[0].y : b[0].x;
      if (Math.abs(lineA - lineB) > EPS) continue;
      const lo = Math.max(
        Math.min(aHorizontal ? a[0].x : a[0].y, aHorizontal ? a[1].x : a[1].y),
        Math.min(bHorizontal ? b[0].x : b[0].y, bHorizontal ? b[1].x : b[1].y)
      );
      const hi = Math.min(
        Math.max(aHorizontal ? a[0].x : a[0].y, aHorizontal ? a[1].x : a[1].y),
        Math.max(bHorizontal ? b[0].x : b[0].y, bHorizontal ? b[1].x : b[1].y)
      );
      if (hi - lo > EPS) return true;
    }
  }
  return false;
}

export function routeCore(input: CoreInput): CoreResult {
  const started = Date.now();
  const nodes = [...input.nodes].sort((a, b) => compareIds(a.id, b.id));
  const edges = [...input.edges].sort((a, b) => compareIds(a.id, b.id));
  const handleLookup = new Map<string, CoreHandle>();
  for (const node of nodes) {
    for (const handle of node.handles) handleLookup.set(handleKey(node.id, handle.id), handle);
  }
  const handleOf = (nodeId: string, handleId: string): CoreHandle | undefined =>
    handleLookup.get(handleKey(nodeId, handleId));

  const unroutable: CoreUnroutable[] = [];
  const resolved: ResolvedEdge[] = [];
  const obstacles = new ObstacleIndex(nodes);

  for (const edge of edges) {
    const sourceHandle = handleOf(edge.source, edge.sourceHandle);
    const targetHandle = handleOf(edge.target, edge.targetHandle);
    if (!sourceHandle) {
      unroutable.push({ id: edge.id, reason: `Quell-Anschluss ${edge.source}/${edge.sourceHandle} fehlt` });
      continue;
    }
    if (!targetHandle) {
      unroutable.push({ id: edge.id, reason: `Ziel-Anschluss ${edge.target}/${edge.targetHandle} fehlt` });
      continue;
    }
    // Kein vorab vergebener Lane-Versatz: mit dem globalen Kanalraster trennt
    // die Suche selbst. Ein fest verdrahteter Versatz tat so, als wüsste er die
    // Trasse schon vor der Suche, und erzeugte dabei Querstücke, die sich
    // gegenseitig blockierten.
    const sourceFanout = fanoutPath(sourceHandle);
    const targetFanout = fanoutPath(targetHandle);
    resolved.push({
      edge,
      source: {
        handle: sourceHandle,
        nodeId: edge.source,
        fanout: sourceFanout,
        stub: sourceFanout[sourceFanout.length - 1] as Point,
        lane: 0,
        handleKey: handleKey(edge.source, edge.sourceHandle),
      },
      target: {
        handle: targetHandle,
        nodeId: edge.target,
        fanout: targetFanout,
        stub: targetFanout[targetFanout.length - 1] as Point,
        lane: 0,
        handleKey: handleKey(edge.target, edge.targetHandle),
      },
      ownNodeIds: new Set([edge.source, edge.target]),
      ownHandleKeys: new Set([
        handleKey(edge.source, edge.sourceHandle),
        handleKey(edge.target, edge.targetHandle),
      ]),
    });
  }

  const grid: Grid = buildGrid(
    nodes,
    resolved.map((entry) => ({ source: entry.source.stub, target: entry.target.stub }))
  );
  const reservations: StubReservation[] = [];
  for (const entry of resolved) {
    reservations.push({ handleKey: entry.source.handleKey, path: entry.source.fanout });
    reservations.push({ handleKey: entry.target.handleKey, path: entry.target.fanout });
  }

  const occupancy = new Occupancy();
  const locked = new Map<string, Point[]>();
  for (const entry of resolved) {
    if (entry.edge.locked && entry.edge.lockedWaypoints && entry.edge.lockedWaypoints.length >= 2) {
      const lockedWaypoints = entry.edge.lockedWaypoints.map((p) => ({ x: p.x, y: p.y }));
      locked.set(entry.edge.id, lockedWaypoints);
      applyRoute(occupancy, grid, lockedWaypoints, 1, [entry.source.handleKey, entry.target.handleKey]);
    }
  }

  const solveOne = (entry: ResolvedEdge): Point[] | null => {
    let fallback: Point[] | null = null;
    const portKeys = new Set([entry.source.handleKey, entry.target.handleKey]);
    // Freigabe-Leiter: volle Clearance zuerst, dann engere Stufen. Die erste
    // Stufe, die einen Pfad liefert, gewinnt — I1 (Rohbox) bleibt in jeder
    // Stufe garantiert, nur I3 (12 px) wird auf den engen Stufen weich.
    for (const margin of CORE_TOKENS.marginLadder) {
      for (const clearanceMode of CORE_TOKENS.clearanceModes) {
        const request = {
          grid,
          obstacles,
          occupancy,
          reservations,
          start: entry.source.stub,
          goal: entry.target.stub,
          // Der Fächer wird am Port durchlaufen (Handle → Stub → Lane-Punkt);
          // die Gittersuche beginnt und endet deshalb **senkrecht** zum Port:
          // startend vom Bauteil weg, am Ziel auf das Bauteil zu. Die frühere
          // Variante startete in Richtung des Lane-Versatzes und lief damit über
          // die eigene Fächerstrecke zurück (Selbstüberdeckung, I2).
          startDir: sideDir(entry.source.handle.side),
          goalDir: ((sideDir(entry.target.handle.side) + 2) % 4) as 0 | 1 | 2 | 3,
          ownNodeIds: entry.ownNodeIds,
          ownHandleKeys: entry.ownHandleKeys,
          margin,
          clearanceMode,
          owners: new Set([
            entry.edge.id,
            `port:${entry.source.handleKey}`,
            `port:${entry.target.handleKey}`,
          ]),
          portKeys,
        } as const;
        const result = gridAStar(request);
        if (!result) continue;
        const candidate = assemble(entry.source, entry.target, result.waypoints);
        fallback ??= candidate;
        const usesSharedPortEdge = result.waypoints.some((point, index) => {
          if (index + 1 >= result.waypoints.length) return false;
          const next = result.waypoints[index + 1] as Point;
          return occupancy.overlapsPort(point.x, point.y, next.x, next.y, portKeys);
        });
        if (!usesSharedPortEdge) return candidate;

        // Der normale A* findet zunächst den günstigsten Pfad für diese
        // Freigabestufe. Falls er dafür einen bereits belegten Schritt mit
        // einer gemeinsamen Port-Gruppe teilt, machen wir eine lokale
        // Alternativsuche ohne genau diese I2-Konfliktklasse. Das ist ein
        // Rip-up-Ausweichversuch, keine vorab vergebene Lane: wenn kein
        // Alternativpfad existiert, bleibt der normale Kandidat erhalten.
        const separated = gridAStar({ ...request, forbidPortOverlap: true });
        if (separated) return assemble(entry.source, entry.target, separated.waypoints);
      }
    }
    return fallback;
  };

  // --- Verhandlung -------------------------------------------------------
  //
  // Die Verhandlung darf **nur** gültige Lösungen freigeben. Eine Lösung ist
  // gültig, wenn jede Kanten auf einer Route liegt *und* keine Gitterkante
  // doppelt belegt ist (`maxUsage <= 1`, Regel L). Die frühere Fassung hat
  // beim Erreichen von `maxNegotiationIterations` die letzte — überlastete —
  // Lösung übernommen. Das ist ein stiller Verstoß gegen I2 und war der
  // Grund, warum der Kern auf den Referenzplänen gültig *aussah*.
  let bestSolution: Map<string, Point[]> | null = null;
  let iterations = 0;
  let lastMaxUsage = 0;
  let stagnantIterations = 0;
  let stagnated = false;
  let bestConflictScore:
    { complete: boolean; maxUsage: number; overloadCount: number; excess: number } | undefined;
  const failureReason = new Map<string, string>();

  const routable = resolved.filter((entry) => !locked.has(entry.edge.id));

  for (let iteration = 0; iteration <= CORE_TOKENS.maxNegotiationIterations; iteration += 1) {
    iterations = iteration;
    // Rip-up: nur die gesperrten Routen bleiben stehen.
    occupancy.clear();
    occupancy.clearProximity();
    for (const [id, waypoints] of locked) {
      const entry = resolved.find((candidate) => candidate.edge.id === id);
      applyRoute(
        occupancy,
        grid,
        waypoints,
        1,
        entry ? [entry.source.handleKey, entry.target.handleKey] : undefined
      );
    }
    const solution = new Map<string, Point[]>(locked);
    for (const entry of routable) {
      const waypoints = solveOne(entry);
      if (!waypoints) {
        failureReason.set(
          entry.edge.id,
          `keine kollisionsfreie Route im Gitter (${grid.xs.length}×${grid.ys.length})`
        );
        continue;
      }
      failureReason.delete(entry.edge.id);
      solution.set(entry.edge.id, waypoints);
      book(occupancy, grid, entry, waypoints, 1);
    }
    const maxUsage = occupancy.maxUsage();
    lastMaxUsage = maxUsage;
    const complete = routable.every((entry) => solution.has(entry.edge.id));
    const overloads = occupancy.overloaded();
    const conflictScore = {
      complete,
      maxUsage,
      overloadCount: overloads.length,
      excess: overloads.reduce((sum, overload) => sum + overload.count - 1, 0),
    };
    const improves =
      bestConflictScore === undefined ||
      Number(conflictScore.complete) > Number(bestConflictScore.complete) ||
      (conflictScore.complete === bestConflictScore.complete &&
        (conflictScore.maxUsage < bestConflictScore.maxUsage ||
          (conflictScore.maxUsage === bestConflictScore.maxUsage &&
            (conflictScore.overloadCount < bestConflictScore.overloadCount ||
              (conflictScore.overloadCount === bestConflictScore.overloadCount &&
                conflictScore.excess < bestConflictScore.excess)))));
    if (improves) {
      bestConflictScore = conflictScore;
      stagnantIterations = 0;
    } else {
      stagnantIterations += 1;
    }
    if (complete && maxUsage <= 1) {
      bestSolution = solution;
      break;
    }
    if (iteration === CORE_TOKENS.maxNegotiationIterations) break;
    if (stagnantIterations >= CORE_TOKENS.maxStagnantNegotiationIterations) {
      stagnated = true;
      break;
    }
    for (const overload of overloads) {
      occupancy.raiseHistory(
        overload.a.x,
        overload.a.y,
        overload.b.x,
        overload.b.y,
        CORE_TOKENS.historyIncrement
      );
    }
  }

  if (!bestSolution) {
    // Gemeldet wird, was **wirklich** schiefging: die Kante ohne Route nennt
    // ihren Grund, alle anderen nennen den Abbruch. Die frühere Fassung schrieb
    // allen Kanten denselben Text („Gitterkante 1× belegt") — auch denen, die
    // problemlos geroutet hatten, und mit einer Zahl, die Konvergenz bedeutet.
    for (const entry of routable) {
      const known = failureReason.get(entry.edge.id);
      unroutable.push({
        id: entry.edge.id,
        reason:
          known ??
          (stagnated
            ? `Verhandlung vorzeitig abgebrochen: keine Verbesserung nach ${iterations + 1} Iterationen (Gitterkante ${lastMaxUsage}× belegt)`
            : lastMaxUsage > 1
              ? `Verhandlung nicht konvergiert: Gitterkante ${lastMaxUsage}× belegt nach ${iterations} Iterationen`
              : `Verhandlung abgebrochen: andere Kante ohne Route, Überdeckung bereits 0 (${iterations} Iterationen)`),
      });
    }
    const metrics: CoreMetrics = {
      iterations,
      maxCongestion: lastMaxUsage,
      totalHistoryCost: occupancy.totalHistory(),
      crossingPasses: 0,
      totalLength: 0,
      totalBends: 0,
      totalCrossings: 0,
      gridNodes: grid.xs.length * grid.ys.length,
      durationMs: Date.now() - started,
    };
    return { routes: new Map(), unroutable, metrics };
  }

  const solution = bestSolution;

  // --- Kreuzungs-Refinement ---------------------------------------------
  // Solange die Belegung zulässig ist, werden Kanten mit den meisten
  // Kreuzungen zuerst neu verlegt; Kreuzungen sind im A* bepreist.
  const countCrossings = (id: string): number => {
    const mine = solution.get(id) as Point[];
    let count = 0;
    for (const [otherId, other] of solution) {
      if (otherId === id) continue;
      count += crossingPairs(mine, other);
    }
    return count;
  };

  let crossingPasses = 0;
  for (let pass = 0; pass < CORE_TOKENS.maxCrossingPasses; pass += 1) {
    crossingPasses = pass + 1;
    const order = [...solution.keys()]
      .filter((id) => !locked.has(id))
      .map((id) => ({ id, crossings: countCrossings(id), cost: routeCost(solution.get(id) as Point[], 0) }))
      .sort((a, b) => b.crossings - a.crossings || b.cost - a.cost || compareIds(a.id, b.id));
    if (order.length > 0 && (order[0] as { crossings: number }).crossings === 0) break;
    let improved = false;
    for (const item of order) {
      const entry = routable.find((candidate) => candidate.edge.id === item.id);
      if (!entry) continue;
      const current = solution.get(item.id) as Point[];
      const currentCost = routeCost(current, countCrossings(item.id));
      // Belegung immer über denselben Ausschnitt buchen wie in der
      // Verhandlung (`occupancyPortion`). Die frühere Fassung zog die volle
      // Route ab und addierte die volle Route — die Zähler liefen dadurch
      // auseinander, `maxUsage` wurde unbrauchbar und die Konfliktprüfung
      // dieses Schritts war wirkungslos.
      book(occupancy, grid, entry, current, -1);
      const candidate = solveOne(entry);
      if (!candidate) {
        book(occupancy, grid, entry, current, 1);
        continue;
      }
      book(occupancy, grid, entry, candidate, 1);
      if (occupancy.maxUsage() > 1) {
        book(occupancy, grid, entry, candidate, -1);
        book(occupancy, grid, entry, current, 1);
        continue;
      }
      const candidateCost = routeCost(candidate, countCrossings(item.id));
      if (candidateCost < currentCost - EPS) {
        solution.set(item.id, candidate);
        improved = true;
      } else {
        book(occupancy, grid, entry, candidate, -1);
        book(occupancy, grid, entry, current, 1);
      }
    }
    if (!improved) break;
  }

  // --- Geometrische Nachbearbeitung --------------------------------------
  //
  // Verschönerung ist nur erlaubt, wenn sie nichts kaputt macht. Die frühere
  // Fassung formte unabängig von der Belegung um; auf `simple` erzeugte das
  // zwei Bauteildurchdringungen (I1) an Stellen, die die Suche gerade
  // freigehalten hatte. Geprüft wird gegen dieselben Bedingungen wie in der
  // Suche: Hindernisse mit voller Clearance und Gitterbelegung ≤ 1.
  for (const [id, waypoints] of solution) {
    if (locked.has(id)) continue;
    const entry = resolved.find((candidate) => candidate.edge.id === id);
    if (!entry) continue;
    const refinedRaw = simplifyWaypoints(
      mergeCloseBends(dropShortDoglegs(waypoints), 2 * CORE_TOKENS.bendRadius)
    );
    if (!isOrthogonalPath(refinedRaw) || refinedRaw.length < 4) continue;
    // Eine „Verschönerung", die länger macht, ist keine.
    if (pathLength(refinedRaw) > pathLength(waypoints) + EPS) continue;
    if (hasSelfOverlap(refinedRaw)) continue;
    const hitsObstacle = waypointsToSegments(refinedRaw).some((segment) =>
      obstacles.blocked(segment, entry.ownNodeIds, CORE_TOKENS.clearance)
    );
    if (hitsObstacle) continue;
    book(occupancy, grid, entry, waypoints, -1);
    book(occupancy, grid, entry, refinedRaw, 1);
    if (occupancy.maxUsage() > 1) {
      book(occupancy, grid, entry, refinedRaw, -1);
      book(occupancy, grid, entry, waypoints, 1);
      continue;
    }
    solution.set(id, refinedRaw);
  }

  // --- Ausgabe ------------------------------------------------------------
  const routes = new Map<string, CoreRoute>();
  let totalLength = 0;
  let totalBends = 0;
  let totalCrossings = 0;
  for (const id of [...solution.keys()].sort(compareIds)) {
    const waypoints = solution.get(id) as Point[];
    const crossings = countCrossings(id);
    const length = pathLength(waypoints);
    const bends = countBends(waypoints);
    totalLength += length;
    totalBends += bends;
    totalCrossings += crossings;
    routes.set(id, {
      id,
      waypoints: waypoints.map((p) => ({ x: p.x, y: p.y })),
      length,
      bends,
      crossings,
      lane: resolved.find((entry) => entry.edge.id === id)?.source.lane ?? 0,
      kind: locked.has(id) ? 'locked' : 'grid',
    });
  }

  const metrics: CoreMetrics = {
    iterations,
    maxCongestion: occupancy.maxUsage(),
    totalHistoryCost: occupancy.totalHistory(),
    crossingPasses,
    totalLength,
    totalBends,
    totalCrossings,
    gridNodes: grid.xs.length * grid.ys.length,
    durationMs: Date.now() - started,
  };
  return { routes, unroutable, metrics };
}

/** Zahl der echten Kreuzungen zwischen zwei orthogonalen Polylinien. */
export function crossingPairs(a: readonly Point[], b: readonly Point[]): number {
  let count = 0;
  for (let i = 0; i + 1 < a.length; i += 1) {
    const p1 = a[i] as Point;
    const p2 = a[i + 1] as Point;
    for (let j = 0; j + 1 < b.length; j += 1) {
      const q1 = b[j] as Point;
      const q2 = b[j + 1] as Point;
      const aVert = Math.abs(p1.x - p2.x) < EPS;
      const bVert = Math.abs(q1.x - q2.x) < EPS;
      if (aVert === bVert) continue; // parallel: keine Kreuzung
      const v1 = aVert ? p1 : q1;
      const v2 = aVert ? p2 : q2;
      const h1 = aVert ? q1 : p1;
      const h2 = aVert ? q2 : p2;
      const vx = v1.x;
      const vy = h1.y;
      const vLo = Math.min(v1.y, v2.y);
      const vHi = Math.max(v1.y, v2.y);
      const hLo = Math.min(h1.x, h2.x);
      const hHi = Math.max(h1.x, h2.x);
      if (vx > hLo + EPS && vx < hHi - EPS && vy > vLo + EPS && vy < vHi - EPS) count += 1;
    }
  }
  return count;
}
