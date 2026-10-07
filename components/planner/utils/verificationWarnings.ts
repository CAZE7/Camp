import type { Node } from '../../../lib/domain/graph';
import {
  isCoverageEvent,
  rulesForContext,
  ruleSpec,
  validationSeverityOf,
  validationStatusOf,
  verifyPlan,
  type AuditEvent,
  type PassNumber,
  type VerificationReport,
  type VerificationVerdict,
} from '../../../lib/verify';

import type { CableEdgeData } from '../../../lib/domain/cableEdgeData';
import type { Edge } from '@xyflow/react';
import type { ValidationWarning } from '../hooks/useLiveValidation';

/**
 * components/planner/utils/verificationWarnings.ts — ÜBERSETZUNG DER
 * VERIFIKATIONS-ENGINE IN DIE ANZEIGE.
 *
 * Diese Datei rechnet NICHTS Elektrisches (ARCH-Regel D): Sie ruft die Engine
 * (lib/verify) auf und übersetzt deren Befunde in die Ansichtsform, die
 * Warn-Zentrale und Prüfsiegel kennen. Jede Zahl, jeder Grenzwert und jeder
 * Reparaturvorschlag stammt aus dem Ereignis der Engine — hier wird nur
 * formatiert, gruppiert und beschriftet.
 *
 * Zwei Dinge sind bewusst NICHT hier:
 *
 *   1. **Keine eigenen Regeln.** Was die Engine nicht prüft, prüft diese
 *      Datei auch nicht; was sie prüft, wird hier nicht nachgerechnet.
 *   2. **Keine Ersatzwerte.** Der Plan wird 1:1 übergeben. Eine fehlende
 *      Länge bleibt fehlend und wird als UNPROVABLE ausgewiesen — die Engine
 *      füllt sie nicht aus der Geometrie auf (Regel M: keine stille Annahme).
 *      Genau deshalb steht im Bericht, was fehlt, statt dass ein plausibler
 *      Wert entsteht.
 */

/**
 * Laufannahmen der Planer-Anzeige: Praxisprofil (schließt die
 * Planungsvorgaben des Camp-Modells ein) im Kontext Fahrzeug. Beide Werte
 * sind Filter über die Herkunftsstufen der Regeln — der Bericht nennt sie
 * namentlich, damit ein »COMPLIANT« nicht als Aussage über ein anderes
 * Profil gelesen wird.
 */
export const PLANNER_VERIFICATION_OPTIONS = { profile: 'PRACTICE', context: 'VEHICLE' } as const;

/** Vollständiger Prüfbericht für den aktuellen Plan (reine Funktion). */
export function verificationReportFor(
  nodes: readonly Node[],
  edges: readonly Edge<CableEdgeData>[]
): VerificationReport {
  return verifyPlan({ nodes, edges, options: { ...PLANNER_VERIFICATION_OPTIONS } });
}

const PROVENANCE_LABEL: Record<AuditEvent['provenance'], string> = {
  VERIFIED_NORM: 'Norm',
  VERIFIED_DATASHEET: 'Datenblatt',
  DERIVED: 'abgeleitet',
  MODEL_ASSUMPTION: 'Modellannahme',
  UNVERIFIED: 'nicht belegt',
};

/**
 * Zahl für die Anzeige — deutsches Komma, höchstens zwei Nachkommastellen,
 * ohne nachlaufende Nullen. Bewusst nicht `toLocaleString`: Die Anzeige soll
 * unabhängig von der ICU-Ausgabe der Laufzeit stabil bleiben (Tests, SSR).
 */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return fixed.replace('.', ',');
}

/** Anzeigetext eines Werts, der auch fehlen darf. */
function formatValue(value: number | null): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : undefined;
}

/**
 * Übersetzt ein Audit-Ereignis in einen Befund der Warn-Zentrale.
 *
 * Die Einordnung (kritisch/Warnung/Hinweis) folgt der Schwere des Ereignisses,
 * nicht dem Regelnamen: Ein UNVERIFIABLE-Ereignis ist ein **Hinweis über eine
 * Datenlücke** — es als kritisch zu zeigen würde eine Verletzung behaupten,
 * die die Engine gerade nicht behauptet. Umgekehrt bleiben CODE_VIOLATION und
 * CRITICAL_SAFETY ohne Abschwächung.
 */
export function verificationWarning(event: AuditEvent, index: number): ValidationWarning {
  const spec = ruleSpec(event.ruleId);
  const isGap = event.kind === 'UNVERIFIABLE';
  const type: ValidationWarning['type'] = isGap
    ? 'info'
    : event.severity === 'CRITICAL_SAFETY'
      ? 'critical'
      : 'warning';
  const category: ValidationWarning['category'] =
    isGap || event.severity === 'EFFICIENCY_WARNING' ? 'estimation' : 'safety';

  const focusType =
    event.entity.kind === 'node' || event.entity.kind === 'edge' ? event.entity.kind : undefined;
  const prefix = type === 'critical' ? '⚠️ Kritisch: ' : type === 'warning' ? '⚠️ Warnung: ' : 'ℹ️ Hinweis: ';
  // Norm, Klausel und Herkunft kommen aus DEM EREIGNIS: Es ist der Beleg, den
  // die Engine erzeugt hat (die Regelmatrix ist nur seine Quelle). Die Klausel
  // wird nicht angehängt, wenn sie schon im Normtext steht — doppelt genannt
  // läse es sich wie zwei Belege für dieselbe Stelle.
  const clause = event.clause !== null && !event.standard.includes(event.clause) ? ` ${event.clause}` : '';

  return {
    id: `verify-${event.ruleId}-${event.entity.kind}-${event.entity.id}-${index}`,
    category,
    type,
    title: spec.title,
    ...(focusType ? { focusId: event.entity.id, focusType } : {}),
    ruleId: event.ruleId,
    // Nutzer-Vokabular (Auftrag Phase 9): Schwere und Zustand kommen aus der
    // EINEN Projektion der Engine; hier wird nichts neu bewertet.
    severity: validationSeverityOf(event),
    status: validationStatusOf(event),
    ...(typeof event.details?.rootCauseId === 'string' ? { rootCauseId: event.details.rootCauseId } : {}),
    measuredValue: formatValue(event.calculatedValue),
    expectedValue: formatValue(event.allowedLimit),
    unit: event.unit,
    source: `${event.standard}${clause} (${PROVENANCE_LABEL[event.provenance]})`,
    remedy: event.autoFixRemedy,
    // Nur bei einer Lücke gesetzt: „false“ wäre in der Ansicht ein stiller
    // Gegensatz zu „geprüft“, obwohl es nur „Befund, keine Lücke“ heißt.
    ...(isGap ? { unverified: true } : {}),
    // Strukturierte Details (Ib/In/Iz, contributors, Iz-Faktoren) — Grundlage
    // der Wertzeile und des „Warum?\" in der Warn-Zentrale.
    ...(event.details ? { details: event.details } : {}),
    message: `${prefix}${event.message}`,
  };
}

/**
 * Alle Befunde des Berichts als Warnungen (deterministische Reihenfolge).
 *
 * **Abdeckungs-Ereignisse werden gefiltert** („Regel hatte keine Eingabe“):
 * Sie melden nichts über ein Bauteil, sondern zählen, was die Engine NICHT
 * prüfen konnte. Ein leerer Plan erzeugte sonst sieben Hinweise, die niemand
 * beheben kann; dieselbe Aussage steht vollständig im Prüfsiegel (Abdeckung +
 * Modellgrenzen), und das Verdikt bleibt INCOMPLETE (nicht bestanden).
 */
export function verificationWarnings(report: VerificationReport): ValidationWarning[] {
  return report.events
    .filter((event) => !isCoverageEvent(event))
    .map((event, index) => verificationWarning(event, index));
}

/** Anzeige-Zustand des Prüfsiegels. */
export interface VerificationSummary {
  verdict: VerificationVerdict;
  /** Klartext des Verdikts. */
  label: string;
  /** Ampelfarbe für das Siegel. */
  tone: 'ok' | 'warn' | 'bad';
  headline: string;
  exercised: number;
  notApplicable: number;
  passed: number;
  failed: number;
  unprovable: number;
  /** Anteil entschiedener Regeln an den ausgeführten (0…1). */
  decisionRatio: number;
  certificateHash: string;
  planFingerprintHash: string;
  engineVersion: string;
  profile: string;
  context: string;
  passes: Array<{
    pass: PassNumber;
    name: string;
    status: 'PASS' | 'FAIL' | 'UNPROVABLE';
    ruleCount: number;
  }>;
  /**
   * Regeln, die **Profil oder Kontext** ausschließen (z. B. AC-Regeln in einem
   * reinen 12-V-Fahrzeug). Nicht zu verwechseln mit `limitations`: Dort stehen
   * zusätzlich die Regeln, die zwar gelten, aber im Plan keinen Gegenstand
   * hatten — die sind »nicht geprüft«, nicht »nicht angewandt«.
   */
  notAppliedRules: readonly string[];
  limitations: readonly string[];
  /** Befunde, die der Nutzer beheben muss (FAIL vor UNPROVABLE). */
  findings: ValidationWarning[];
}

/**
 * Kennzahlen und Klartext für das Prüfsiegel.
 *
 * Der Text sagt ausdrücklich, WAS das Verdikt nicht bedeutet: »Compliant«
 * heißt »gegen die angewandten Regeln entschieden bestanden« — nicht »geprüft«
 * schlechthin. Die Zahl der nicht anwendbaren Regeln und die Modellgrenzen
 * stehen deshalb im selben Objekt wie das Verdikt.
 */
export function verificationSummary(report: VerificationReport): VerificationSummary {
  const coverage = report.coverage;
  const verdict = report.verdict;
  const label =
    verdict === 'COMPLIANT'
      ? 'Bestanden'
      : verdict === 'INCOMPLETE'
        ? 'Unvollständig belegt'
        : 'Nicht bestanden';
  const tone: VerificationSummary['tone'] =
    verdict === 'COMPLIANT' ? 'ok' : verdict === 'INCOMPLETE' ? 'warn' : 'bad';

  const findings = verificationWarnings(report);
  const severityRank = (warning: ValidationWarning): number =>
    warning.type === 'critical' ? 0 : warning.type === 'warning' ? 1 : 2;
  findings.sort((a, b) => severityRank(a) - severityRank(b) || a.id.localeCompare(b.id));

  const headline =
    verdict === 'COMPLIANT'
      ? `Gegen die ${coverage.exercised} angewandten Regeln bestehen die geprüften Punkte. ${coverage.notApplicable} Regeln hatten im Plan keinen Gegenstand.`
      : verdict === 'INCOMPLETE'
        ? `${coverage.unprovable} Regel(n) sind ohne weitere Angaben nicht entscheidbar — der Plan gilt damit nicht als geprüft.`
        : `${coverage.failed} Regel(n) sind verletzt; ${coverage.unprovable} weitere sind nicht entscheidbar.`;

  return {
    verdict,
    label,
    tone,
    headline,
    exercised: coverage.exercised,
    notApplicable: coverage.notApplicable,
    passed: coverage.passed,
    failed: coverage.failed,
    unprovable: coverage.unprovable,
    decisionRatio: coverage.decisionRatio,
    certificateHash: report.certificate.certificateHash,
    planFingerprintHash: report.certificate.planFingerprintHash,
    engineVersion: report.certificate.engineVersion,
    profile: report.certificate.profile,
    context: report.certificate.context,
    passes: report.passes.map((pass) => ({
      pass: pass.pass,
      name: pass.name,
      status: pass.status,
      ruleCount: pass.checks.length,
    })),
    notAppliedRules: rulesForContext(report.certificate.profile, report.certificate.context).skipped.map(
      (rule) => rule.id
    ),
    limitations: report.limitations,
    findings,
  };
}
