/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
/**
 * Erweiterte Metriken für Routing-Diagnostik
 *
 * Zusätzliche Metriken für spezifische Anforderungen:
 * - Domänen-Clearance (24px für AC/DC Trennung)
 * - Thermische Bündel (VDE 0298-4)
 * - Routing-Dauer pro Kante
 */

import type { DiagnosticStateSnapshot, RoutingMetrics, DiagnosticStateId } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DomainClearanceMetrics {
  /** AC-DC Clearance-Verletzungen (< 24px) */
  acDcViolations: number;
  /** Minimale AC-DC Distanz */
  minAcDcDistance: number | null;
  /** Anzahl AC-DC Kantenpaare */
  acDcEdgePairs: number;
  /** Durchschnittliche AC-DC Distanz */
  meanAcDcDistance: number | null;
  /** AC-DC Clearance-Verletzungen pro Kante */
  violationsPerEdge: Record<string, number>;
}

export interface ThermalBundleMetrics {
  /** Anzahl thermischer Bündel */
  bundleCount: number;
  /** Bündel mit Überlastung */
  overloadedBundles: ThermalBundle[];
  /** Maximale Bündelgröße */
  maxBundleSize: number;
  /** Durchschnittliche Bündelgröße */
  meanBundleSize: number;
  /** Gesamte thermische Belastung */
  totalThermalLoad: number;
}

export interface ThermalBundle {
  /** Bündel-ID */
  id: string;
  /** Kanten im Bündel */
  edgeIds: string[];
  /** Querschnittssumme (mm²) */
  totalCrossSection: number;
  /** Maximale Strombelastbarkeit nach VDE 0298-4 */
  maxCurrentCapacity: number;
  /** Tatsächliche Belastung (geschätzt) */
  estimatedLoad: number;
  /** Auslastung in % */
  utilizationPercent: number;
  /** Überlastet? */
  isOverloaded: boolean;
  /** Bounding Box */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PerEdgeRoutingMetrics {
  /** Routing-Dauer pro Kante */
  durationPerEdge: Record<string, number>;
  /** Durchschnittliche Dauer */
  meanDuration: number;
  /** Median Dauer */
  medianDuration: number;
  /** Max Dauer */
  maxDuration: number;
  /** Kanten mit Timeout (> 1000ms) */
  timeoutEdges: string[];
  /** Kanten mit Fallback */
  fallbackEdges: string[];
}

export interface ExtendedMetrics {
  domainClearance: DomainClearanceMetrics;
  thermalBundles: ThermalBundleMetrics;
  perEdgeRouting: PerEdgeRoutingMetrics;
}

// ============================================================================
// Constants
// ============================================================================

import { ROUTING_TOKENS } from '../tokens';

const AC_DC_CLEARANCE = ROUTING_TOKENS.stubMin; // px (VDE 0100-520, 24px)
const BUNDLE_PROXIMITY = 8; // px (Kanten gelten als gebündelt wenn < 8px Abstand)
const TIMEOUT_THRESHOLD = 1000; // ms

// VDE 0298-4: Strombelastbarkeit für gebündelte Leitungen (vereinfacht)
const CURRENT_CAPACITY_TABLE: Record<number, number> = {
  1: 16, // 1.5mm² → 16A (Einzelleitung)
  2: 13, // 2 Leitungen gebündelt
  3: 11, // 3 Leitungen
  4: 10, // 4 Leitungen
  5: 9, // 5+ Leitungen
};

// ============================================================================
// Domain Clearance Calculation
// ============================================================================

export function calculateDomainClearance(snapshot: DiagnosticStateSnapshot): DomainClearanceMetrics {
  const acEdges = snapshot.edges.filter((e) => e.domain === 'ac');
  const dcEdges = snapshot.edges.filter((e) => e.domain === 'dc');

  let acDcViolations = 0;
  let minAcDcDistance: number | null = null;
  const violationsPerEdge: Record<string, number> = {};

  // Vergleiche alle AC-DC Kantenpaare
  for (const acEdge of acEdges) {
    const acRoute = snapshot.routes.find((r) => r.edgeId === acEdge.id);
    if (!acRoute) continue;

    for (const dcEdge of dcEdges) {
      const dcRoute = snapshot.routes.find((r) => r.edgeId === dcEdge.id);
      if (!dcRoute) continue;

      const distance = calculateMinDistanceBetweenRoutes(acRoute.waypoints, dcRoute.waypoints);

      if (minAcDcDistance === null || distance < minAcDcDistance) {
        minAcDcDistance = distance;
      }

      if (distance < AC_DC_CLEARANCE) {
        acDcViolations++;
        violationsPerEdge[acEdge.id] = (violationsPerEdge[acEdge.id] || 0) + 1;
        violationsPerEdge[dcEdge.id] = (violationsPerEdge[dcEdge.id] || 0) + 1;
      }
    }
  }

  const acDcEdgePairs = acEdges.length * dcEdges.length;
  const meanAcDcDistance = calculateMeanAcDcDistance(acEdges, dcEdges, snapshot.routes);

  return {
    acDcViolations,
    minAcDcDistance,
    acDcEdgePairs,
    meanAcDcDistance,
    violationsPerEdge,
  };
}

function calculateMinDistanceBetweenRoutes(
  route1: { x: number; y: number }[],
  route2: { x: number; y: number }[]
): number {
  let minDist = Infinity;

  for (const p1 of route1) {
    for (const p2 of route2) {
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
      }
    }
  }

  return minDist;
}

function calculateMeanAcDcDistance(acEdges: any[], dcEdges: any[], routes: any[]): number | null {
  const distances: number[] = [];

  for (const acEdge of acEdges) {
    const acRoute = routes.find((r) => r.edgeId === acEdge.id);
    if (!acRoute) continue;

    for (const dcEdge of dcEdges) {
      const dcRoute = routes.find((r) => r.edgeId === dcEdge.id);
      if (!dcRoute) continue;

      const dist = calculateMinDistanceBetweenRoutes(acRoute.waypoints, dcRoute.waypoints);
      distances.push(dist);
    }
  }

  if (distances.length === 0) return null;
  return distances.reduce((sum, d) => sum + d, 0) / distances.length;
}

// ============================================================================
// Thermal Bundle Calculation
// ============================================================================

export function calculateThermalBundles(snapshot: DiagnosticStateSnapshot): ThermalBundleMetrics {
  const bundles = identifyBundles(snapshot);
  const thermalBundles: ThermalBundle[] = [];

  for (const bundle of bundles) {
    const thermal = analyzeBundle(bundle, snapshot);
    thermalBundles.push(thermal);
  }

  const overloadedBundles = thermalBundles.filter((b) => b.isOverloaded);
  const bundleSizes = thermalBundles.map((b) => b.edgeIds.length);

  return {
    bundleCount: thermalBundles.length,
    overloadedBundles,
    maxBundleSize: Math.max(...bundleSizes, 0),
    meanBundleSize: bundleSizes.length > 0 ? bundleSizes.reduce((a, b) => a + b, 0) / bundleSizes.length : 0,
    totalThermalLoad: thermalBundles.reduce((sum, b) => sum + b.utilizationPercent, 0),
  };
}

function identifyBundles(snapshot: DiagnosticStateSnapshot): string[][] {
  const bundles: string[][] = [];
  const assigned = new Set<string>();

  for (const route1 of snapshot.routes) {
    if (assigned.has(route1.edgeId)) continue;

    const bundle: string[] = [route1.edgeId];
    assigned.add(route1.edgeId);

    for (const route2 of snapshot.routes) {
      if (assigned.has(route2.edgeId)) continue;

      if (areRoutesParallel(route1.waypoints, route2.waypoints, BUNDLE_PROXIMITY)) {
        bundle.push(route2.edgeId);
        assigned.add(route2.edgeId);
      }
    }

    if (bundle.length > 1) {
      bundles.push(bundle);
    }
  }

  return bundles;
}

function areRoutesParallel(
  route1: { x: number; y: number }[],
  route2: { x: number; y: number }[],
  maxDistance: number
): boolean {
  // Vereinfachte Prüfung: Mindestens 50% der Punkte sind nah beieinander
  let closePoints = 0;
  const threshold = Math.max(route1.length, route2.length) * 0.5;

  for (const p1 of route1) {
    for (const p2 of route2) {
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < maxDistance) {
        closePoints++;
        if (closePoints >= threshold) return true;
        break;
      }
    }
  }

  return false;
}

function analyzeBundle(bundleEdgeIds: string[], snapshot: DiagnosticStateSnapshot): ThermalBundle {
  const edges = bundleEdgeIds.map((id) => snapshot.edges.find((e) => e.id === id)).filter(Boolean) as any[];

  const routes = bundleEdgeIds
    .map((id) => snapshot.routes.find((r) => r.edgeId === id))
    .filter(Boolean) as any[];

  const totalCrossSection = edges.reduce((sum, e) => sum + (e.crossSection || 1.5), 0);

  const bundleSize = edges.length;
  const maxCurrentCapacity = CURRENT_CAPACITY_TABLE[Math.min(bundleSize, 5)] || 9;

  // Geschätzte Belastung: 80% der Nennbelastbarkeit pro Kante
  const estimatedLoad = edges.length * 0.8 * maxCurrentCapacity;
  const utilizationPercent = (estimatedLoad / (maxCurrentCapacity * edges.length)) * 100;
  const isOverloaded = utilizationPercent > 100;

  // Bounding Box berechnen
  const allPoints = routes.flatMap((r) => r.waypoints);
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);

  const bounds = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };

  return {
    id: `bundle-${bundleEdgeIds.join('-')}`,
    edgeIds: bundleEdgeIds,
    totalCrossSection,
    maxCurrentCapacity,
    estimatedLoad,
    utilizationPercent,
    isOverloaded,
    bounds,
  };
}

// ============================================================================
// Per-Edge Routing Metrics
// ============================================================================

export function calculatePerEdgeRoutingMetrics(snapshot: DiagnosticStateSnapshot): PerEdgeRoutingMetrics {
  const durationPerEdge: Record<string, number> = {};
  const timeoutEdges: string[] = [];
  const fallbackEdges: string[] = [];

  for (const route of snapshot.routes) {
    const duration = route.durationMs || 0;
    durationPerEdge[route.edgeId] = duration;

    if (duration > TIMEOUT_THRESHOLD) {
      timeoutEdges.push(route.edgeId);
    }

    if (route.fallbackHitsObstacles || route.usedSearch === 'fallback') {
      fallbackEdges.push(route.edgeId);
    }
  }

  const durations = Object.values(durationPerEdge);
  const sorted = [...durations].sort((a, b) => a - b);

  return {
    durationPerEdge,
    meanDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    medianDuration: sorted.length > 0 ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    timeoutEdges,
    fallbackEdges,
  };
}

// ============================================================================
// Main Function
// ============================================================================

export function calculateExtendedMetrics(snapshot: DiagnosticStateSnapshot): ExtendedMetrics {
  return {
    domainClearance: calculateDomainClearance(snapshot),
    thermalBundles: calculateThermalBundles(snapshot),
    perEdgeRouting: calculatePerEdgeRoutingMetrics(snapshot),
  };
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateExtendedMetricsReport(metrics: ExtendedMetrics): string {
  const lines: string[] = [];

  lines.push('# Erweiterte Routing-Metriken');
  lines.push('');

  // Domain Clearance
  lines.push('## Domänen-Clearance (AC/DC)');
  lines.push('');
  lines.push(`- **AC-DC Verletzungen (< 24px):** ${metrics.domainClearance.acDcViolations}`);
  lines.push(`- **Minimale Distanz:** ${metrics.domainClearance.minAcDcDistance?.toFixed(2) || '—'} px`);
  lines.push(
    `- **Durchschnittliche Distanz:** ${metrics.domainClearance.meanAcDcDistance?.toFixed(2) || '—'} px`
  );
  lines.push(`- **AC-DC Kantenpaare:** ${metrics.domainClearance.acDcEdgePairs}`);
  lines.push('');

  // Thermal Bundles
  lines.push('## Thermische Bündel (VDE 0298-4)');
  lines.push('');
  lines.push(`- **Anzahl Bündel:** ${metrics.thermalBundles.bundleCount}`);
  lines.push(`- **Überlastete Bündel:** ${metrics.thermalBundles.overloadedBundles.length}`);
  lines.push(`- **Max. Bündelgröße:** ${metrics.thermalBundles.maxBundleSize} Kanten`);
  lines.push(`- **Ø Bündelgröße:** ${metrics.thermalBundles.meanBundleSize.toFixed(1)} Kanten`);
  lines.push('');

  if (metrics.thermalBundles.overloadedBundles.length > 0) {
    lines.push('### Überlastete Bündel');
    lines.push('');
    for (const bundle of metrics.thermalBundles.overloadedBundles) {
      lines.push(`**${bundle.id}**`);
      lines.push(`- Kanten: ${bundle.edgeIds.join(', ')}`);
      lines.push(`- Querschnitt: ${bundle.totalCrossSection.toFixed(1)} mm²`);
      lines.push(`- Auslastung: ${bundle.utilizationPercent.toFixed(1)}%`);
      lines.push('');
    }
  }

  // Per-Edge Routing
  lines.push('## Routing-Dauer pro Kante');
  lines.push('');
  lines.push(`- **Ø Dauer:** ${metrics.perEdgeRouting.meanDuration.toFixed(2)} ms`);
  lines.push(`- **Median:** ${metrics.perEdgeRouting.medianDuration.toFixed(2)} ms`);
  lines.push(`- **Max:** ${metrics.perEdgeRouting.maxDuration.toFixed(2)} ms`);
  lines.push(`- **Timeouts (> 1000ms):** ${metrics.perEdgeRouting.timeoutEdges.length}`);
  lines.push(`- **Fallback-Routen:** ${metrics.perEdgeRouting.fallbackEdges.length}`);
  lines.push('');

  if (metrics.perEdgeRouting.timeoutEdges.length > 0) {
    lines.push('### Timeout-Kanten');
    lines.push('');
    for (const edgeId of metrics.perEdgeRouting.timeoutEdges) {
      const duration = metrics.perEdgeRouting.durationPerEdge[edgeId] ?? 0;
      lines.push(`- **${edgeId}:** ${duration.toFixed(2)} ms`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
