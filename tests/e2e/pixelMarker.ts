/**
 * Einzige Quelle für die Kennzeichnung von Pixel-Vergleichen.
 *
 * `quality.yml` trennt mit diesem Text zwei Läufe: der blockierende E2E-Job
 * (`--grep-invert`) fährt die funktionalen Szenarien, der meldende visuelle Job
 * (`--grep`, `continue-on-error`) die Pixelvergleiche. Ein Titel ohne diese
 * Kennzeichnung landet also im blockierenden Lauf und kann den Deploy stoppen —
 * worauf `scripts/ci/e2eGatePartition.test.ts` prüft, dass Titel und Workflow
 * nicht auseinanderdriften.
 */
export const PIXEL_MARKER = 'hält die Baseline';
