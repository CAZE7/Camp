/**
 * Zentrale Freigabe-Regel des Planers (Phase D).
 *
 * Es gibt genau EINE Stelle, die entscheidet, welchen Status ein Plan hat und
 * ob ein Planungsdokument (Stückliste, Export) erzeugt werden darf. UI-Komponenten
 * lesen das Ergebnis nur; sie werten keine Befunde selbst aus.
 *
 *  - `entwurf`          Änderungen erlaubt. Der Plan gilt NICHT als geprüft
 *                       (leer, unvollständige Daten oder nur Warnungen/Hinweise).
 *                       Dokumente sind erlaubt, tragen aber den Status „Entwurf“.
 *  - `softwaregeprueft` Die Verifikations-Engine hat für genau diesen Planstand
 *                       keine Verletzung gefunden und alle angewandten Regeln
 *                       entschieden. Das ist KEINE Freigabe und KEINE normative
 *                       Abnahme; die Modellgrenzen bleiben im Bericht.
 *  - `gesperrt`         Mindestens ein KRITISCHER, verletzter Befund. Dokumente
 *                       werden nicht erzeugt, bis der Befund behoben ist.
 *
 * Der Status bezieht sich immer auf den Planstand (`planFingerprintHash`), aus
 * dem das `VerificationSummary` stammt. Ändert sich der Plan, entsteht über
 * `verificationReportFor` ein neuer Fingerprint und damit eine neue Bewertung:
 * ein älteres Ergebnis kann nicht für einen neueren Plan gelten.
 */
import type { VerificationSummary } from './verificationWarnings';
import type { ValidationWarning } from '../hooks/useLiveValidation';

export type DocumentStatus = 'entwurf' | 'softwaregeprueft' | 'gesperrt';

export interface ReleaseAssessment {
  status: DocumentStatus;
  /** Anzeige-Bezeichnung des Status. */
  label: string;
  /** Ein Satz, was der Status bedeutet — und was er NICHT bedeutet. */
  explanation: string;
  /** Meldungen der kritischen, verletzten Befunde (blockieren Dokumente). */
  blockers: string[];
  /** Zahl der offenen Befunde (alle Schweregrade). */
  openPoints: number;
  /** Dürfen Planungsdokumente (Stückliste/Export) erzeugt werden? */
  canExportDocument: boolean;
  /** Planstand, auf den sich die Bewertung bezieht (leer ohne Prüfung). */
  planFingerprintHash: string | null;
}

/** Kritisch UND verletzt — nur dieser Befund sperrt. */
export function isBlockingFinding(finding: ValidationWarning): boolean {
  if (finding.type !== 'critical') return false;
  return finding.status === undefined || finding.status === 'violated';
}

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  entwurf: 'Entwurf',
  softwaregeprueft: 'Softwareprüfung bestanden (keine Freigabe)',
  gesperrt: 'Gesperrt – kritische Befunde',
};

/**
 * Bewertet den Planstand. `summary` ist `null`, wenn keine Prüfung vorliegt
 * (z. B. leerer Plan); dann gilt der Plan als Entwurf.
 */
export function assessRelease(
  summary: VerificationSummary | null,
  componentCount: number
): ReleaseAssessment {
  if (componentCount === 0 || summary === null) {
    return {
      status: 'entwurf',
      label: DOCUMENT_STATUS_LABEL.entwurf,
      explanation: 'Der Plan ist leer. Es gibt nichts zu prüfen und nichts zu dokumentieren.',
      blockers: [],
      openPoints: 0,
      canExportDocument: false,
      planFingerprintHash: null,
    };
  }

  const blockers = summary.findings.filter(isBlockingFinding).map((finding) => finding.message);
  // Jeder Befund ist genau ein offener Punkt (Verletzung, Hinweis oder Datenlücke).
  const openPoints = summary.findings.length;

  if (blockers.length > 0) {
    return {
      status: 'gesperrt',
      label: DOCUMENT_STATUS_LABEL.gesperrt,
      explanation: `${blockers.length} kritische Verletzung(en). Dokumente werden erst erzeugt, wenn sie behoben sind.`,
      blockers,
      openPoints,
      canExportDocument: false,
      planFingerprintHash: summary.planFingerprintHash,
    };
  }

  if (summary.verdict === 'COMPLIANT') {
    return {
      status: 'softwaregeprueft',
      label: DOCUMENT_STATUS_LABEL.softwaregeprueft,
      explanation:
        'Die Software-Prüfung hat für diesen Planstand keine Verletzung gefunden. Das ersetzt weder eine Prüfung durch eine Elektrofachkraft noch eine normative Abnahme.',
      blockers: [],
      openPoints,
      canExportDocument: true,
      planFingerprintHash: summary.planFingerprintHash,
    };
  }

  return {
    status: 'entwurf',
    label: DOCUMENT_STATUS_LABEL.entwurf,
    explanation: `Der Plan gilt nicht als geprüft: ${summary.unprovable} Regel(n) sind mit den vorhandenen Angaben nicht entscheidbar. Offene Befunde: ${openPoints}.`,
    blockers: [],
    openPoints,
    canExportDocument: true,
    planFingerprintHash: summary.planFingerprintHash,
  };
}
