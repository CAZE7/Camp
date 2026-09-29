/**
 * lib/verify/pipeline.ts — DIE 5-PASS-PIPELINE der Verifikation.
 *
 *   PASS 1  Syntax & Konnektivität   (SYN-001…004)
 *   PASS 2  Domäne & Polarität       (DOM-001/002, TOPO-001…005)
 *   PASS 3  Ampazität & Schutz       (AMP-001…006)
 *   PASS 4  Spannungsfall & Energie  (VDR-001/002, PWR-001)
 *   PASS 5  Erdung & Personenschutz  (GND-001, RCD-001…006, NET-001/002)
 *
 * Eigenschaften, die dieser Orchestrator garantiert:
 *
 *   1. **Determinismus.** Gleiche Eingabe ⇒ gleiche Ereignisliste, gleiche
 *      Statusmatrix, gleicher Zertifikat-Hash. Alle Passes sortieren ihre
 *      Entities; die Pipeline sortiert die Ereignisse ein zweites Mal
 *      (`sortEvents`) und hasht eine kanonische Serialisierung.
 *   2. **Kein stiller Fallback.** Ein Pass, der seine Prüfung nicht
 *      abschließen kann, liefert `UNPROVABLE` — das Verdikt wird dann
 *      `INCOMPLETE`, niemals `COMPLIANT`. Ein leeres Regelprofil kann keinen
 *      grünen Bericht erzeugen: `skippedRules` und `limitations` stehen im
 *      Report, und `coverage.decisionRatio` zeigt die Entscheidungsquote.
 *   3. **Nachweis statt Behauptung.** `certificateHash` hasht Verdikt +
 *      Regel-Statusmatrix + Engine-Version; `planFingerprintHash` hasht den
 *      kanonisch serialisierten Plan. Zwei identische Läufe ergeben denselben
 *      Hash — ein anderer Hash sagt, dass sich Eingabe ODER Verdikt geändert
 *      hat.
 */

import type { Node } from '../domain/graph';

import {
  assumptionStatements,
  verificationOptions,
  type PassContext,
  type VerificationOptions,
} from './context';
import { buildConductionGraph, type PlanEdge } from './graph';
import { runPass1, runPass2 } from './topology';
import { runPass3 } from './ampacity';
import { runPass4 } from './powerPath';
import { runPass5 } from './protection';
import { rulesForContext } from './rules';
import { sortEvents } from './events';
import type {
  AuditEvent,
  CheckResult,
  CheckStatus,
  Coverage,
  PassNumber,
  PassResult,
  RuleId,
  VerificationCertificate,
  VerificationReport,
  VerificationVerdict,
} from './types';

/** Version der Engine — Bestandteil des Zertifikats. */
export const VERIFICATION_ENGINE_VERSION = 'camp-verify/1.0.0';

/** Eingabe eines Verifikationslaufs. */
export interface VerificationInput {
  nodes: readonly Node[];
  edges: readonly PlanEdge[];
  options?: Partial<VerificationOptions>;
}

/**
 * Modellgrenzen, die für JEDES Verdikt gelten. Sie stehen im Report, damit ein
 * `COMPLIANT` nicht als Freibrief für Nicht-Modelliertes gelesen wird.
 */
export const ENGINE_LIMITATIONS: readonly string[] = Object.freeze([
  'Das Modell ist EINLEITERIG: L/N/PE bzw. Plus/Minus sind als je eine Kante abgebildet, nicht als getrennte Leiter. Aussagen über einzelne Leiter (z. B. PEN-Führung) stützen sich auf deklarierte Felder.',
  'I_z stammt aus der Tabellenbasis des Planers (Verlegeart B2, 30 °C Referenz, PVC) mit den Korrekturfaktoren des Laufs. Verlegeart, Kabeltyp (FLRY/FLR2X), Kanal- oder Rohrverlegung sind nur über diese Faktoren abgebildet.',
  'Kurzschlussströme sind Schätzungen aus Batterie-Innenwiderstand (Chemie oder Datenblatt), reiner Parallelschaltung und 20 °C; Datenblattwerte des konkreten Aufbaus schlagen das Modell.',
  'Selektivität ohne I²t-Daten beider Geräte ist eine Verhältnis-Heuristik (≥ 1,6:1 für Sicherungen ab 16 A) — kein Normnachweis; die Norm fordert Herstellerangaben.',
  'Peukert-Exponenten und Entladetiefen sind Chemie-Faustwerte (UNVERIFIED) bzw. Datenblattfelder; BMS-Abschaltungen und Temperatureinflüsse auf die Kapazität sind nicht modelliert.',
  'Wärmetechnische Rückwirkungen (Kabelbündel im Kanal, Umgebung über 60 °C, Motorraum) sind über die Umgebungstemperatur und die Häufung des Laufs abgebildet — nicht als Feldfunktion.',
]);

/** FNV-1a 32 Bit (zwei Startwerte ⇒ 64 Bit Fingerabdruck, keine Krypto-Zusage). */
function fingerprint(text: string): string {
  const fnv = (seed: number): number => {
    let hash = seed;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };
  const low = fnv(0x811c9dc5).toString(16).padStart(8, '0');
  const high = fnv(0x811c9dc6).toString(16).padStart(8, '0');
  return `${low}${high}`;
}

/** Kanonische JSON-Form: sortierte Schlüssel, keine Funktions-/Zufallswerte. */
function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return 'null';
}

/** Hash der Prüfeingabe (Plan + Profil + Annahmen). */
export function planFingerprintHash(input: VerificationInput): string {
  const nodes = [...input.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => ({ id: node.id, type: node.type ?? null, data: node.data ?? {} }));
  const edges = [...input.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: edge.data ?? {},
    }));
  return fingerprint(canonical({ nodes, edges, options: input.options ?? {} }));
}

interface PassDefinition {
  pass: PassNumber;
  name: string;
  run: (context: PassContext) => CheckResult[];
}

const PASS_DEFINITIONS: readonly PassDefinition[] = Object.freeze([
  {
    pass: 1 as PassNumber,
    name: 'Syntax & Konnektivität',
    run: (context: PassContext): CheckResult[] => runPass1(context.graph),
  },
  {
    pass: 2 as PassNumber,
    name: 'Domäne, Polarität & Topologie',
    run: (context: PassContext): CheckResult[] => runPass2(context.graph),
  },
  { pass: 3 as PassNumber, name: 'Ampazität & Schutz', run: runPass3 },
  { pass: 4 as PassNumber, name: 'Spannungsfall & Energiebilanz', run: runPass4 },
  { pass: 5 as PassNumber, name: 'Erdung & Personenschutz', run: runPass5 },
]);

function passStatus(checks: readonly CheckResult[]): CheckStatus {
  if (checks.some((check) => check.status === 'FAIL')) return 'FAIL';
  if (checks.some((check) => check.status === 'UNPROVABLE')) return 'UNPROVABLE';
  return 'PASS';
}

function verdictOf(passes: readonly PassResult[]): VerificationVerdict {
  if (passes.some((pass) => pass.status === 'FAIL')) return 'NON_COMPLIANT';
  if (passes.some((pass) => pass.status === 'UNPROVABLE')) return 'INCOMPLETE';
  return 'COMPLIANT';
}

function coverageOf(checks: readonly CheckResult[], rulesApplied: number, rulesSkipped: number): Coverage {
  const notApplicable = checks.filter(
    (check) => check.status === 'PASS' && check.evaluatedEntities === 0
  ).length;
  const passed = checks.filter((check) => check.status === 'PASS').length - notApplicable;
  const failed = checks.filter((check) => check.status === 'FAIL').length;
  const unprovable = checks.filter((check) => check.status === 'UNPROVABLE').length;
  const exercised = checks.length - notApplicable;
  return {
    rulesApplied,
    rulesSkipped,
    checks: checks.length,
    exercised,
    notApplicable,
    passed,
    failed,
    unprovable,
    decisionRatio: exercised === 0 ? 0 : (passed + failed) / exercised,
  };
}

/**
 * Führt alle fünf Passes aus und erzeugt den Prüfbericht.
 *
 * @throws RangeError, wenn die Optionen unplausibel sind (z. B.
 *   Umgebungstemperatur über der Grenzleitertemperatur) — die Engine rechnet
 *   nicht mit Werten, die sie nicht verantworten kann.
 */
export function verifyPlan(input: VerificationInput): VerificationReport {
  const options = verificationOptions(input.options ?? {});
  const graph = buildConductionGraph(input.nodes, input.edges, { context: options.context });
  const context: PassContext = { nodes: input.nodes, edges: input.edges, graph, options };
  const { applied, skipped } = rulesForContext(options.profile, options.context);
  if (applied.length === 0) {
    // Kann nach der Validierung der Optionen nicht mehr eintreten; wenn doch,
    // ist die Regelmatrix inkonsistent — dann darf kein Bericht entstehen,
    // der wie ein grünes Ergebnis aussieht.
    throw new RangeError(
      `verifyPlan: das Profil ${options.profile} im Kontext ${options.context} führt keine einzige Regel aus — ein Bericht ohne Regeln wäre eine leere Zusage`
    );
  }
  const appliedIds = new Set<RuleId>(applied.map((rule) => rule.id));

  const passes: PassResult[] = [];
  const allChecks: CheckResult[] = [];
  for (const definition of PASS_DEFINITIONS) {
    const checks = definition
      .run(context)
      .filter((check) => appliedIds.has(check.ruleId))
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    allChecks.push(...checks);
    passes.push({
      pass: definition.pass,
      name: definition.name,
      status: passStatus(checks),
      checks,
    });
  }

  const events: AuditEvent[] = sortEvents(allChecks.flatMap((check) => [...check.events]));
  const verdict = verdictOf(passes);

  // Regeln, die zwar im Profil gelten, aber keine Entität gesehen haben
  // (z. B. AC-Regeln in einem reinen 12-V-Plan) — sie werden AUSGEWIESEN,
  // nicht als stille »passt schon«-Pässe verbucht.
  const domainEmpty = allChecks
    .filter((check) => check.status === 'PASS' && check.evaluatedEntities === 0)
    .map((check) => check.ruleId);
  const skippedRules = [...new Set<RuleId>([...skipped.map((rule) => rule.id), ...domainEmpty])].sort();

  const coverage = coverageOf(allChecks, applied.length, skippedRules.length);
  const certificate: VerificationCertificate = {
    planFingerprintHash: planFingerprintHash(input),
    certificateHash: fingerprint(
      canonical({
        engine: VERIFICATION_ENGINE_VERSION,
        verdict,
        profile: options.profile,
        context: options.context,
        statuses: allChecks.map((check) => `${check.ruleId}:${check.status}:${check.evaluatedEntities}`),
      })
    ),
    engineVersion: VERIFICATION_ENGINE_VERSION,
    profile: options.profile,
    context: options.context,
    decidedRules: coverage.passed + coverage.failed,
    totalRules: applied.length,
  };

  const limitations = [
    ...ENGINE_LIMITATIONS,
    ...assumptionStatements(options),
    ...(skipped.length > 0
      ? [`Nicht angewandt (Profil/Kontext): ${skipped.map((rule) => rule.id).join(', ')}.`]
      : []),
    ...(domainEmpty.length > 0
      ? [`Regeln ohne Eingabe im Plan (nicht geprüft, weil ihr Gegenstand fehlt): ${domainEmpty.join(', ')}.`]
      : []),
  ];

  return {
    verdict,
    passes,
    events,
    coverage,
    certificate,
    skippedRules,
    limitations,
  };
}

/**
 * Einzeilige Zusammenfassung für CLI/Log: Verdikt, Zählwerte, Zertifikat.
 * Die vollständige Ereignisliste liefert `formatEvent` (events.ts).
 */
export function formatReportSummary(report: VerificationReport): string[] {
  const lines = [
    `Verdikt: ${report.verdict} — ${report.coverage.exercised} Regeln ausgeführt, davon ${report.coverage.passed} PASS / ${report.coverage.failed} FAIL / ${report.coverage.unprovable} UNPROVABLE; ${report.coverage.notApplicable} nicht anwendbar (Profil ${report.certificate.profile}, Kontext ${report.certificate.context}).`,
    `Zertifikat: ${report.certificate.certificateHash} (Plan ${report.certificate.planFingerprintHash}), Engine ${report.certificate.engineVersion}.`,
  ];
  for (const pass of report.passes) {
    lines.push(`  PASS ${pass.pass} ${pass.name}: ${pass.status} (${pass.checks.length} Regeln)`);
  }
  if (report.skippedRules.length > 0) {
    lines.push(`  übersprungen/nicht anwendbar: ${report.skippedRules.join(', ')}`);
  }
  return lines;
}
