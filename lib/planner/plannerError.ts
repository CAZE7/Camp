/**
 * lib/planner/plannerError.ts — STRUKTURIERTE FEHLER DES ELEKTROPLANERS.
 *
 * Befund V2-ERR-001: Kritische Fehler wurden als freie Strings in
 * `setSystemMessage` geworfen. Ein String trägt keine Kategorie, keine
 * Betroffenen-IDs und keine Handlungsempfehlung — die Oberfläche konnte
 * den Fehler nur als Toast zeigen, nicht zum betroffenen Bauteil springen
 * und keine strukturierte Lösung anbieten.
 *
 * Hier das Modell nach Spec #36: jeder Befund (Fehler wie Warnung) trägt
 * einen Code, Schweregrad, Kategorie, betroffene IDs, Nachricht,
 * Erklärung und eine vorgeschlagene Lösung. Das Objekt ist serialisierbar
 * (JSON-kompatibel), damit es im Store, in Test-Snapshots und über
 * PostMessage verwendet werden kann.
 *
 * Schichten: reine Domäne, keine UI-Abhängigkeit (ADR 0008 / ARCH-001).
 */

/** Maschinenlesbarer Fehlercode. Neue Codes bitte HIER eintragen. */
export type PlannerErrorCode =
  // ── Batterie / Bank ──────────────────────────────────────────────────────
  | 'BANK_AMBIGUOUS_TOPOLOGY'
  | 'BANK_MIXED_CHEMISTRY'
  | 'BANK_VOLTAGE_MISMATCH'
  | 'BANK_MISSING_COUNTS'
  | 'BANK_MEMBER_COUNT_MISMATCH'
  | 'BANK_DECLARATION_MISMATCH'
  // ── Spannungskompatibilität ─────────────────────────────────────────────
  | 'VOLTAGE_MISMATCH'
  | 'INVERTER_VOLTAGE_MISMATCH'
  | 'CHARGER_VOLTAGE_MISMATCH'
  // ── BMS / Strombudget ───────────────────────────────────────────────────
  | 'BMS_CURRENT_EXCEEDED'
  | 'BMS_CHARGE_EXCEEDED'
  | 'BMS_DISCHARGE_EXCEEDED'
  | 'COMPONENT_CURRENT_EXCEEDED'
  | 'FUSE_RATING_TOO_SMALL'
  | 'FUSE_RATING_TOO_LARGE'
  | 'CABLE_OVERLOAD'
  | 'SYSTEM_CURRENT_EXCEEDED'
  // ── AC-System ───────────────────────────────────────────────────────────
  | 'AC_AMBIGUOUS_SOURCE'
  | 'AC_NO_SOURCE'
  | 'AC_MULTIPLE_SOURCES_UNASSIGNED'
  | 'AC_RCD_MISSING'
  // ── Routing ─────────────────────────────────────────────────────────────
  | 'ROUTING_NOT_CONVERGED'
  | 'ROUTING_LOCKED_CLEARANCE_VIOLATION'
  | 'ROUTING_LOCKED_IMPOSSIBLE'
  | 'ROUTING_LOCKED_MUTATION'
  | 'ROUTING_LOCKED_MISSING_PATH'
  | 'ROUTING_INVALID'
  | 'ROUTING_OBSTACLE_CONFLICT'
  | 'ROUTING_CLEARANCE_CONFLICT'
  // ── Verbindungen / Regeln ───────────────────────────────────────────────
  | 'CONNECTION_DOMAIN_CROSSING'
  | 'CONNECTION_POLARITY_INVALID'
  | 'CONNECTION_DUPLICATE'
  | 'CONNECTION_SHORT_CIRCUIT'
  | 'CONNECTION_SHUNT_BYPASS'
  | 'PINNED_EDGE_VIOLATES_RULE'
  // ── Schutzorgane ────────────────────────────────────────────────────────
  | 'PROTECTION_MISSING'
  | 'PROTECTION_TOO_FAR_FROM_SOURCE'
  | 'PROTECTION_WRONG_TYPE'
  // ── Spannungsfall ───────────────────────────────────────────────────────
  | 'VOLTAGE_DROP_EXCEEDED'
  // ── Allgemein ───────────────────────────────────────────────────────────
  | 'PLAN_INCOMPLETE';

/** Schweregrad nach fachlicher Wirkung. */
export type PlannerErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Fachliche Kategorie — steuert Filter/Icons im Prüfmodus. */
export type PlannerErrorCategory =
  | 'battery'
  | 'voltage'
  | 'bms'
  | 'current'
  | 'fuse'
  | 'cable'
  | 'ac'
  | 'routing'
  | 'connection'
  | 'protection'
  | 'voltage-drop'
  | 'general';

/**
 * Ein strukturierter Planer-Fehler (oder -Warnung).
 *
 * Alle Felder sind JSON-kompatibel und optional, bis auf code/severity/
 * category/message. So können bestehende String-Meldungen schrittweise
 * migriert werden, statt mit einem Groß-Rewrite alle Aufrufer umzuziehen.
 */
export interface PlannerError {
  code: PlannerErrorCode;
  severity: PlannerErrorSeverity;
  category: PlannerErrorCategory;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  /** Kurze Nutzmeldung (1 Satz, deutsch). */
  message: string;
  /** Längere Erklärung (2-3 Sätze, Ursache + fachlicher Hintergrund). */
  explanation?: string;
  /** Konkreter Lösungsvorschlag (handlungsorientiert). */
  suggestedFix?: string;
  /** Zahlenwerte, die für die Diagnose hilfreich sind (z. B. Strom-Grenzen). */
  details?: Readonly<Record<string, number | string | boolean | null | undefined>>;
}

/**
 * Baut einen Fehler in kanonischer Form — sorgt für sortierte IDs und
 * unveränderliche Listen, damit zwei Exemplare semantisch gleicher Fehler
 * per `toEqual` verglichen werden können (Tests, Deduplizierung).
 */
export function createPlannerError(
  input: Omit<PlannerError, 'nodeIds' | 'edgeIds'> & {
    nodeIds?: readonly string[];
    edgeIds?: readonly string[];
  }
): PlannerError {
  const nodeIds = [...(input.nodeIds ?? [])].sort();
  const edgeIds = [...(input.edgeIds ?? [])].sort();
  return {
    code: input.code,
    severity: input.severity,
    category: input.category,
    nodeIds,
    edgeIds,
    message: input.message,
    ...(input.explanation === undefined ? {} : { explanation: input.explanation }),
    ...(input.suggestedFix === undefined ? {} : { suggestedFix: input.suggestedFix }),
    ...(input.details === undefined ? {} : { details: { ...input.details } }),
  };
}

/** Zwei Fehler auf Gleichheit (anhand der IDs und des Codes). */
export function samePlannerError(left: PlannerError, right: PlannerError): boolean {
  if (left.code !== right.code) return false;
  if (left.severity !== right.severity) return false;
  const l1 = [...left.nodeIds].sort().join(',');
  const r1 = [...right.nodeIds].sort().join(',');
  const l2 = [...left.edgeIds].sort().join(',');
  const r2 = [...right.edgeIds].sort().join(',');
  return l1 === r1 && l2 === r2;
}

/** Dedupliziert eine Liste von Fehlern (erster gewinnt bei Gleichheit). */
export function dedupePlannerErrors(errors: readonly PlannerError[]): readonly PlannerError[] {
  const seen = new Set<string>();
  const out: PlannerError[] = [];
  for (const error of errors) {
    const key = `${error.code}|${error.severity}|${[...error.nodeIds].sort().join(',')}|${[...error.edgeIds].sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(error);
  }
  return out;
}

/**
 * Mappt eine `ruleId` aus `useLiveValidation` (z. B. `ELE-010-component-limit`,
 * `SOLAR-MPPT-UNDER`, `SOLAR-DIRECT`, `DCD-NO-HOUSE`, `DATA-INVALID`,
 * `RCD-MISSING-*`, `INV-OVERLOAD`, `BANK-AMBIGUOUS`, …) auf einen
 * PlannerErrorCode. Unbekannte Regeln fallen auf `PLAN_INCOMPLETE` zurück
 * (kein Verlust, nur weniger spezifisch).
 */
export function plannerErrorCodeFromRuleId(ruleId: string | undefined): PlannerErrorCode {
  if (!ruleId) return 'PLAN_INCOMPLETE';
  if (ruleId.startsWith('BMS-') || /bms/i.test(ruleId)) return 'BMS_CURRENT_EXCEEDED';
  if (/component-limit|COMPONENT|overload-inv/i.test(ruleId)) return 'COMPONENT_CURRENT_EXCEEDED';
  if (/SOLAR-DIRECT|short/i.test(ruleId)) return 'CONNECTION_SHORT_CIRCUIT';
  if (/voltage|VOC|V-mismatch/i.test(ruleId)) return 'VOLTAGE_MISMATCH';
  if (/RCD/i.test(ruleId)) return 'AC_RCD_MISSING';
  if (/ambiguous-ac|AC-AMBIG/i.test(ruleId)) return 'AC_AMBIGUOUS_SOURCE';
  if (/ambiguous-bank|BANK-AMBIG/i.test(ruleId)) return 'BANK_AMBIGUOUS_TOPOLOGY';
  if (/fuse.*small|FUSE-SMALL/i.test(ruleId)) return 'FUSE_RATING_TOO_SMALL';
  if (/fuse.*large|FUSE-LARGE/i.test(ruleId)) return 'FUSE_RATING_TOO_LARGE';
  if (/cable|CBL|cross.sect/i.test(ruleId)) return 'CABLE_OVERLOAD';
  if (/BANK-COUNT-MISMATCH/i.test(ruleId)) return 'BANK_MEMBER_COUNT_MISMATCH';
  if (/BANK-DECLARATION-MISMATCH/i.test(ruleId)) return 'BANK_DECLARATION_MISMATCH';
  if (/BANK-MISSING-COUNTS/i.test(ruleId)) return 'BANK_MISSING_COUNTS';
  if (/ROUTE-LOCK-MUTATION/i.test(ruleId)) return 'ROUTING_LOCKED_MUTATION';
  if (/ROUTE-LOCK-MISSING/i.test(ruleId)) return 'ROUTING_LOCKED_MISSING_PATH';
  if (/ROUTE-LOCK-I3|ROUTE-LOCK-CLEARANCE/i.test(ruleId)) return 'ROUTING_LOCKED_CLEARANCE_VIOLATION';
  if (/ROUTE-LOCK-(ENDPOINT|GEOMETRY|MISSING)/i.test(ruleId)) return 'ROUTING_LOCKED_IMPOSSIBLE';
  if (/ROUTE-LOCK-I1|ROUTE-LOCK-OBSTACLE/i.test(ruleId)) return 'ROUTING_OBSTACLE_CONFLICT';
  if (/ROUTE-LOCK-I2|ROUTE-LOCK-OVERLAP/i.test(ruleId)) return 'ROUTING_INVALID';
  if (/route/i.test(ruleId)) return 'ROUTING_INVALID';
  if (/pinned/i.test(ruleId)) return 'PINNED_EDGE_VIOLATES_RULE';
  if (/shunt/i.test(ruleId)) return 'CONNECTION_SHUNT_BYPASS';
  if (/domain|cross/i.test(ruleId)) return 'CONNECTION_DOMAIN_CROSSING';
  if (/drop/i.test(ruleId)) return 'VOLTAGE_DROP_EXCEEDED';
  return 'PLAN_INCOMPLETE';
}

/** Mappt die Kategorie einer ValidationWarning auf PlannerErrorCategory. */
export function plannerErrorCategoryFromValidation(
  category: 'safety' | 'topology' | 'monitoring' | 'estimation' | 'routing' | undefined,
  ruleId: string | undefined
): PlannerErrorCategory {
  if (/bms|BMS/i.test(ruleId ?? '')) return 'bms';
  if (/cable|CBL/i.test(ruleId ?? '')) return 'cable';
  if (/ac|AC|RCD/i.test(ruleId ?? '')) return 'ac';
  if (/battery|BANK|bank/i.test(ruleId ?? '')) return 'battery';
  if (/fuse|FUSE/i.test(ruleId ?? '')) return 'fuse';
  if (/route|ROUTE/i.test(ruleId ?? '')) return 'routing';
  if (/voltage|VOC|V-/i.test(ruleId ?? '')) return 'voltage';
  if (category === 'routing') return 'routing';
  if (category === 'topology') return 'connection';
  if (category === 'safety') return 'protection';
  return 'general';
}
