import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Position } from 'reactflow';
import {
  buildOrthogonalPath,
  orthogonalWaypoints,
  segmentCrossesRect,
  waypointsToSegments,
  OBSTACLE_MARGIN,
  type OrthogonalPathInput,
  type Point,
  type Rect,
} from './orthogonalRouting';
import {
  BEND_COST,
  findCablePath,
  isOrthogonalPath,
  remainingCostLowerBound,
  U_TURN_COST,
} from './pathfinding';
import { ROUTING_SCENARIOS, manhattanDistance } from './routingScenarios';

/**
 * Routing-Invarianten (AGENTS.md K3).
 *
 * `buildOrthogonalPath` ist eine deterministische, reine Funktion. Diese
 * Datei hält fest, was das konkret bedeutet, und prüft es sowohl gegen die
 * 25 festen Szenarien aus `routingScenarios.ts` als auch gegen zufällige
 * Eingaben (fast-check, 1.000 Läufe, fester Seed).
 *
 * Die Invarianten
 * ===============
 *  R1  Exakte Endpunkte: ohne Lane-Offset beginnt der Pfad exakt am
 *      Quellpunkt und endet exakt am Zielpunkt. Mit Offset o sind Start und
 *      Ende genau um o senkrecht zur Austritts-/Eintrittsrichtung verschoben.
 *  R2  Orthogonalität: jedes Segment ist achsenparallel.
 *  R3  Hindernisfreiheit: kein Segment schneidet eine Hindernis-Box —
 *      außer bei begründeten Ausnahmen (Quelle/Ziel liegt in der Box).
 *  R4  Begrenzte Länge: Pfadlänge ≤ maxDetourRatio × Manhattan-Distanz.
 *  R5  Determinismus: gleiche Eingabe ⇒ exakt gleiche Ausgabe.
 *  R6  Reinheit: die Eingabe wird nicht verändert (mit Object.freeze geprüft).
 *  R7  Terminierung: auch die Stressszene liefert in endlicher Zeit ein
 *      Ergebnis mit begrenzter Wegpunktzahl.
 */

const SEED = 20260821;
const propertyConfig = { numRuns: 1_000, seed: SEED, verbose: false } as const;

const EPSILON = 1e-9;

/** Länge einer Polylinie. */
function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);
  }
  return total;
}

/** Richtungsvektor beim Verlassen der Quelle (Spiegel der Produktionslogik). */

/** Tiefes Einfrieren, um Reinheit (R6) beweisbar zu machen. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Szenario-basierte Invarianten
// ---------------------------------------------------------------------------

describe('R1–R4 — Invarianten über alle 25 Szenarien', () => {
  it('die Galerie enthält mindestens 20 reproduzierbare Szenarien mit eindeutiger ID', () => {
    expect(ROUTING_SCENARIOS.length).toBeGreaterThanOrEqual(20);
    const ids = ROUTING_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scenario of ROUTING_SCENARIOS) {
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(scenario.rationale.length).toBeGreaterThan(0);
      if (!scenario.obstacleFree) {
        expect(scenario.exception, `${scenario.id} ohne begründete Ausnahme`).toBeTruthy();
      }
    }
  });

  for (const scenario of ROUTING_SCENARIOS) {
    describe(`${scenario.id} — ${scenario.title}`, () => {
      const input = deepFreeze({ ...scenario.input }) as OrthogonalPathInput;
      const { waypoints } = orthogonalWaypoints(input);

      it('R1: beginnt und endet exakt an den Anschlusspunkten', () => {
        expect(waypoints[0]!.x).toBeCloseTo(input.sourceX, 9);
        expect(waypoints[0]!.y).toBeCloseTo(input.sourceY, 9);
        expect(waypoints[waypoints.length - 1]!.x).toBeCloseTo(input.targetX, 9);
        expect(waypoints[waypoints.length - 1]!.y).toBeCloseTo(input.targetY, 9);
      });

      it('R2: alle Segmente sind achsenparallel', () => {
        for (const [a, b] of waypointsToSegments(waypoints)) {
          const isOrthogonal = Math.abs(a.x - b.x) < EPSILON || Math.abs(a.y - b.y) < EPSILON;
          expect(isOrthogonal, `Diagonale von (${a.x},${a.y}) nach (${b.x},${b.y})`).toBe(true);
        }
      });

      it(
        scenario.obstacleFree
          ? 'R3: kein Segment schneidet ein Hindernis'
          : `R3: begründete Ausnahme — ${scenario.exception}`,
        () => {
          const obstacles: Rect[] = input.obstacles ?? [];
          const crossings = waypointsToSegments(waypoints).filter(([a, b]) =>
            obstacles.some((obstacle) => segmentCrossesRect(a, b, obstacle))
          );

          if (scenario.obstacleFree) {
            expect(crossings).toHaveLength(0);
          } else {
            // Die Ausnahme muss echt sein: Quelle oder Ziel liegt in der Box.
            const inside = (point: Point): boolean =>
              obstacles.some(
                (rect) =>
                  point.x > rect.x &&
                  point.x < rect.x + rect.width &&
                  point.y > rect.y &&
                  point.y < rect.y + rect.height
              );
            expect(
              inside({ x: input.sourceX, y: input.sourceY }) || inside({ x: input.targetX, y: input.targetY })
            ).toBe(true);
          }
        }
      );

      it('R4: die Pfadlänge bleibt im dokumentierten Rahmen', () => {
        const manhattan = manhattanDistance(input);
        const length = polylineLength(waypoints);
        if (manhattan === 0) {
          expect(Number.isFinite(length)).toBe(true);
          return;
        }
        expect(length / manhattan).toBeLessThanOrEqual(scenario.maxDetourRatio);
      });

      it('R5: zwei Aufrufe liefern exakt dasselbe Ergebnis', () => {
        const first = buildOrthogonalPath({ ...scenario.input });
        const second = buildOrthogonalPath({ ...scenario.input });
        expect(second).toEqual(first);
        expect(second.path).toBe(first.path);
      });

      it('R6: die Eingabe bleibt unverändert', () => {
        const snapshot = JSON.stringify(scenario.input);
        buildOrthogonalPath(deepFreeze({ ...scenario.input }) as OrthogonalPathInput);
        expect(JSON.stringify(scenario.input)).toBe(snapshot);
      });

      it('R7: der Pfad besteht aus einer begrenzten Zahl von Wegpunkten', () => {
        const degenerate =
          input.sourceX === input.targetX && input.sourceY === input.targetY && !input.offset;
        // Liegen Quelle und Ziel exakt aufeinander, bleibt nach dem
        // Entfernen von Duplikaten ein einziger Punkt übrig — es gibt keine
        // Leitung zu zeichnen. Dokumentierter Grenzfall, kein Fehler.
        expect(waypoints.length).toBeGreaterThanOrEqual(degenerate ? 1 : 2);
        expect(waypoints.length).toBeLessThanOrEqual(64);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Property-Tests mit zufälliger Geometrie
// ---------------------------------------------------------------------------

const coordinate = fc.integer({ min: -1_200, max: 1_200 });
const position = fc.constantFrom(Position.Left, Position.Right, Position.Top, Position.Bottom);
const lane = fc.constantFrom(-32, -16, 0, 16, 32);

const rect = fc
  .record({
    x: fc.integer({ min: -800, max: 800 }),
    y: fc.integer({ min: -800, max: 800 }),
    width: fc.integer({ min: 40, max: 320 }),
    height: fc.integer({ min: 40, max: 240 }),
  })
  .map((value): Rect => value);

const inputArbitrary = fc.record({
  sourceX: coordinate,
  sourceY: coordinate,
  sourcePosition: position,
  targetX: coordinate,
  targetY: coordinate,
  targetPosition: position,
  offset: lane,
  obstacles: fc.array(rect, { maxLength: 5 }),
});

describe('R2/R5/R6/R7 — Eigenschaften über zufällige Geometrie', () => {
  it('R2: liefert für jede Eingabe ausschließlich achsenparallele Segmente', () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const { waypoints } = orthogonalWaypoints(input);
        for (const [a, b] of waypointsToSegments(waypoints)) {
          expect(Math.abs(a.x - b.x) < EPSILON || Math.abs(a.y - b.y) < EPSILON).toBe(true);
        }
      }),
      propertyConfig
    );
  });

  it('R5: ist deterministisch — auch bei getrennt aufgebauten, gleichen Eingaben', () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const first = buildOrthogonalPath(structuredClone(input));
        const second = buildOrthogonalPath(structuredClone(input));
        expect(second.path).toBe(first.path);
        expect(second.labelX).toBe(first.labelX);
        expect(second.labelY).toBe(first.labelY);
        expect(second.crossings).toBe(first.crossings);
      }),
      propertyConfig
    );
  });

  it('R6: verändert weder Eingabe-Objekt noch Hindernis-Liste', () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const before = JSON.stringify(input);
        buildOrthogonalPath(deepFreeze(structuredClone(input)));
        expect(JSON.stringify(input)).toBe(before);
      }),
      propertyConfig
    );
  });

  it('R7: terminiert immer mit mindestens einem und höchstens 64 Wegpunkten', () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const { waypoints } = orthogonalWaypoints(input);
        expect(waypoints.length).toBeGreaterThanOrEqual(1);
        expect(waypoints.length).toBeLessThanOrEqual(64);
        for (const point of waypoints) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
        }
      }),
      propertyConfig
    );
  });

  it('R1: Start und Ende liegen für jede Eingabe exakt auf den Anschlusspunkten', () => {
    fc.assert(
      fc.property(
        fc.record({
          sourceX: coordinate,
          sourceY: coordinate,
          sourcePosition: position,
          targetX: coordinate,
          targetY: coordinate,
          targetPosition: position,
          offset: lane,
          obstacles: fc.array(rect, { maxLength: 3 }),
        }),
        (input) => {
          const { waypoints } = orthogonalWaypoints(input);
          expect(waypoints[0]).toEqual({ x: input.sourceX, y: input.sourceY });
          expect(waypoints[waypoints.length - 1]).toEqual({
            x: input.targetX,
            y: input.targetY,
          });
        }
      ),
      propertyConfig
    );
  });

  it('R3: ein einzelnes Hindernis abseits der Endpunkte wird umfahren', () => {
    fc.assert(
      fc.property(
        fc.record({
          sourceY: fc.integer({ min: -300, max: 300 }),
          targetY: fc.integer({ min: -300, max: 300 }),
          obstacleY: fc.integer({ min: -200, max: 200 }),
          obstacleWidth: fc.integer({ min: 40, max: 200 }),
          obstacleHeight: fc.integer({ min: 40, max: 200 }),
        }),
        ({ sourceY, targetY, obstacleY, obstacleWidth, obstacleHeight }) => {
          // Hindernis liegt sicher zwischen Quelle (x=0) und Ziel (x=1200),
          // beide Endpunkte liegen garantiert außerhalb der Box.
          const obstacle: Rect = {
            x: 400,
            y: obstacleY,
            width: obstacleWidth,
            height: obstacleHeight,
          };
          const { waypoints } = orthogonalWaypoints({
            sourceX: 0,
            sourceY,
            sourcePosition: Position.Right,
            targetX: 1200,
            targetY,
            targetPosition: Position.Left,
            obstacles: [obstacle],
          });
          for (const [a, b] of waypointsToSegments(waypoints)) {
            expect(segmentCrossesRect(a, b, obstacle)).toBe(false);
          }
        }
      ),
      propertyConfig
    );
  });

  it('der Sicherheitsabstand um Hindernisse ist die dokumentierte Konstante', () => {
    expect(OBSTACLE_MARGIN).toBeGreaterThanOrEqual(12);
    expect(OBSTACLE_MARGIN).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Der erzeugte SVG-Pfad passt zur Geometrie
// ---------------------------------------------------------------------------

describe('SVG-Ausgabe bleibt an die Wegpunkte gebunden', () => {
  it('beginnt mit einem M auf dem ersten Wegpunkt und endet auf dem letzten', () => {
    for (const scenario of ROUTING_SCENARIOS) {
      const { waypoints } = orthogonalWaypoints(scenario.input);
      const { path } = buildOrthogonalPath(scenario.input);
      const round = (value: number): string => (Math.round(value * 100) / 100).toString();

      if (waypoints.length < 2) {
        // Degenerierter Fall (Quelle = Ziel): kein zeichenbarer Pfad.
        expect(path).toBe('');
        continue;
      }

      expect(path.startsWith(`M ${round(waypoints[0]!.x)} ${round(waypoints[0]!.y)}`)).toBe(true);
      const last = waypoints[waypoints.length - 1]!;
      expect(path.endsWith(`L ${round(last.x)} ${round(last.y)}`)).toBe(true);
    }
  });

  it('enthält keine NaN- oder Infinity-Koordinaten', () => {
    for (const scenario of ROUTING_SCENARIOS) {
      const { path } = buildOrthogonalPath(scenario.input);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });
});

// ---------------------------------------------------------------------------
// Kostenmodell (R-2): Gerade < L < Z < Zickzack, Kehre zuletzt
// ---------------------------------------------------------------------------

describe('Kostenmodell (R-2)', () => {
  const cost = (result: { length: number; bends: number }): number =>
    result.length + BEND_COST * result.bends;

  const run = (input: Parameters<typeof findCablePath>[0]) => findCablePath({ skipCache: true, ...input });

  it('Konstanten: Kehre kostet mehr als ein Zickzack-Bogen aus 4 Ecken', () => {
    expect(U_TURN_COST).toBeGreaterThan(4 * BEND_COST);
    // Heuristik-Abschlag für Kehren bleibt zulässig: min(U_TURN_COST, 2·BEND_COST).
    expect(Math.min(U_TURN_COST, 2 * BEND_COST)).toBe(2 * BEND_COST);
  });

  it('remainingCostLowerBound am Ziel: 0 < 1 Biegung < Kehre (min[U_TURN, 2·BEND])', () => {
    // Restkosten am Ziel (len = 0): passender Heading, 90°-Biegung, 180°-Kehre.
    const aligned = remainingCostLowerBound(200, 100, 0, 200, 100, 0);
    const perpendicular = remainingCostLowerBound(200, 100, 1, 200, 100, 0);
    const uTurn = remainingCostLowerBound(200, 100, 2, 200, 100, 0);
    expect(aligned).toBe(0);
    expect(perpendicular).toBe(BEND_COST);
    expect(uTurn).toBe(Math.min(U_TURN_COST, 2 * BEND_COST));
    expect(aligned).toBeLessThan(perpendicular);
    expect(perpendicular).toBeLessThan(uTurn);
  });

  it('remainingCostLowerBound unterwegs: matched < 1 Biegung < 2 Biegungen', () => {
    // Quelle (0,0) → Ziel (200,100): passende Richtung spart eine Biegung.
    const matched = remainingCostLowerBound(0, 0, 0, 200, 100, 0); // heading +x
    const mismatched = remainingCostLowerBound(0, 0, 1, 200, 100, 0); // heading −y
    expect(matched).toBe(300 + BEND_COST);
    expect(mismatched).toBe(300 + 2 * BEND_COST);
    expect(matched).toBeLessThan(mismatched);
  });

  it('Router-Präferenz: Gerade < L < Z < Zickzack (gleiche Endpunkte, Kosten ordnen)', () => {
    // Alle Varianten: 400 px Querversatz, Hindernisse erzwingen die Form.
    const straight = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
    });
    const lShape = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 160,
      targetPosition: Position.Left,
    });
    const zShape = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [{ x: 150, y: 2, width: 100, height: 80 }],
    });
    const zigzag = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [
        // A ragt von unten in die Lane → erst nach oben ausweichen.
        { x: 120, y: 2, width: 80, height: 90 },
        // B ragt von oben in die Lane → hinter A wieder nach unten;
        // C verschließt den Unterlauf von A (kein gemeinsames Unterfahren).
        { x: 280, y: -300, width: 80, height: 298 },
        { x: 120, y: 90, width: 80, height: 200 },
      ],
    });

    expect(straight.bends).toBe(0);
    expect(lShape.bends).toBeGreaterThan(straight.bends);
    expect(zShape.bends).toBeGreaterThan(lShape.bends);
    expect(zigzag.bends).toBeGreaterThan(zShape.bends);

    expect(cost(straight)).toBeLessThan(cost(lShape));
    expect(cost(lShape)).toBeLessThan(cost(zShape));
    expect(cost(zShape)).toBeLessThan(cost(zigzag));
  });

  it('U-Turn nur wenn geometrisch erzwungen — und dann hindernisfrei', () => {
    // Quelle zeigt nach rechts, Ziel liegt links HINTER der Quelle und wird
    // von rechts betreten: ohne Kehre nicht erreichbar.
    const result = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: -400,
      targetY: 0,
      targetPosition: Position.Right,
    });
    expect(result.usedSearch).not.toBe('fallback');
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
    expect(result.bends).toBeGreaterThanOrEqual(3);
  });

  it('Freie Bahn: die gerade Verbindung schlägt jede gebogene Alternative', () => {
    const free = run({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
    });
    expect(free.bends).toBe(0);
    expect(free.length).toBe(400);
  });
});
