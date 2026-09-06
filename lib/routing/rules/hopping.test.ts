import { describe, expect, it } from 'vitest';
import { HOP_PRIORITY_WEIGHTS, hopRadius, resolveHops, routingPriority, type HopEdge } from './hopping';
import { ROUTING_TOKENS } from '../tokens';
import type { Point } from '../geometry';

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
