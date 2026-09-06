import type { ScenarioLayout } from './layout';
import type { RegressionScenario } from './scenarios';

/**
 * WP-11 (#400): Deterministisches SVG-Rendering der Regressions-Szenarien.
 *
 * Visuelle Regression OHNE Browser: gleiche Eingabe ⇒ byte-gleiches SVG.
 * Die Dateien liegen eingecheckt in `docs/routing-regression/`;
 * `regression.test.ts` rendert sie neu und vergleicht byte-genau — das ist
 * die „deterministisch → keine flaky Tests"-Variante aus #400. Die
 * Playwright-Pixel-Baselines (tests/e2e/visual.spec.ts) sichern zusätzlich
 * die gebaute Planer-Route.
 */

const PADDING = 60;

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function renderScenarioSvg(scenario: RegressionScenario, layout: ScenarioLayout): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const extend = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const node of scenario.nodes) {
    extend(node.position.x, node.position.y);
    extend(node.position.x + (node.width || 192), node.position.y + (node.height || 120));
  }
  for (const edge of layout.edges) {
    for (const p of edge.waypoints) extend(p.x, p.y);
  }

  const width = maxX - minX + 2 * PADDING;
  const height = maxY - minY + 2 * PADDING;
  const tx = (x: number): number => x - minX + PADDING;
  const ty = (y: number): number => y - minY + PADDING;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`
  );
  lines.push(`  <title>${layout.id} — ${layout.title}</title>`);
  lines.push('  <rect width="100%" height="100%" fill="#0b0f14"/>');
  lines.push(
    `  <text x="${PADDING}" y="32" fill="#8b98a5" font-family="monospace" font-size="14">${layout.id}: X=${layout.metrics.crossings} Bends=${layout.metrics.bends} L=${fmt(layout.metrics.length)} Clearance=${layout.metrics.clearanceViolations}</text>`
  );
  for (const node of scenario.nodes) {
    const x = tx(node.position.x);
    const y = ty(node.position.y);
    lines.push(
      `  <rect x="${fmt(x)}" y="${fmt(y)}" width="${node.width || 192}" height="${node.height || 120}" fill="#151b23" stroke="#31404f" stroke-width="1.5" rx="8"/>`
    );
    lines.push(
      `  <text x="${fmt(x + 10)}" y="${fmt(y + 24)}" fill="#c7d0d9" font-family="monospace" font-size="13">${node.id}</text>`
    );
  }
  for (const edge of layout.edges) {
    const d = edge.waypoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(tx(p.x))} ${fmt(ty(p.y))}`)
      .join(' ');
    lines.push(`  <path d="${d}" fill="none" stroke="#39b2f5" stroke-width="2.5"/>`);
    const first = edge.waypoints[0];
    if (first) {
      lines.push(`  <circle cx="${fmt(tx(first.x))}" cy="${fmt(ty(first.y))}" r="4" fill="#39b2f5"/>`);
    }
  }
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;
}
