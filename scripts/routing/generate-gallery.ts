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

  writeFileSync(join(OUT_DIR, 'gallery.json'), `${JSON.stringify({ scenarios: entries }, null, 2)}\n`);

  const rows = entries
    .map(
      (entry) =>
        `| \`${entry.id}\` | ${entry.title} | ${entry.waypoints.length} | ${entry.length} | ${entry.manhattan} | ${entry.obstacleFree ? 'ja' : `nein — ${entry.exception}`} |`
    )
    .join('\n');

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

| ID | Szenario | Wegpunkte | Länge | Manhattan | Hindernisfrei |
|----|----------|-----------|-------|-----------|---------------|
${rows}
`;
  writeFileSync(join(OUT_DIR, 'README.md'), readme);

  console.log(`Routing-Galerie erzeugt: ${entries.length} Szenarien in ${OUT_DIR}`);
}

main();
