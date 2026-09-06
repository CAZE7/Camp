import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GOLDEN_PLANS } from './plans';
import { captureGoldenMaster, stableStringify } from './pipeline';

/**
 * WP-0b (#402): Capture-Skript des Golden Masters.
 *
 * Erzeugt `knownPlans/<name>.json` für alle sechs Referenzpläne mit dem
 * AKTUELLEN System. Aufruf:
 *
 *   npm run goldenmaster:capture
 *
 * Regeln:
 * - Nur bewusst ausführen — jede Neuerfassung überschreibt die Baseline und
 *   braucht eine Begründung im PR + Eintrag im Change Ledger
 *   (`docs/ARCHITECTURE-CHANGES.md`).
 * - Der Diff gegen die Fixtures läuft in der Vitest-Suite
 *   (`scripts/goldenmaster/goldenMaster.test.ts`, Teil von `npm test`).
 */

const outDir = resolve(process.cwd(), 'knownPlans');
mkdirSync(outDir, { recursive: true });

for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
  const master = captureGoldenMaster(plan);
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, stableStringify(master), 'utf8');
  const edges = Object.keys(master.routing).length;
  console.log(
    `✓ ${name}.json — ${master.autoWire.nodes.length} Nodes, ${master.autoWire.edges.length} Kanten, ${edges} Routen`
  );
}

console.log(`\nGolden Master → ${outDir}`);
