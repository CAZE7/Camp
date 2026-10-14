import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDiagnosticSession,
  setActiveDiagnosticSession,
  getActiveDiagnosticSession,
  enableRoutingDiagnostics,
  clearDiagnosticSessions,
} from './index';
import { routeAllCables } from '../../../components/edges/utils/routeAll';
import { GOLDEN_PLANS } from '../../../scripts/goldenmaster/plans';
import { performAutoWiring } from '../../autoWire';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';
import type { RouteEdgeRef } from '../../../components/edges/utils/routeAll';

describe('Routing Pipeline Diagnostic Integration', () => {
  beforeEach(() => {
    enableRoutingDiagnostics(true);
  });

  afterEach(() => {
    setActiveDiagnosticSession(null);
    clearDiagnosticSessions();
    enableRoutingDiagnostics(false);
  });

  it('erfasst alle Routing-Zustände (C, D) während routeAllCables bei aktiver Session', () => {
    const session = createDiagnosticSession('test-golden-simple');
    setActiveDiagnosticSession(session);

    const plan = GOLDEN_PLANS.simple!;
    const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
    expect(wired).toBeDefined();

    const nodes = wired!.nodes as RoutableNode[];
    const edges = wired!.edges as unknown as RouteEdgeRef[];

    // Ausführung des Routings
    const routes = routeAllCables(nodes, edges);
    expect(routes.size).toBe(edges.length);

    // Verifikation der Session-Zustände
    const active = getActiveDiagnosticSession();
    expect(active).toBe(session);

    const capturedStates = session.getCapturedStates();
    expect(capturedStates).toContain('C');
    expect(capturedStates).toContain('D');

    const stateC = session.getSnapshot('C');
    expect(stateC).toBeDefined();
    expect(stateC?.stateId).toBe('C');
    expect(stateC?.routes.length).toBe(edges.length);

    const stateD = session.getSnapshot('D');
    expect(stateD).toBeDefined();
    expect(stateD?.stateId).toBe('D');
    expect(stateD?.routes.length).toBe(edges.length);

    // Vergleich der Metriken zwischen State C und D
    const metricsC = session.getMetrics('C');
    const metricsD = session.getMetrics('D');
    expect(metricsC).toBeDefined();
    expect(metricsD).toBeDefined();

    // Invariante I1 (keine Kollisionen mit fremden Nodes) muss in State D erfüllt sein
    expect(metricsD?.edgeNodeViolations).toBe(0);
    // Ungültige (nicht-orthogonale) Segmente müssen 0 sein
    expect(metricsD?.invalidSegments).toBe(0);
    // Gesamtlänge muss konsistent positiv sein
    expect(metricsD?.totalCableLength).toBeGreaterThan(0);
    expect(metricsD?.totalBends).toBeGreaterThan(0);
  });

  it('bleibt vollkommen passiv und ohne Seiteneffekte, wenn Diagnostics deaktiviert sind', () => {
    enableRoutingDiagnostics(false);

    const plan = GOLDEN_PLANS.simple!;
    const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
    const nodes = wired!.nodes as RoutableNode[];
    const edges = wired!.edges as unknown as RouteEdgeRef[];

    const routes = routeAllCables(nodes, edges);
    expect(routes.size).toBe(edges.length);

    expect(getActiveDiagnosticSession()).toBeNull();
  });
});
