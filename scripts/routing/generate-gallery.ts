/**
 * scripts/routing/generate-gallery.ts
 *
 * Erzeugt die Routing-Galerie aus `components/edges/utils/routingScenarios.ts`:
 *
 *   docs/routing-gallery/gallery.json   maschinenlesbare Referenz (Regression)
 *   docs/routing-gallery/<id>.svg       Bild pro Szenario (visuelle Prüfung)
 *   docs/routing-gallery/README.md      Übersicht
 *
 * Aufruf: npm run routing:gallery
 *
 * Die Ausgabe ist deterministisch: gleiche Szenarien ⇒ byte-gleiche Dateien.
 * `routingGallery.test.ts` vergleicht die berechneten Pfade gegen
 * `gallery.json`. Ändert sich ein Pfad, schlägt der Test fehl — die Galerie
 * darf nur mit ausdrücklicher Begründung neu erzeugt werden (AGENTS.md K3).
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildOrthogonalPath,
  orthogonalWaypoints,
  type Point,
  type Rect,
  type Segment,
} from '../../components/edges/utils/orthogonalRouting';
import { ROUTING_SCENARIOS, manhattanDistance } from '../../components/edges/utils/routingScenarios';
import { segmentCrossesRect } from '../../components/edges/utils/orthogonalRouting';
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables } from '../../components/edges/utils/routeAll';

/** Referenzplan (R-8/R-10): vier Bauteile, Auto-Verdrahtung, dann Routing. */
function buildReferencePlan(): {
  nodes: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  cables: {
    id: string;
    label: string;
    waypoints: { x: number; y: number }[];
    path: string;
    length: number;
  }[];
  clearanceViolations: number;
} {
  const make = (
    id: string,
    type: string,
    position: { x: number; y: number },
    data: Record<string, unknown>
  ): unknown => ({ id, type, position, width: 192, height: 120, data });
  const nodes = [
    make('bat-1', 'battery', { x: 0, y: 0 }, { capacity: 100, chemistry: 'LiFePO4', label: 'Batterie' }),
    make('solar-1', 'solar', { x: 0, y: -400 }, { watts: 200, label: 'Solar' }),
    make('load-1', 'consumer', { x: 1200, y: 200 }, { watts: 60, label: 'Verbraucher 1' }),
    make('load-2', 'consumer', { x: 1200, y: 480 }, { watts: 120, label: 'Verbraucher 2' }),
  ] as Parameters<typeof performAutoWiring>[0];

  const wired = performAutoWiring(nodes, []);
  if (!wired) throw new Error('Auto-Verdrahtung des Referenzplans fehlgeschlagen');

  const routes = routeAllCables(
    wired.nodes,
    wired.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle }))
  );

  const rectOf = (id: string) => {
    const node = wired.nodes.find((n) => n.id === id)!;
    return { x: node.position.x, y: node.position.y, width: node.width ?? 192, height: node.height ?? 120 };
  };
  const clearOf = (r: { x: number; y: number; width: number; height: number }) => ({
    x: r.x - 12,
    y: r.y - 12,
    width: r.width + 24,
    height: r.height + 24,
  });
  const segHit = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    r: { x: number; y: number; width: number; height: number }
  ) => (a.x !== b.x || a.y !== b.y) && segmentCrossesRect(a, b, r);

  let clearanceViolations = 0;
  const cables = wired.edges.map((edge) => {
    const route = routes.get(edge.id);
    if (!route) throw new Error(`Keine Route für ${edge.id}`);
    const label = (edge.data as { label?: string } | undefined)?.label ?? `${edge.source} → ${edge.target}`;
    const wps = route.waypoints;
    for (let i = 1; i < wps.length; i++) {
      for (const other of wired.nodes) {
        if (other.id === edge.source || other.id === edge.target) continue;
        if (segHit(wps[i - 1]!, wps[i]!, clearOf(rectOf(other.id)))) clearanceViolations += 1;
      }
    }
    return {
      id: edge.id,
      label,
      waypoints: wps,
      path: route.path,
      length: Math.round(route.length * 100) / 100,
    };
  });

  const planNodes = wired.nodes.map((n) => ({
    id: n.id,
    label: String((n.data as { label?: string }).label ?? n.id),
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 192,
    height: n.height ?? 120,
  }));

  return { nodes: planNodes, cables, clearanceViolations };
}

const OUT_DIR = resolve(process.cwd(), 'docs', 'routing-gallery');
const PADDING = 60;

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function extend(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function boundsOf(waypoints: Point[], obstacles: Rect[], wires: Segment[]): Bounds {
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const point of waypoints) extend(bounds, point.x, point.y);
  for (const rect of obstacles) {
    extend(bounds, rect.x, rect.y);
    extend(bounds, rect.x + rect.width, rect.y + rect.height);
  }
  for (const [a, b] of wires) {
    extend(bounds, a.x, a.y);
    extend(bounds, b.x, b.y);
  }
  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  return bounds;
}

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderSvg(scenarioIndex: number): string {
  const scenario = ROUTING_SCENARIOS[scenarioIndex];
  if (!scenario) throw new RangeError(`ROUTING_SCENARIOS ohne Index ${scenarioIndex}`);
  const { waypoints } = orthogonalWaypoints(scenario.input);
  const { path } = buildOrthogonalPath(scenario.input);
  const obstacles = scenario.input.obstacles ?? [];
  const wires = scenario.input.crossingSegments ?? [];

  const bounds = boundsOf(waypoints, obstacles, wires);
  const width = bounds.maxX - bounds.minX + PADDING * 2;
  const height = bounds.maxY - bounds.minY + PADDING * 2 + 40;
  const viewBox = `${bounds.minX - PADDING} ${bounds.minY - PADDING - 40} ${width} ${height}`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${Math.round(width)}" height="${Math.round(height)}" role="img" aria-label="${escapeXml(scenario.title)}">`
  );
  parts.push('  <rect x="-100000" y="-100000" width="200000" height="200000" fill="#0f172a"/>');
  parts.push(
    `  <text x="${bounds.minX - PADDING + 12}" y="${bounds.minY - PADDING - 12}" fill="#e2e8f0" font-family="monospace" font-size="16">${escapeXml(`${scenario.id} — ${scenario.title}`)}</text>`
  );

  for (const [a, b] of wires) {
    parts.push(
      `  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#475569" stroke-width="2" stroke-dasharray="6 6"/>`
    );
  }

  for (const rect of obstacles) {
    parts.push(
      `  <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="#1e293b" stroke="#64748b" stroke-width="2" rx="8"/>`
    );
  }

  if (path) {
    parts.push(`  <path d="${path}" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`);
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (!first || !last) throw new Error(`Szenario ${scenario.id} lieferte keine Wegpunkte`);
  parts.push(`  <circle cx="${first.x}" cy="${first.y}" r="7" fill="#22c55e"/>`);
  parts.push(`  <circle cx="${last.x}" cy="${last.y}" r="7" fill="#f97316"/>`);
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function renderPlanSvg(plan: ReturnType<typeof buildReferencePlan>): string {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const node of plan.nodes) {
    extend(bounds, node.x, node.y);
    extend(bounds, node.x + node.width, node.y + node.height);
  }
  for (const cable of plan.cables) {
    for (const p of cable.waypoints) extend(bounds, p.x, p.y);
  }
  const width = bounds.maxX - bounds.minX + PADDING * 2;
  const height = bounds.maxY - bounds.minY + PADDING * 2 + 40;
  const viewBox = `${bounds.minX - PADDING} ${bounds.minY - PADDING - 40} ${width} ${height}`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${Math.round(width)}" height="${Math.round(height)}" role="img" aria-label="Nutzerplan: Auto-Verdrahtung">`
  );
  parts.push('  <rect x="-100000" y="-100000" width="200000" height="200000" fill="#0f172a"/>');
  parts.push(
    `  <text x="${bounds.minX - PADDING + 12}" y="${bounds.minY - PADDING - 12}" fill="#e2e8f0" font-family="monospace" font-size="16">nutzerplan-autowire — 12-px-Freigabe</text>`
  );

  for (const cable of plan.cables) {
    parts.push(
      `  <path d="${cable.path}" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`
    );
  }

  for (const node of plan.nodes) {
    parts.push(
      `  <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="#1e293b" stroke="#64748b" stroke-width="2" rx="8"/>`
    );
    parts.push(
      `  <text x="${node.x + 12}" y="${node.y + 28}" fill="#e2e8f0" font-family="monospace" font-size="14">${escapeXml(node.label)}</text>`
    );
  }

  for (const cable of plan.cables) {
    const first = cable.waypoints[0];
    const last = cable.waypoints[cable.waypoints.length - 1];
    if (!first || !last) continue;
    parts.push(`  <circle cx="${first.x}" cy="${first.y}" r="6" fill="#22c55e"/>`);
    parts.push(`  <circle cx="${last.x}" cy="${last.y}" r="6" fill="#f97316"/>`);
  }

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // Alte Dateien entfernen, damit gelöschte Szenarien keine Leichen hinterlassen.
  for (const file of readdirSync(OUT_DIR)) {
    if (file.endsWith('.svg')) unlinkSync(join(OUT_DIR, file));
  }

  const entries = ROUTING_SCENARIOS.map((scenario, index) => {
    const { waypoints, crossings } = orthogonalWaypoints(scenario.input);
    const { path, labelX, labelY } = buildOrthogonalPath(scenario.input);
    writeFileSync(join(OUT_DIR, `${scenario.id}.svg`), renderSvg(index));

    const length = waypoints.reduce((total, point, i) => {
      const previous = i > 0 ? waypoints[i - 1] : undefined;
      if (!previous) return total;
      return total + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0);

    return {
      id: scenario.id,
      title: scenario.title,
      obstacleFree: scenario.obstacleFree,
      exception: scenario.exception ?? null,
      waypoints,
      path,
      crossings,
      label: { x: labelX, y: labelY },
      length: Math.round(length * 100) / 100,
      manhattan: manhattanDistance(scenario.input),
    };
  });

  // Nutzerplan-Sektion (R-11): der Auto-Verdrahtungs-Referenzplan, mit dem
  // jetzigen Router geroutet — „nachher“-Referenz für reale Pläne.
  const plan = buildReferencePlan();
  writeFileSync(join(OUT_DIR, 'nutzerplan-autowire.svg'), renderPlanSvg(plan));
  writeFileSync(
    join(OUT_DIR, 'gallery.json'),
    `${JSON.stringify({ scenarios: entries, plans: [{ id: 'nutzerplan-autowire', ...plan }] }, null, 2)}\n`
  );

  const rows = entries
    .map(
      (entry) =>
        `| \`${entry.id}\` | ${entry.title} | ${entry.waypoints.length} | ${entry.length} | ${entry.manhattan} | ${entry.obstacleFree ? 'ja' : `nein — ${entry.exception}`} |`
    )
    .join('\n');

  const planSummary = `${plan.cables.length} Kabel, Gesamtlänge ${Math.round(
    plan.cables.reduce((sum, cable) => sum + cable.length, 0)
  )} px, ${plan.clearanceViolations} Clearance-Verstöße (Ziel: 0 bei 12 px).`;

  const readme = `# Routing-Galerie

Automatisch erzeugt von \`npm run routing:gallery\` aus
\`components/edges/utils/routingScenarios.ts\`. **Nicht von Hand bearbeiten.**

Jedes SVG zeigt eine Szene: dunkle Kästen sind Hindernisse (Bauteile),
gestrichelte Linien sind fremde Leitungen, die hellblaue Linie ist die
gerechnete Route. Grün = Start, Orange = Ziel.

\`gallery.json\` ist die Referenz für den Regressionstest
\`components/edges/utils/routingGallery.test.ts\`. Ändert sich ein Pfad,
schlägt der Test fehl. Die Galerie darf nur neu erzeugt werden, wenn die
Änderung im Pull Request begründet ist (AGENTS.md K3).

## Nutzerpläne

Zusätzlich zu den 25 konstruierten Szenarien zeigt
\`nutzerplan-autowire.svg\` einen realen Nutzerplan (Batterie, Solar,
zwei Verbraucher) nach Auto-Verdrahtung (R-8) und Routing (R-5/R-7/
R-10): ${planSummary}
Er ist die „nachher“-Referenz für die Vorher/Nachher-Betrachtung des
R-Blocks; die „vorher“-Zahlen stehen in \`docs/ROUTING-INVARIANTS.md\`
(Abschnitt Qualität & Messung).

| ID | Szenario | Wegpunkte | Länge | Manhattan | Hindernisfrei |
|----|----------|-----------|-------|-----------|---------------|
${rows}
`;
  writeFileSync(join(OUT_DIR, 'README.md'), readme);

  console.log(`Routing-Galerie erzeugt: ${entries.length} Szenarien in ${OUT_DIR}`);
}

main();
