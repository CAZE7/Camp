/**
 * lib/electricalGraph/currentBudget.ts — BELASTBARKEIT ALS MINIMUM, NICHT ALS WARNUNG.
 *
 * Befund V2-BMS-001: BMS-Grenzen waren im Datenmodell vorhanden und wurden
 * als nachgelagerte Live-Warnung angezeigt — die DIMENSIONIERUNG rechnete
 * ohne sie weiter. Ergebnis war ein Plan, der aussah wie eine funktionierende
 * Anlage („150-A-System") und daneben eine Warnung trug. Fachlich ist das
 * falsch herum: Eine Batterie, deren BMS bei 100 A abschaltet, KANN einen
 * 140-A-Wechselrichter nicht versorgen. Das ist kein Hinweis, das ist ein
 * Konstruktionsfehler.
 *
 * Deshalb hier eine einzige, benannte Rechnung:
 *
 * ```text
 * allowedCurrent = min( cableCapacity, fuseConstraint, componentLimit,
 *                       bmsLimit, systemLimit )
 * ```
 *
 * Das Ergebnis trägt IMMER mit, **welche** Grenze gewonnen hat
 * (`limitedBy`) — eine Zahl ohne Ursache ist für den Nutzer wertlos, und für
 * die Oberfläche („Was muss ich ändern?") erst recht.
 *
 * Fehlende Grenzen werden nicht erfunden: Ist keine einzige Grenze bekannt,
 * ist `allowedCurrent` `undefined` und `limitedBy` `'unknown'` (Regel M).
 */

import { amps, type Amps } from '../units';

/** Woher eine Strombegrenzung kommt. */
export type CurrentLimitSource = 'bms' | 'component' | 'fuse' | 'cable' | 'system';

/**
 * Rangfolge bei Gleichstand. Begründung: Je „weiter innen" die Ursache
 * liegt, desto eher ist sie die eigentliche Konstruktionsgrenze. Ein
 * Gleichstand zwischen BMS und Kabel ist fast immer ein auf das BMS
 * ausgelegtes Kabel — der Nutzer muss am BMS ansetzen, nicht am Kabel.
 */
export const CURRENT_LIMIT_PRECEDENCE: readonly CurrentLimitSource[] = [
  'bms',
  'component',
  'fuse',
  'cable',
  'system',
];

/** Menschenlesbarer Name je Quelle (deutsch, für Meldungen). */
export const CURRENT_LIMIT_LABEL: Readonly<Record<CurrentLimitSource, string>> = {
  bms: 'BMS-Grenze',
  component: 'Bauteilgrenze',
  fuse: 'Sicherung',
  cable: 'Kabelbelastbarkeit',
  system: 'Systemgrenze',
};

export type CurrentLimits = Partial<Readonly<Record<CurrentLimitSource, Amps>>>;

export interface CurrentBudget {
  /** Kleinste bekannte Grenze; `undefined`, wenn keine bekannt ist. */
  allowedCurrent?: Amps;
  /** Welche Grenze gewonnen hat. */
  limitedBy: CurrentLimitSource | 'unknown';
  /** Alle berücksichtigten Grenzen (für Anzeige/Diagnose). */
  limits: CurrentLimits;
}

/**
 * Kleinste zulässige Dauerbelastung aus allen bekannten Grenzen.
 * Nicht-endliche oder nicht-positive Werte werden verworfen (eine 0-A-Grenze
 * wäre keine Grenze, sondern ein Datenfehler).
 */
export function computeCurrentBudget(input: CurrentLimits): CurrentBudget {
  const limits: Partial<Record<CurrentLimitSource, Amps>> = {};
  for (const source of CURRENT_LIMIT_PRECEDENCE) {
    const value = input[source];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0) continue;
    limits[source] = value;
  }

  let best: { source: CurrentLimitSource; value: Amps } | undefined;
  for (const source of CURRENT_LIMIT_PRECEDENCE) {
    const value = limits[source];
    if (value === undefined) continue;
    // `<` statt `<=`: Bei Gleichstand gewinnt die zuerst geprüfte Quelle,
    // also die mit dem höheren Rang in CURRENT_LIMIT_PRECEDENCE.
    if (best === undefined || value < best.value) best = { source, value };
  }

  if (!best) return { limitedBy: 'unknown', limits };
  return { allowedCurrent: best.value, limitedBy: best.source, limits };
}

/** Bewertung einer konkreten Last gegen das Budget. */
export type LoadFeasibility = {
  /** `false` = die Anlage kann diese Last in dieser Konfiguration nicht liefern. */
  feasible: boolean;
  severity: 'ok' | 'warning' | 'critical';
  requiredCurrent: Amps;
  allowedCurrent?: Amps;
  limitedBy: CurrentLimitSource | 'unknown';
  /** Fertige Nutzermeldung (deutsch), ohne Prosa-Interpretation beim Aufrufer. */
  message: string;
};

/**
 * Reserve, ab der eine Last als „knapp" gilt (90 % des Budgets).
 * MODELLANNAHME, keine Norm: Dauerlast dicht an der Abschaltschwelle führt im
 * Betrieb zu Abschaltungen durch Temperatur-Derating des BMS.
 */
export const LOAD_HEADROOM_FRACTION = 0.9;

/**
 * Kann die Anlage diese Last liefern?
 *
 * - kein Budget bekannt  ⇒ `warning` („nicht bewertbar") — NIE `ok`
 * - Last > Budget        ⇒ `critical`, nicht ausführbar
 * - Last > 90 % Budget   ⇒ `warning`, ausführbar aber ohne Reserve
 * - sonst                ⇒ `ok`
 *
 * @param subject Benennung der Last für die Meldung („Wechselrichter ‚X'").
 */
export function evaluateLoadFeasibility(
  requiredCurrent: Amps,
  budget: CurrentBudget,
  subject: string
): LoadFeasibility {
  const allowed = budget.allowedCurrent;
  const rounded = Math.round(requiredCurrent);

  if (allowed === undefined) {
    return {
      feasible: true,
      severity: 'warning',
      requiredCurrent,
      limitedBy: 'unknown',
      message: `${subject} benötigt ≈${rounded} A. Es ist keine Belastbarkeitsgrenze hinterlegt (BMS, Bauteil, Sicherung) — die Versorgung ist damit nicht bewertbar.`,
    };
  }

  const limitName = budget.limitedBy === 'unknown' ? 'Grenze' : CURRENT_LIMIT_LABEL[budget.limitedBy];
  const allowedRounded = Math.round(allowed);

  if (requiredCurrent > allowed) {
    return {
      feasible: false,
      severity: 'critical',
      requiredCurrent,
      allowedCurrent: allowed,
      limitedBy: budget.limitedBy,
      message: `${subject} kann mit dieser Konfiguration nicht versorgt werden. Benötigt: ${rounded} A — ${limitName}: ${allowedRounded} A.`,
    };
  }

  if (requiredCurrent > amps(allowed * LOAD_HEADROOM_FRACTION)) {
    return {
      feasible: true,
      severity: 'warning',
      requiredCurrent,
      allowedCurrent: allowed,
      limitedBy: budget.limitedBy,
      message: `${subject} belastet die Anlage mit ≈${rounded} A bei einer ${limitName} von ${allowedRounded} A — keine Reserve.`,
    };
  }

  return {
    feasible: true,
    severity: 'ok',
    requiredCurrent,
    allowedCurrent: allowed,
    limitedBy: budget.limitedBy,
    message: `${subject}: ≈${rounded} A von ${allowedRounded} A (${limitName}).`,
  };
}
