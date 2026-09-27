import { describe, expect, it } from 'vitest';
import {
  analyzeRouteCrossings,
  HOP_PRIORITY_WEIGHTS,
  hopRadius,
  resolveHops,
  routingPriority,
  type Hop,
  type HopEdge,
} from './hopping';
import { ROUTING_TOKENS } from '../tokens';
import { segmentIntersectionPoint, waypointsToSegments, type Point, type Segment } from '../geometry';

/**
 * WP-7 (#395): Kreuzungs-Hopping.
 *
 * Prüft die drei Zusagen aus `docs/ROUTING-V2.md` §8: die Prioritätsformel,
 * „dickeres/Backbone-Kabel bleibt gerade, Abzweig hüpft“ und „fixierte
 * Kabel hoppen nie“ — plus Determinismus (ADR 0010).
 */

const wp = (...coords: [number, number][]): Point[] => coords.map(([x, y]) => ({ x, y }));

/** Waagerecht auf Höhe y von x=0 bis x=200. */
const horizontal = (id: string, y: number, extra: Partial<HopEdge> = {}): HopEdge => ({
  id,
  waypoints: wp([0, y], [200, y]),
  ...extra,
});

/** Senkrecht bei x von y=0 bis y=200. */
const vertical = (id: string, x: number, extra: Partial<HopEdge> = {}): HopEdge => ({
  id,
  waypoints: wp([x, 0], [x, 200]),
  ...extra,
});

describe('routingPriority', () => {
  it('summiert Domäne, Backbone, Querschnitt und Lock', () => {
    expect(routingPriority({ domain: 'AC_230V', backbone: true, crossSection: 16, locked: true })).toBe(
      300 + 1000 + 16 * 4 + 10000
    );
  });

  it('unbekannte/fehlende Angaben zählen als 0', () => {
    expect(routingPriority({})).toBe(0);
    expect(routingPriority({ domain: 'unknown', crossSection: undefined })).toBe(0);
  });

  it('deckelt den Querschnitt bei 70 mm²', () => {
    expect(routingPriority({ crossSection: 70 })).toBe(280);
    expect(routingPriority({ crossSection: 240 })).toBe(280);
  });

  it('ignoriert negative Querschnitte statt sie abzuziehen', () => {
    expect(routingPriority({ crossSection: -10 })).toBe(0);
  });

  it('Backbone schlägt jede Kombination aus Domäne und Querschnitt', () => {
    const trunk = routingPriority({ backbone: true });
    const fettesAbzweig = routingPriority({ domain: 'AC_230V', crossSection: 240 });
    expect(trunk).toBeGreaterThan(fettesAbzweig);
  });

  it('Lock schlägt jede Kombination inkl. Backbone', () => {
    const locked = routingPriority({ locked: true });
    const rest = routingPriority({ domain: 'AC_230V', backbone: true, crossSection: 240 });
    expect(locked).toBeGreaterThan(rest);
  });

  it('Domäne und Querschnitt liegen auf einer Ebene und addieren sich (§8)', () => {
    // Bei gleichem Querschnitt entscheidet die Domäne …
    expect(routingPriority({ domain: 'AC_230V', crossSection: 6 })).toBeGreaterThan(
      routingPriority({ domain: 'DC_12V', crossSection: 6 })
    );
    // … ein deutlich dickeres Kabel dreht das Ergebnis aber um.
    expect(routingPriority({ domain: 'DC_12V', crossSection: 70 })).toBeGreaterThan(
      routingPriority({ domain: 'AC_230V', crossSection: 1.5 })
    );
  });
});

describe('hopRadius', () => {
  it('ist die halbe Lane — kein eigenes Token, keine harte Zahl', () => {
    expect(hopRadius()).toBe(ROUTING_TOKENS.laneGrid / 2);
  });

  it('bleibt schmaler als der Lane-Abstand, ragt also nie in die Nachbartrasse', () => {
    expect(2 * hopRadius()).toBeLessThanOrEqual(ROUTING_TOKENS.laneGrid);
  });
});

describe('resolveHops — wer hüpft', () => {
  it('der dünnere Abzweig hüpft, das dickere Kabel bleibt gerade', () => {
    const dick = horizontal('dick', 100, { crossSection: 35 });
    const duenn = vertical('duenn', 100, { crossSection: 2.5 });
    const hops = resolveHops([dick, duenn]);
    expect(hops.get('dick')).toEqual([]);
    expect(hops.get('duenn')).toEqual([{ x: 100, y: 100, orientation: 'vertical' }]);
  });

  it('der Backbone bleibt gerade, auch gegen einen dicken Abzweig', () => {
    const trunk = horizontal('trunk', 50, { backbone: true, crossSection: 6 });
    const abzweig = vertical('abzweig', 20, { crossSection: 70, domain: 'AC_230V' });
    const hops = resolveHops([trunk, abzweig]);
    expect(hops.get('trunk')).toEqual([]);
    expect(hops.get('abzweig')).toHaveLength(1);
  });

  it('ein fixiertes Kabel hüpft nie — das andere hüpft, trotz höherer Priorität', () => {
    const locked = vertical('locked', 30, { locked: true, crossSection: 1.5 });
    const trunk = horizontal('trunk', 30, { backbone: true, domain: 'AC_230V', crossSection: 70 });
    const hops = resolveHops([locked, trunk]);
    expect(hops.get('locked')).toEqual([]);
    expect(hops.get('trunk')).toEqual([{ x: 30, y: 30, orientation: 'horizontal' }]);
  });

  it('sind beide fixiert, hüpft keines', () => {
    const hops = resolveHops([
      vertical('a', 40, { locked: true }),
      horizontal('b', 40, { locked: true, crossSection: 70 }),
    ]);
    expect(hops.get('a')).toEqual([]);
    expect(hops.get('b')).toEqual([]);
  });

  it('bei Gleichstand entscheidet die ID — stabil, nicht zufällig', () => {
    const hops = resolveHops([vertical('a', 10), horizontal('b', 10)]);
    expect(hops.get('a')).toEqual([]);
    expect(hops.get('b')).toEqual([{ x: 10, y: 10, orientation: 'horizontal' }]);
  });
});

describe('analyzeRouteCrossings — gemeinsamer Hop-/Crossing-Scan', () => {
  it('zählt jede fremde Kante einmal und liefert dieselben Hops wie resolveHops', () => {
    const horizontalEdge = horizontal('thin', 100, { crossSection: 1 });
    const multiCrossingEdge: HopEdge = {
      id: 'thick',
      waypoints: wp([50, 0], [50, 200], [150, 200], [150, 0]),
      crossSection: 70,
    };
    const edges = [horizontalEdge, multiCrossingEdge];
    const analysis = analyzeRouteCrossings(edges);

    expect(analysis.crossingCountsByEdge).toEqual(
      new Map([
        ['thin', 1],
        ['thick', 1],
      ])
    );
    expect(analysis.hopsByEdge).toEqual(resolveHops(edges));
    expect(analysis.hopsByEdge.get('thin')).toEqual([
      { x: 50, y: 100, orientation: 'horizontal' },
      { x: 150, y: 100, orientation: 'horizontal' },
    ]);
  });

  it('zählt Kreuzungen auch dann, wenn beide Kanten fixiert sind und kein Hop entsteht', () => {
    const analysis = analyzeRouteCrossings([
      horizontal('locked-h', 50, { locked: true }),
      vertical('locked-v', 50, { locked: true }),
    ]);
    expect(analysis.crossingCountsByEdge).toEqual(
      new Map([
        ['locked-h', 1],
        ['locked-v', 1],
      ])
    );
    expect([...analysis.hopsByEdge.values()].flat()).toEqual([]);
  });

  it('matches the pairwise reference for deterministic mixed orthogonal routes', () => {
    let state = 0x21a0;
    const randomInt = (limit: number): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % limit;
    };
    const coordinate = (): number => (randomInt(21) - 10) * 20;
    const edges: HopEdge[] = Array.from({ length: 40 }, (_, i) => {
      const x0 = coordinate();
      const y0 = coordinate();
      const x1 = coordinate();
      const y1 = coordinate();
      const x2 = coordinate();
      const y2 = coordinate();
      return {
        id: `edge-${String(i).padStart(2, '0')}`,
        waypoints: wp([x0, y0], [x1, y0], [x1, y1], [x2, y1], [x2, y2]),
        domain: i % 3 === 0 ? 'AC_230V' : 'DC_12V',
        backbone: i % 7 === 0,
        crossSection: ((i % 8) + 1) * 1.5,
        locked: i % 17 === 0,
      };
    });

    const sorted = [...edges].sort((a, b) => a.id.localeCompare(b.id));
    const referenceCounts = new Map(sorted.map((edge) => [edge.id, 0]));
    const referenceHops = new Map<string, Hop[]>(sorted.map((edge) => [edge.id, []]));
    const chooseHopper = (a: HopEdge, b: HopEdge): string | undefined => {
      if (a.locked && b.locked) return undefined;
      if (a.locked) return b.id;
      if (b.locked) return a.id;
      const priorityA = routingPriority(a);
      const priorityB = routingPriority(b);
      if (priorityA !== priorityB) return priorityA < priorityB ? a.id : b.id;
      return a.id.localeCompare(b.id) > 0 ? a.id : b.id;
    };

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const segmentsA: Segment[] = waypointsToSegments(a.waypoints);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        const segmentsB = waypointsToSegments(b.waypoints);
        let crossed = false;
        let hopperResolved = false;
        let hopperId: string | undefined;
        for (const segmentA of segmentsA) {
          for (const segmentB of segmentsB) {
            const point = segmentIntersectionPoint(segmentA, segmentB);
            if (!point) continue;
            crossed = true;
            if (!hopperResolved) {
              hopperId = chooseHopper(a, b);
              hopperResolved = true;
            }
            if (!hopperId) continue;
            const carrier = hopperId === a.id ? segmentA : segmentB;
            const horizontalSegment = Math.abs(carrier[0].y - carrier[1].y) < 1e-6;
            const verticalSegment = Math.abs(carrier[0].x - carrier[1].x) < 1e-6;
            if (!horizontalSegment && !verticalSegment) continue;
            referenceHops.get(hopperId)?.push({
              x: point.x,
              y: point.y,
              orientation: horizontalSegment ? 'horizontal' : 'vertical',
            });
          }
        }
        if (crossed) {
          referenceCounts.set(a.id, referenceCounts.get(a.id)! + 1);
          referenceCounts.set(b.id, referenceCounts.get(b.id)! + 1);
        }
      }
    }

    for (const [id, hops] of referenceHops) {
      const unique = new Map<string, Hop>();
      for (const hop of hops) unique.set(`${hop.x.toFixed(3)},${hop.y.toFixed(3)},${hop.orientation}`, hop);
      referenceHops.set(
        id,
        [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y)
      );
    }

    const analysis = analyzeRouteCrossings(edges);
    expect(analysis.crossingCountsByEdge).toEqual(referenceCounts);
    expect(analysis.hopsByEdge).toEqual(referenceHops);
  });
});

describe('resolveHops — welche Punkte', () => {
  it('meldet die Orientierung des hüpfenden Segments, nicht des gekreuzten', () => {
    const hops = resolveHops([
      horizontal('hopper', 100, { crossSection: 1 }),
      vertical('gerade', 100, { crossSection: 70 }),
    ]);
    expect(hops.get('hopper')).toEqual([{ x: 100, y: 100, orientation: 'horizontal' }]);
  });

  it('findet mehrere Kreuzungen entlang einer Leitung und sortiert sie', () => {
    const hopper = horizontal('hopper', 100, { crossSection: 1 });
    const hops = resolveHops([
      hopper,
      vertical('v3', 150, { crossSection: 70 }),
      vertical('v1', 50, { crossSection: 70 }),
      vertical('v2', 120, { crossSection: 70 }),
    ]);
    expect(hops.get('hopper')?.map((hop) => hop.x)).toEqual([50, 120, 150]);
  });

  it('kreuzt jedes Segment eines Knicks separat', () => {
    const hopper: HopEdge = { id: 'hopper', waypoints: wp([0, 20], [80, 20], [80, 200]), crossSection: 1 };
    const gerade: HopEdge = { id: 'gerade', waypoints: wp([40, 0], [40, 100], [200, 100]), crossSection: 70 };
    const hops = resolveHops([hopper, gerade]);
    expect(hops.get('hopper')).toEqual([
      { x: 40, y: 20, orientation: 'horizontal' },
      { x: 80, y: 100, orientation: 'vertical' },
    ]);
  });

  it('Berührung an einem Endpunkt (T-Stoß) ist keine Kreuzung', () => {
    const hops = resolveHops([
      { id: 'stamm', waypoints: wp([0, 100], [200, 100]), crossSection: 70 },
      { id: 'stich', waypoints: wp([100, 100], [100, 200]), crossSection: 1 },
    ]);
    expect(hops.get('stich')).toEqual([]);
    expect(hops.get('stamm')).toEqual([]);
  });

  it('kollineare Überlappung ist keine Kreuzung (die verhindert das Routing)', () => {
    const hops = resolveHops([
      horizontal('a', 100, { crossSection: 70 }),
      { id: 'b', waypoints: wp([50, 100], [300, 100]), crossSection: 1 },
    ]);
    expect(hops.get('a')).toEqual([]);
    expect(hops.get('b')).toEqual([]);
  });

  it('parallele Leitungen erzeugen keine Hops', () => {
    const hops = resolveHops([horizontal('a', 100), horizontal('b', 116)]);
    expect([...hops.values()].flat()).toEqual([]);
  });

  it('dedupliziert Bögen, wenn mehrere Leitungen denselben Punkt kreuzen', () => {
    const hopper = horizontal('hopper', 100, { crossSection: 1 });
    const hops = resolveHops([
      hopper,
      vertical('v1', 100, { crossSection: 70 }),
      vertical('v2', 100, { crossSection: 70 }),
    ]);
    expect(hops.get('hopper')).toEqual([{ x: 100, y: 100, orientation: 'horizontal' }]);
  });

  it('liefert für jede Eingabekante einen Eintrag, auch ohne Hop', () => {
    const hops = resolveHops([horizontal('einsam', 5)]);
    expect(hops.get('einsam')).toEqual([]);
  });
});

describe('resolveHops — nur zeichenbare Hops', () => {
  it('meldet keinen Hop auf einem schrägen Träger', () => {
    // Routing ist orthogonal (ADR 0003); ein schräger Halbkreis wäre nicht
    // eindeutig orientierbar. Ein Hop, den der Renderer nicht zeichnen kann,
    // darf nicht gemeldet werden — sonst widersprechen sich hops und path.
    const hops = resolveHops([
      { id: 'diag', waypoints: wp([0, 0], [100, 100]), crossSection: 1 },
      { id: 'gegen', waypoints: wp([0, 100], [100, 0]), crossSection: 70 },
    ]);
    expect(hops.get('diag')).toEqual([]);
    expect(hops.get('gegen')).toEqual([]);
  });

  it('meldet den Hop, wenn nur die GEKREUZTE Leitung schräg läuft', () => {
    // Der Träger ist achsparallel — der Bogen ist zeichenbar.
    const hops = resolveHops([
      { id: 'gerade', waypoints: wp([0, 50], [100, 50]), crossSection: 1 },
      { id: 'schraeg', waypoints: wp([20, 0], [80, 100]), crossSection: 70 },
    ]);
    expect(hops.get('gerade')).toEqual([{ x: 50, y: 50, orientation: 'horizontal' }]);
  });
});

describe('resolveHops — Hüllrechteck-Filter ändert nichts am Ergebnis', () => {
  it('weit auseinander liegende Leitungen erzeugen keine Hops', () => {
    const hops = resolveHops([horizontal('nah', 10), vertical('fern', 5000)]);
    expect([...hops.values()].flat()).toEqual([]);
  });

  it('sich berührende Hüllrechtecke ohne echte Kreuzung erzeugen keine Hops', () => {
    // Boxen überlappen, die Segmente selbst kreuzen sich aber nicht.
    const hops = resolveHops([
      { id: 'a', waypoints: wp([0, 0], [100, 0], [100, 50]), crossSection: 70 },
      { id: 'b', waypoints: wp([0, 80], [50, 80], [50, 40]), crossSection: 1 },
    ]);
    expect([...hops.values()].flat()).toEqual([]);
  });
});

describe('resolveHops — Determinismus (ADR 0010)', () => {
  const edges: HopEdge[] = [
    horizontal('h1', 40, { crossSection: 6 }),
    horizontal('h2', 90, { backbone: true }),
    vertical('v1', 60, { crossSection: 16 }),
    vertical('v2', 130, { domain: 'AC_230V' }),
  ];

  it('ist unabhängig von der Reihenfolge der Kanten', () => {
    const forward = resolveHops(edges);
    const reversed = resolveHops([...edges].reverse());
    for (const edge of edges) {
      expect(reversed.get(edge.id)).toEqual(forward.get(edge.id));
    }
  });

  it('liefert bei wiederholtem Aufruf dasselbe Ergebnis', () => {
    expect(resolveHops(edges)).toEqual(resolveHops(edges));
  });
});

describe('Gewichtstabelle', () => {
  it('ist eingefroren — Änderungen nur bewusst über diesen Test', () => {
    expect(HOP_PRIORITY_WEIGHTS.manualLock).toBe(10000);
    expect(HOP_PRIORITY_WEIGHTS.backbone).toBe(1000);
    expect(HOP_PRIORITY_WEIGHTS.domain).toEqual({
      AC_230V: 300,
      Solar: 200,
      DC_12V: 100,
      water: 50,
      unknown: 0,
    });
    expect(HOP_PRIORITY_WEIGHTS.crossSectionFactor).toBe(4);
    expect(HOP_PRIORITY_WEIGHTS.crossSectionCap).toBe(70);
  });

  it('die strukturellen Stufen können von den fachlichen nicht überstimmt werden', () => {
    const maxDomain = Math.max(...Object.values(HOP_PRIORITY_WEIGHTS.domain));
    const maxCrossSection = HOP_PRIORITY_WEIGHTS.crossSectionCap * HOP_PRIORITY_WEIGHTS.crossSectionFactor;
    expect(HOP_PRIORITY_WEIGHTS.backbone).toBeGreaterThan(maxDomain + maxCrossSection);
    expect(HOP_PRIORITY_WEIGHTS.manualLock).toBeGreaterThan(
      HOP_PRIORITY_WEIGHTS.backbone + maxDomain + maxCrossSection
    );
  });
});
