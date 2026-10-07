/**
 * lib/verify/events.ts — Erzeugung und Bewertung normativer Audit-Events.
 *
 * Jeder Befund der Engine entsteht HIER. Damit ist strukturell garantiert,
 * dass ein Event Norm, Klausel, Herkunft, Formel und Remediation trägt — es
 * gibt keinen Pfad, der „nur eine Meldung“ erzeugt. `auditEvent` liest die
 * Herkunft aus der Regelmatrix (`ruleSpec`), nicht aus dem Aufrufer: Ein
 * Prüfcode kann die Normgrundlage nicht versehentlich falsch etikettieren.
 *
 * „No Silent Fallback“ (Regel M) auf Ereignisebene:
 *   - `checkFromEvents` leitet den Status AUS den Ereignissen ab:
 *       ≥ 1 VIOLATION     → FAIL
 *       sonst ≥ 1 UNVERIFIABLE → UNPROVABLE
 *       sonst             → PASS
 *     Ein leerer Befund ist damit ein bestandener Test — aber nur, wenn die
 *     Prüfung tatsächlich Entitäten betrachtet hat (`evaluatedEntities`). Eine
 *     Prüfung ohne Eingaben meldet UNPROVABLE, nicht PASS.
 */

import {
  FINDING_KINDS,
  SEVERITY_ORDER,
  type AuditEvent,
  type AuditEventDetails,
  type CheckResult,
  type CheckStatus,
  type EntityRef,
  type FindingKind,
  type RuleId,
  type VerificationSeverity,
} from './types';
import { ruleSpec } from './rules';

/** Eingabe zur Erzeugung eines Audit-Events. */
export interface AuditEventInput {
  ruleId: RuleId;
  entity: EntityRef;
  /** Override der Schwere (z. B. kritische Stufe innerhalb einer Regel). */
  severity?: VerificationSeverity;
  /** Override der Befundart. */
  kind?: FindingKind;
  /** Berechneter Ist-Wert in `unit` (oder null). */
  calculatedValue?: number | null;
  /** Grenzwert in `unit` (oder null). */
  allowedLimit?: number | null;
  unit?: string;
  message: string;
  autoFixRemedy: string;
  counterexample?: readonly string[];
  /** Strukturierte Befund-Details (Werte, contributors, Faktoren). */
  details?: AuditEventDetails;
  /** Override der Gleichung (Standard: `formalTest` der Regel). */
  equation?: string;
  /**
   * Abdeckungs-Ereignis statt Befund: Die Regel hatte im Plan keine Eingabe.
   * Wird an `AuditEvent.coverageOnly` durchgereicht (siehe `isCoverageEvent`).
   */
  coverageOnly?: true;
}

/**
 * Erzeugt ein Audit-Event mit vollständiger normativer Provenienz.
 *
 * @throws RangeError, wenn die Remediation leer ist — ein Befund ohne
 *   Handlungsanweisung wäre für den Nutzer eine Sackgasse und würde die
 *   Anforderung „Explizite Diagnose & Remediation“ verletzen.
 */
export function auditEvent(input: AuditEventInput): AuditEvent {
  const spec = ruleSpec(input.ruleId);
  const remedy = input.autoFixRemedy.trim();
  if (remedy === '') {
    throw new RangeError(`auditEvent(${input.ruleId}): autoFixRemedy darf nicht leer sein`);
  }
  const severity = input.severity ?? spec.severity;
  if (!SEVERITY_ORDER.includes(severity)) {
    throw new RangeError(`auditEvent(${input.ruleId}): unbekannte Schwere „${severity}“`);
  }
  const kind = input.kind ?? spec.defaultKind;
  if (!FINDING_KINDS.includes(kind)) {
    throw new RangeError(`auditEvent(${input.ruleId}): unbekannte Befundart „${kind}“`);
  }
  return {
    ruleId: input.ruleId,
    severity,
    kind,
    standard: spec.standard,
    clause: spec.clause,
    provenance: spec.provenance,
    entity: input.entity,
    equation: input.equation ?? spec.formalTest,
    calculatedValue: input.calculatedValue ?? null,
    allowedLimit: input.allowedLimit ?? null,
    unit: input.unit ?? '',
    message: input.message,
    autoFixRemedy: remedy,
    ...(input.counterexample ? { counterexample: input.counterexample } : {}),
    ...(input.details ? { details: input.details } : {}),
    ...(input.coverageOnly ? { coverageOnly: true } : {}),
  };
}

/** Bestandener Test mit Zählung der geprüften Entitäten. */
export function passedCheck(ruleId: RuleId, evaluatedEntities: number): CheckResult {
  return {
    ruleId,
    status: 'PASS',
    events: [],
    evaluatedEntities,
  };
}

/**
 * Test mit Ereignissen. Der Status wird aus den Ereignissen abgeleitet und
 * eine Prüfung ohne betrachtete Entitäten ist **nicht** bestanden: Ohne
 * Eingabe gibt es keinen Beweis.
 */
export function checkFromEvents(
  ruleId: RuleId,
  events: readonly AuditEvent[],
  evaluatedEntities: number
): CheckResult {
  if (events.length > 0) {
    return { ruleId, status: statusOfEvents(events), events, evaluatedEntities };
  }
  return {
    ruleId,
    status: evaluatedEntities > 0 ? 'PASS' : 'UNPROVABLE',
    events:
      evaluatedEntities > 0
        ? []
        : [
            auditEvent({
              ruleId,
              entity: { kind: 'system', id: 'plan' },
              kind: 'UNVERIFIABLE',
              message: `Regel „${ruleSpec(ruleId).title}“ wurde nicht angewandt: Die Prüfung hatte keine Eingabe (0 betrachtete Entitäten).`,
              autoFixRemedy:
                'Plan um die für diese Regel nötigen Bauteile/Angaben ergänzen, damit die Prüfung tatsächlich läuft.',
              coverageOnly: true,
            }),
          ],
    evaluatedEntities,
  };
}

/**
 * Ergebnis für Prüfungen, deren Gegenstandsbereich LEER sein kann.
 *
 * Unterschied zu `checkFromEvents`: Eine leere Quantifizierung („es gibt keine
 * Quelle, also keine 0,2-m-Regel zu prüfen“) ist eine bewiesen wahre Aussage —
 * sie wird als `PASS` mit 0 betrachteten Entitäten geführt und von der Pipeline
 * als „nicht anwendbar“ ausgewiesen. Sobald auch nur EIN Befund existiert, gilt
 * die normale Ableitung (FAIL vor UNPROVABLE). Eine Prüfung, die ihre Eingabe
 * VERMISST (Datenlücke), erzeugt vorher ein UNVERIFIABLE-Ereignis und landet
 * damit nicht hier.
 */
export function checkOrNotApplicable(
  ruleId: RuleId,
  events: readonly AuditEvent[],
  evaluatedEntities: number
): CheckResult {
  if (events.length === 0 && evaluatedEntities === 0) return passedCheck(ruleId, 0);
  return checkFromEvents(ruleId, events, evaluatedEntities);
}

/**
 * Ist das Ereignis NUR eine Abdeckungs-Auskunft der Engine („Regel hatte keine
 * Eingabe“) und kein Befund über ein Bauteil des Plans?
 *
 * Die Anzeige braucht diese Unterscheidung: Ein Plan, in dem eine Regel keinen
 * Gegenstand hat, erzeugt für jede solche Regel ein Ereignis — als
 * »Prüfhinweis« wäre das für den Nutzer eine Wand aus Meldungen ohne
 * Handlung. Die Aussage geht nicht verloren: Sie steht im Prüfbericht
 * (Abdeckung, `limitations`), und das Verdikt bleibt davon unberührt
 * (UNPROVABLE ⇒ INCOMPLETE).
 */
export function isCoverageEvent(event: AuditEvent): boolean {
  return event.coverageOnly === true;
}

/** Status über einer Ereignismenge (Reihenfolge: FAIL schlägt UNPROVABLE). */
export function statusOfEvents(events: readonly AuditEvent[]): CheckStatus {
  if (events.some((event) => event.kind === 'VIOLATION')) return 'FAIL';
  if (events.some((event) => event.kind === 'UNVERIFIABLE')) return 'UNPROVABLE';
  return 'PASS';
}

/** Schwerster Grad einer Ereignismenge — `null` bei leerer Menge. */
export function highestSeverity(events: readonly AuditEvent[]): VerificationSeverity | null {
  let worst: VerificationSeverity | null = null;
  for (const severity of SEVERITY_ORDER) {
    if (events.some((event) => event.severity === severity)) {
      worst = severity;
      break;
    }
  }
  return worst;
}

/** Sortiert Ereignisse stabil nach Schwere, dann Regel-ID, dann Entität. */
export function sortEvents(events: readonly AuditEvent[]): AuditEvent[] {
  const rank = (severity: VerificationSeverity): number => SEVERITY_ORDER.indexOf(severity);
  return [...events].sort((a, b) => {
    const bySeverity = rank(a.severity) - rank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    const byRule = a.ruleId.localeCompare(b.ruleId);
    if (byRule !== 0) return byRule;
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) return byKind;
    return `${a.entity.kind}:${a.entity.id}`.localeCompare(`${b.entity.kind}:${b.entity.id}`);
  });
}

/** Zahl mit fester Nachkommastelle, ohne Exponentialschreibweise. */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(digits);
}

/**
 * Einzeilige Darstellung eines Events (Report/CLI/Log).
 * Enthält Norm, Klausel, Herkunft und Remediation — damit ein Copy-Paste in
 * ein Prüfprotokoll vollständig ist.
 */
export function formatEvent(event: AuditEvent): string {
  const where = `${event.entity.kind}:${event.entity.id}`;
  const clause = event.clause ? ` ${event.clause}` : '';
  const values =
    event.calculatedValue === null && event.allowedLimit === null
      ? ''
      : ` [${event.calculatedValue === null ? '—' : formatNumber(event.calculatedValue)}${
          event.unit ? ` ${event.unit}` : ''
        } / zulässig ${event.allowedLimit === null ? '—' : formatNumber(event.allowedLimit)}${
          event.unit ? ` ${event.unit}` : ''
        }]`;
  return `${event.severity} ${event.kind} ${event.ruleId} @${where}: ${event.message}${values} — Norm: ${event.standard}${clause} (${event.provenance}). Abhilfe: ${event.autoFixRemedy}`;
}
