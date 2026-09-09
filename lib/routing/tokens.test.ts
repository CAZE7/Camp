import { describe, expect, it } from 'vitest';
import {
  ROUTING_TOKENS,
  LEGACY_ROUTING_TOKENS,
  ALTERNATIVE_LANE_STEP,
  alternativeRouteGap,
  generateElkLayoutOptions,
  generateElkInteractiveOptions,
  type RoutingTokens,
} from './tokens';
import {
  ROUTE_MIN_STUB,
  ROUTE_BORDER_RADIUS,
  OBSTACLE_MARGIN,
  ALTERNATIVE_ROUTE_GAP,
  U_TURN_LANE_SPREAD,
} from '../../components/edges/utils/pathfinding';
import {
  ROUTE_MIN_STUB as ORTHO_MIN_STUB,
  ROUTE_BORDER_RADIUS as ORTHO_BORDER_RADIUS,
  OBSTACLE_MARGIN as ORTHO_OBSTACLE_MARGIN,
} from '../../components/edges/utils/orthogonalRouting';
import { PARALLEL_LANE_SPREAD, SMOOTH_STEP_BORDER_RADIUS } from '../../components/edges/utils/pathUtils';
import { NUDGE_GAP, NUDGE_MIN_OVERLAP } from '../../components/edges/utils/nudge';

/**
 * WP-1 (#390): Config-Sync- und Drift-Guard-Tests des Token-Modells.
 *
 * 1. Spec-Werte (docs/ROUTING-V2.md §3) sind eingefroren — Änderung nur via
 *    ADR + Change Ledger.
 * 2. Die ELK-Optionsstruktur ist GENERIERT: jeder Geometriewert in den
 *    Optionen muss aus den Tokens stammen (Hardcode ⇒ Test rot).
 * 3. Konsumenten-Drift-Guard: die Router-Konstanten sind Re-Exports der
 *    Tokens — keine zweite Pflegestelle (vorher doppelt in
 *    orthogonalRouting.ts und pathfinding.ts).
 */

describe('Routing-Tokens (Single Source of Truth)', () => {
  it('Spec-Werte aus ROUTING-V2.md §3 sind eingefroren', () => {
    expect(ROUTING_TOKENS).toEqual({
      cableClearance: 12,
      elkEdgeNodeSpacing: 16,
      stubMin: 24,
      laneGrid: 16,
      segmentMin: 16,
      bendRadius: 8,
      crossDomainSpacing: 24,
      nodeFallbackWidth: 192,
      nodeFallbackHeight: 120,
      obstacleRegionPad: 240,
      bendCost: 80,
      uTurnCost: 400,
      maxSearchExpansions: 48_000,
      maxAcceptableCrossings: 2,
    });
  });

  it('Tokens sind unveränderlich (Object.freeze)', () => {
    expect(Object.isFrozen(ROUTING_TOKENS)).toBe(true);
    expect(Object.isFrozen(LEGACY_ROUTING_TOKENS)).toBe(true);
  });

  it('Konsistenzregeln der Spec gelten', () => {
    // Bend-Merge-Schwelle 2×r darf keine Mindestsegmentlänge sprengen.
    expect(2 * ROUTING_TOKENS.bendRadius).toBeLessThanOrEqual(ROUTING_TOKENS.stubMin);
    // Domain-Trennung ist strenger als die allgemeine Clearance.
    expect(ROUTING_TOKENS.crossDomainSpacing).toBeGreaterThanOrEqual(ROUTING_TOKENS.cableClearance);
    // Übergangswert deckt das Clearance-Ziel (R-10) mit Reserve.
    expect(LEGACY_ROUTING_TOKENS.obstacleMargin).toBeGreaterThanOrEqual(ROUTING_TOKENS.cableClearance);
  });
});

describe('ELK-Config-Sync (generiert, nicht gepflegt)', () => {
  it('Geometrie-Optionen folgen den Tokens — auch bei anderen Werten', () => {
    // Der eigentliche Sync-Beweis: mit VERÄNDERTEN Tokens müssen sich die
    // Optionen mitändern. Eine hartcodierte Kopie fällt hier sofort auf.
    const probe: RoutingTokens = Object.freeze({
      ...ROUTING_TOKENS,
      cableClearance: 7,
      elkEdgeNodeSpacing: 33,
    });
    const options = generateElkLayoutOptions(probe);
    expect(options['elk.spacing.edgeEdge']).toBe('7');
    expect(options['elk.spacing.edgeNode']).toBe('33');
    expect(options['elk.layered.spacing.edgeNodeBetweenLayers']).toBe('33');
    expect(options['elk.layered.spacing.edgeEdgeBetweenLayers']).toBe('7');
  });

  it('Default-Optionen tragen die Spec-Werte und die Spec-Schalter', () => {
    const options = generateElkLayoutOptions();
    expect(options).toMatchObject({
      'elk.algorithm': 'layered',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.edgeEdge': '12',
      'elk.spacing.edgeNode': '16',
      'elk.layered.mergeEdges': 'false',
      'elk.portConstraints': 'FIXED_ORDER',
      'elk.junctionPoints': 'true',
    });
  });

  it('Interaktiver Modus erweitert die Basis, ohne sie zu verändern', () => {
    const base = generateElkLayoutOptions();
    const interactive = generateElkInteractiveOptions();
    expect(interactive).toMatchObject(base);
    expect(interactive['elk.layered.cycleBreaking.strategy']).toBe('INTERACTIVE');
    expect(interactive['elk.layered.layering.strategy']).toBe('INTERACTIVE');
    expect(interactive['elk.layered.crossingMinimization.semiInteractive']).toBe('true');
  });
});

describe('Konsumenten-Drift-Guard (keine doppelt gepflegten Geometriewerte)', () => {
  it('pathfinding.ts und orthogonalRouting.ts teilen dieselben Token-Werte', () => {
    expect(ROUTE_MIN_STUB).toBe(ROUTING_TOKENS.stubMin);
    expect(ORTHO_MIN_STUB).toBe(ROUTING_TOKENS.stubMin);
    expect(OBSTACLE_MARGIN).toBe(LEGACY_ROUTING_TOKENS.obstacleMargin);
    expect(ORTHO_OBSTACLE_MARGIN).toBe(LEGACY_ROUTING_TOKENS.obstacleMargin);
    expect(ROUTE_BORDER_RADIUS).toBe(LEGACY_ROUTING_TOKENS.routeBorderRadius);
    expect(ORTHO_BORDER_RADIUS).toBe(LEGACY_ROUTING_TOKENS.routeBorderRadius);
    expect(SMOOTH_STEP_BORDER_RADIUS).toBe(LEGACY_ROUTING_TOKENS.routeBorderRadius);
  });

  it('Lane-System läuft auf dem laneGrid-Token', () => {
    expect(PARALLEL_LANE_SPREAD).toBe(ROUTING_TOKENS.laneGrid);
    expect(NUDGE_GAP).toBe(ROUTING_TOKENS.laneGrid);
    expect(NUDGE_MIN_OVERLAP).toBe(ROUTING_TOKENS.cableClearance);
    expect(U_TURN_LANE_SPREAD).toBe(2 * ROUTING_TOKENS.laneGrid);
  });

  it('Ausweich-Parallelen (±48/±96, historisch „±40/±80“) sind laneGrid-Vielfache', () => {
    expect(ALTERNATIVE_ROUTE_GAP).toBe(alternativeRouteGap());
    expect(alternativeRouteGap()).toBe(ALTERNATIVE_LANE_STEP * ROUTING_TOKENS.laneGrid);
    expect(ALTERNATIVE_ROUTE_GAP % ROUTING_TOKENS.laneGrid).toBe(0);
  });
});
