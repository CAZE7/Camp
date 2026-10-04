/**
 * lib/autoWire/conflicts.ts — WAS AUTOWIRE GETAN HAT UND WARUM.
 *
 * Befund V2-AUTO-001: `performAutoWiring` war eine stille Funktion. Sie hat
 * Nutzerkanten umgehängt (Shunt-Bypass → Shunt), gelöscht (Serienkurzschluss,
 * Solar-Direktanschluss) und AC-Verbraucher an den ersten Wechselrichter
 * gehängt — und davon erfuhr der Nutzer NICHTS. Er sah nur, dass sein Plan
 * nach dem Klick anders aussah. Für eine Planungssoftware ist das der
 * schlimmste Zustand: Die Software hatte sogar recht, aber sie hat es nicht
 * gesagt.
 *
 * Ab hier gilt: **Jeder Eingriff in eine Nutzerkante erzeugt einen Eintrag.**
 * Gepinnte Kanten (`locked` / ausdrücklich erklärte Absicht,
 * `lib/electricalGraph/intent.ts`) werden GAR NICHT angefasst — ihr
 * Regelkonflikt wird gemeldet und der Nutzer entscheidet.
 *
 * Der Report ist Teil des Rückgabewerts von `performAutoWiring`. Er ersetzt
 * keine Validierung (die läuft weiterhin in `useLiveValidation` /
 * `lib/verify`), sondern beantwortet die andere Frage: *Was hat dieser
 * Knopfdruck mit meinem Plan gemacht?*
 */

import { compareIds } from '../sortOrder';

export type AutoWireConflictKind =
  /** Gepinnte Kante widerspricht einer Regel — NICHT geändert, nur gemeldet. */
  | 'pinned-edge-violates-rule'
  /** Nutzerkante wurde in die Zieltopologie eingefädelt (umgehängt). */
  | 'healed-user-edge'
  /** Nutzerkante wurde entfernt (fachlich unzulässig). */
  | 'dropped-user-edge'
  /** Verschaltung mehrerer Batterien ist nicht erklärt — nicht geraten. */
  | 'ambiguous-battery-topology'
  /** 230-V-Verbraucher ohne eindeutige Quelle — nicht verdrahtet. */
  | 'ambiguous-ac-source'
  /** Last übersteigt die zulässige Belastbarkeit (BMS/Bauteil/System). */
  | 'load-exceeds-limit'
  /** Bauteil passt nicht zur Spannungsebene der Anlage. */
  | 'voltage-mismatch';

export type AutoWireConflictSeverity = 'info' | 'warning' | 'critical';

export interface AutoWireConflict {
  kind: AutoWireConflictKind;
  severity: AutoWireConflictSeverity;
  /** Maschinenlesbare Regel-ID für Tests und die Warnzentrale. */
  ruleId: string;
  /** Nutzertext (deutsch), vollständig ohne weiteren Kontext lesbar. */
  message: string;
  edgeIds: readonly string[];
  nodeIds: readonly string[];
}

/** Ergebnisbericht eines AutoWire-Laufs. */
export interface AutoWireReport {
  conflicts: readonly AutoWireConflict[];
  /** Offene Entscheidungen (Batteriebank, AC-Zuordnung) als Nutzerfragen. */
  questions: readonly string[];
}

const SEVERITY_RANK: Readonly<Record<AutoWireConflictSeverity, number>> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export interface ConflictCollector {
  add: (conflict: AutoWireConflict) => void;
  ask: (question: string) => void;
  /** Deterministisch sortierter, duplikatfreier Bericht. */
  report: () => AutoWireReport;
}

/**
 * Sammler für einen Lauf. Deduplizierung über
 * `kind|ruleId|edgeIds|nodeIds` — dieselbe Regel an derselben Kante ist EIN
 * Befund, auch wenn zwei Phasen sie melden.
 */
export function createConflictCollector(): ConflictCollector {
  const byKey = new Map<string, AutoWireConflict>();
  const questions = new Set<string>();

  return {
    add(conflict) {
      const key = `${conflict.kind}|${conflict.ruleId}|${[...conflict.edgeIds].sort(compareIds).join(',')}|${[
        ...conflict.nodeIds,
      ]
        .sort(compareIds)
        .join(',')}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          ...conflict,
          edgeIds: [...conflict.edgeIds].sort(compareIds),
          nodeIds: [...conflict.nodeIds].sort(compareIds),
        });
      }
    },
    ask(question) {
      questions.add(question);
    },
    report() {
      const conflicts = [...byKey.values()].sort(
        (left, right) =>
          SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
          compareIds(left.ruleId, right.ruleId) ||
          compareIds(left.edgeIds.join(','), right.edgeIds.join(',')) ||
          compareIds(left.nodeIds.join(','), right.nodeIds.join(','))
      );
      return { conflicts, questions: [...questions].sort(compareIds) };
    },
  };
}

/** Leerer Bericht — für Aufrufer ohne Sammler (Tests, Teilpfade). */
export const EMPTY_AUTO_WIRE_REPORT: AutoWireReport = { conflicts: [], questions: [] };

/** Gibt es mindestens einen kritischen Befund? */
export const hasCriticalConflict = (report: AutoWireReport): boolean =>
  report.conflicts.some((conflict) => conflict.severity === 'critical');
