/**
 * lib/validationSeverity.ts — EIN VOKABULAR FÜR MELDUNGSGRAD UND MELDUNGSZUSTAND.
 *
 * Die Verifikations-Engine kennt seit jeher zwei orthogonale Achsen:
 *   - Schwere  `CRITICAL_SAFETY | CODE_VIOLATION | EFFICIENCY_WARNING`
 *   - Art      `VIOLATION | UNVERIFIABLE`
 * Diese Namen sind Normsprache und bleiben in `lib/verify/types.ts`
 * unverändert. Für Anzeige, Gruppierung und Tests braucht es aber den
 * Nutzer-Begriff, der beides zusammenführt — genau der ist hier definiert:
 *
 *   Schwere: `critical | error | warning | info`
 *   Zustand: `violated | incomplete | satisfied | not_applicable`
 *
 * Die Übersetzung ist eine reine Projektion (`severityOf`, `statusOf`), damit
 * es keine zweite Wahrheit gibt: Es wird nichts neu bewertet, nur benannt.
 *
 * Fachliche Kernregel (Auftrag Phase 9): **Keine Datenlücke ist ein
 * Sicherheitsverstoß.** Ein `UNVERIFIABLE`-Befund ist `info` + `incomplete`;
 * ein `not_applicable`-Hinweis (`coverageOnly`) ist `info` +
 * `not_applicable`. Umgekehrt bleibt eine belegte Verletzung `violated`: Eine
 * mechanische Abschwächung („kritisch ⇒ Hinweis“) ist ausdrücklich verboten.
 */

/** Nutzer-Sprache der Schwere: vier Stufen, absteigend nach Dringlichkeit. */
export type ValidationSeverity = 'critical' | 'error' | 'warning' | 'info';

/** Nutzer-Sprache des Zustands: was der Befund ÜBER den Plan sagt. */
export type ValidationStatus = 'violated' | 'incomplete' | 'satisfied' | 'not_applicable';

export const VALIDATION_SEVERITIES: readonly ValidationSeverity[] = ['critical', 'error', 'warning', 'info'];
export const VALIDATION_STATUSES: readonly ValidationStatus[] = [
  'violated',
  'incomplete',
  'satisfied',
  'not_applicable',
];

/** Sortierrang der Schwere (0 = dringendste). */
export function severityRank(severity: ValidationSeverity): number {
  const index = VALIDATION_SEVERITIES.indexOf(severity);
  return index === -1 ? VALIDATION_SEVERITIES.length : index;
}

/** Sortierrang des Zustands (0 = schwerwiegendste Aussage). */
export function validationStatusRank(status: ValidationStatus): number {
  const index = VALIDATION_STATUSES.indexOf(status);
  return index === -1 ? VALIDATION_STATUSES.length : index;
}

/** Deutsche Kurzbezeichnungen (Anzeige; keine Fachlogik). */
export const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  critical: 'Kritisch',
  error: 'Fehler',
  warning: 'Warnung',
  info: 'Hinweis',
};

/** Deutsche Kurzbezeichnungen des Zustands. */
export const STATUS_LABEL: Record<ValidationStatus, string> = {
  violated: 'verletzt',
  incomplete: 'Datenlage unvollständig',
  satisfied: 'erfüllt',
  not_applicable: 'nicht anwendbar',
};

/** Zählwerk je Meldungszustand — Grundlage der Warnzentrale-Kopfzeile. */
export interface ValidationStateCounts {
  critical: number;
  error: number;
  warning: number;
  info: number;
  violated: number;
  incomplete: number;
  satisfied: number;
  not_applicable: number;
}

/** Zählt Meldungen nach Schwere und Zustand (deterministisch, keine Sortierung). */
export function countValidationStates(
  findings: readonly { severity: ValidationSeverity; status: ValidationStatus }[]
): ValidationStateCounts {
  const counts: ValidationStateCounts = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    violated: 0,
    incomplete: 0,
    satisfied: 0,
    not_applicable: 0,
  };
  for (const finding of findings) {
    counts[finding.severity] += 1;
    counts[finding.status] += 1;
  }
  return counts;
}
