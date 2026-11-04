import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEMPLATE_AUTARK, TEMPLATE_KASTENWAGEN, TEMPLATE_MINIMALIST } from '@/components/planner/templates';
import { verificationReportFor } from '@/components/planner/utils/verificationWarnings';

/**
 * Engine-Baseline über alle Vorlagen und knownPlans.
 *
 * Entscheidung 4 aus der AP-2-Freigabe: „Die Ergebnisse der bestehenden
 * Referenzpläne müssen vor und nach der Migration identisch bleiben.“ Ein
 * Token-Paket darf die Elektrik nicht bewegen — behaupten kann das niemand aus
 * dem Diff, gemessen wird es hier.
 *
 * Genommen wird auch `evaluatedEntities` pro Check: die Engine zählt eine Regel
 * mit Status PASS und null Gegenständen als „nicht anwendbar“, nicht als
 * erfüllt. Genau diese Zählung trägt die Korrektur im Prüfsiegel.
 *
 * Nutzung:  npx tsx scripts/design-audit/baseline-verification.ts <name>
 * Output:   scripts/design-audit/ergebnis/baseline-<name>.json
 */

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx tsx scripts/design-audit/baseline-verification.ts <name>');
  process.exit(1);
}
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');

const VORLAGEN: ReadonlyArray<readonly [string, { nodes: readonly unknown[]; edges: readonly unknown[] }]> = [
  ['minimalist', TEMPLATE_MINIMALIST],
  ['kastenwagen', TEMPLATE_KASTENWAGEN],
  ['autark', TEMPLATE_AUTARK],
];

interface PlanErgebnis {
  verdict: string;
  coverage: unknown;
  certificateHash: string;
  planFingerprintHash: string;
  stateCounts: unknown;
  knoten: number;
  kanten: number;
  passes: Array<{
    pass: number;
    status: string;
    checks: Array<{ ruleId: string; status: string; entities: number; events: number }>;
  }>;
  skippedRules: readonly string[];
  limitations: string[];
}

function abnehmen(nodes: readonly unknown[], edges: readonly unknown[]): PlanErgebnis {
  const report = verificationReportFor(nodes as never, edges as never);
  return {
    verdict: report.verdict,
    coverage: report.coverage,
    certificateHash: report.certificate.certificateHash,
    planFingerprintHash: report.certificate.planFingerprintHash,
    stateCounts: report.stateCounts,
    knoten: nodes.length,
    kanten: edges.length,
    passes: report.passes.map((pass) => ({
      pass: pass.pass,
      status: pass.status,
      checks: pass.checks.map((check) => ({
        ruleId: check.ruleId,
        status: check.status,
        entities: check.evaluatedEntities,
        events: check.events.length,
      })),
    })),
    skippedRules: report.skippedRules,
    limitations: (report.limitations ?? []).map((text) => text.slice(0, 120)),
  };
}

// knownPlans kann Pläne mit anderer Knotenform enthalten; die Prüfung ist
// bewusst separat, damit ein Formfehler hier laut wird und nicht als
// „Ergebnis identisch“ durchgeht.
function abmitPruefung(nodes: readonly unknown[], edges: readonly unknown[]): PlanErgebnis {
  if (nodes.length === 0) throw new Error('Plan ohne Knoten — Form geändert, Messung wertlos');
  return abnehmen(nodes, edges);
}

const vorlagen: Record<string, PlanErgebnis> = {};
for (const [key, vorlage] of VORLAGEN) {
  vorlagen[key] = abnehmen(vorlage.nodes, vorlage.edges);
  console.log(key.padEnd(14), vorlagen[key]?.verdict, JSON.stringify(vorlagen[key]?.coverage));
}

const knownPlans: Record<string, PlanErgebnis> = {};
for (const datei of fs.readdirSync('knownPlans').filter((f) => f.endsWith('.json'))) {
  const inhalt: unknown = JSON.parse(fs.readFileSync(path.join('knownPlans', datei), 'utf8'));
  if (typeof inhalt !== 'object' || inhalt === null) continue;
  const plan = inhalt as Record<string, unknown>;
  const eingabe = (plan.input ?? plan) as Record<string, unknown>;
  const nodes = Array.isArray(eingabe.nodes) ? eingabe.nodes : [];
  const edges = Array.isArray(eingabe.edges) ? eingabe.edges : [];
  knownPlans[datei] = abmitPruefung(nodes, edges);
  console.log(
    ('  ' + datei).padEnd(20),
    knownPlans[datei]?.verdict,
    JSON.stringify(knownPlans[datei]?.coverage)
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const datei = path.join(OUT_DIR, `baseline-${name}.json`);
fs.writeFileSync(
  datei,
  JSON.stringify({ erfasst: new Date().toISOString(), bezug: 'AP-2 Messlauf', vorlagen, knownPlans }, null, 1)
);
console.log(`\ngeschrieben: ${path.relative(process.cwd(), datei)}`);
