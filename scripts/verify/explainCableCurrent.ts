/**
 * scripts/verify/explainCableCurrent.ts — ANTWORT-MASCHINE für den 158,7-A-Fall.
 *
 * Beantwortet am echten Modell (nicht in Prosa ausgedacht):
 *
 *   1. Warum hat dieses Kabel 158,7 A?
 *   2. Welche Verbraucher erzeugen diesen Strom?
 *   3. Warum fließt dieser Strom genau über dieses Kabel?
 *   4. Wie wird I_z berechnet?
 *   5. Warum ist das Kabel zu klein?
 *   6. Ist das ein echter Sicherheitsfehler oder fehlen Daten?
 *
 * Aufruf: `npx tsx scripts/verify/explainCableCurrent.ts`
 */
import { calculateCableIz } from '../../lib/electrical';
import { verifyPlan } from '../../lib/verify/pipeline';
import { evaluateCableProtection } from '../../lib/electrical';
import { computeCableCurrents, explainCableCurrent } from '../../lib/electricalGraph/currentFlow';
import { validation158RegressionPlan, VALIDATION158_EDGE_ID } from '../../lib/verify/validation158Fixture';

const plan = validation158RegressionPlan();
const model = computeCableCurrents({ nodes: plan.nodes, edges: plan.edges });
const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });

const labels = new Map(plan.nodes.map((node) => [node.id, String(node.data.label ?? node.id)]));
const cable = plan.edges.find((edge) => edge.id === VALIDATION158_EDGE_ID);
if (!cable) throw new Error(`Kante ${VALIDATION158_EDGE_ID} fehlt`);

const explanation = model.byEdgeId.get(cable.id);
const iz = calculateCableIz({
  crossSectionMm2: cable.data?.crossSection as number,
  ambientC: 30,
  insulation: 'PVC',
  bundledCircuits: 1,
});
const ib = explanation?.operatingCurrent ?? null;
const protection = evaluateCableProtection({ ib, in: cable.data?.fuseSize ?? null, iz: iz.correctedIz });
const ampacityFindings = report.events.filter((event) => event.ruleId === 'AMP-001-ib-in-iz');

console.log('=== 1. Warum hat dieses Kabel 158,7 A? ===');
console.log(explainCableCurrent(model, cable.id, labels));
console.log(`\nAufteilung: ${explanation?.splitMethod} (${explanation?.splitConfidence})`);
console.log(`Flussrichtung: ${explanation?.flowDirection} — Pfad: ${explanation?.path.join(' → ')}`);

console.log('\n=== 2. Welche Verbraucher erzeugen diesen Strom? ===');
for (const contribution of explanation?.contributingLoads ?? []) {
  console.log(
    `  ${contribution.label} (${contribution.componentId}): ${contribution.contribution.toFixed(2)} A von ${contribution.current.toFixed(2)} A`
  );
}

console.log('\n=== 3. Warum fließt dieser Strom genau über dieses Kabel? ===');
console.log(
  `  ${labels.get(cable.source)} → ${labels.get(cable.target)}, Querschnitt ${cable.data?.crossSection} mm², Länge ${cable.data?.length} m.`
);
console.log(
  '  Der Hauptstrang trägt die Summe aller Lasten, die hinter ihm (auf der Plus- bzw. Minusseite) versorgt werden —'
);
console.log('  Abzweige hinter der Fuse Box tragen NUR ihre eigene Last.');

console.log('\n=== 4. Wie wird I_z berechnet? ===');
console.log(`  ${iz.explanation}`);
console.log(`  Quelle: ${iz.source} · Vertrauen: ${iz.confidence}`);

console.log('\n=== 5. Warum ist das Kabel zu klein? ===');
console.log(`  ${protection.explanation}`);
console.log(
  `  Zustand: ${protection.status} · Schwere: ${protection.severity} · Verletzungen: ${protection.violations.join(', ') || '—'}`
);

console.log('\n=== 6. Echter Sicherheitsfehler oder fehlende Daten? ===');
for (const event of ampacityFindings) {
  console.log(`  [${event.severity}/${event.kind}] ${event.entity.id}: ${event.message}`);
}
const gaps = report.events.filter((event) => event.kind === 'UNVERIFIABLE');
console.log(
  `  Datenlücken im Bericht: ${gaps.length}; kritische Verletzungen: ${report.stateCounts.critical}`
);
console.log(
  `  Ursachen: ${report.rootCauses.map((cause) => `${cause.rootCauseId} (${cause.affectedEdges.join(', ')})`).join(' | ')}`
);
