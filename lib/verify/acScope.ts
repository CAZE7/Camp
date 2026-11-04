/**
 * lib/verify/acScope.ts — PASS 5, NET-003: 230-V-MODELLGRENZEN (P0-Folge).
 *
 * Das Gutachten verlangt für 230 V ausdrücklich die Alternative „Modellgrenzen
 * schließen ODER explizit absichern". Dieser Baustein wählt die zweite, kleine
 * Variante: Es wird KEINE neue Leiter-, Netzform-, Umschalt- oder
 * Rückspeiselogik erfunden. Stattdessen muss der Prüfbericht für jeden Plan mit
 * 230-V-Kreisen einzeln ausweisen, was er nicht prüfen kann — damit ein
 * `COMPLIANT`/`INCOMPLETE` nie als normgeprüfte Abnahme gelesen werden kann.
 *
 * Die Engine bleibt EINLEITERIG (ENGINE_LIMITATIONS). NET-001/002 prüfen
 * deklarierte Datenfelder, RCD-001…006 die Schutzorganisation im Leitungspfad,
 * GND-001 den Querschnitt der Masseanbindung. Was hier steht, sind genau die
 * Gegenstände, die davon NICHT abgedeckt sind.
 *
 * Datengrundlage und Abgrenzung: docs/AC-230V-MODELLGRENZEN.md
 */

import type { PassContext } from './context';
import { auditEvent, checkOrNotApplicable, passedCheck } from './events';
import { sortedCables } from './pathSearch';
import type { AuditEvent, CheckResult } from './types';

/** Die drei Bewertungsstufen — nie als gleichwertig dargestellt. */
export type AcAssessment = 'computed' | 'assumption-based' | 'unverifiable';

export const AC_ASSESSMENT_LABEL: Readonly<Record<AcAssessment, string>> = Object.freeze({
  computed: 'rechnerisch bewertet',
  'assumption-based': 'mit Annahmen bewertet',
  unverifiable: 'nicht überprüfbar',
});

/**
 * Was das Modell auf der 230-V-Seite in welcher Stufe leistet. Diese Liste ist
 * die Datengrundlage für Bericht, Inspektor und Dokumentation — nicht nur
 * Prosa in einem Kommentar.
 */
export interface AcScopeItem {
  id: string;
  group: 'conductors' | 'switching' | 'verification';
  assessment: AcAssessment;
  title: string;
  /** Warum das Modell hier keine Aussage machen kann bzw. worauf sie beruht. */
  basis: string;
  /** Konkrete Handlung; bei „nicht überprüfbar" die Prüfung durch Fachpersonal. */
  remedy: string;
}

export const QUALIFIED_PERSONNEL_NOTICE =
  'Die 230-V-Prüfung und die Abnahme dürfen nur durch entsprechend qualifiziertes Personal erfolgen; dieser Bericht ist kein Normnachweis.';

export const AC_230V_SCOPE_ITEMS: readonly AcScopeItem[] = Object.freeze([
  {
    id: 'computed-core',
    group: 'verification',
    assessment: 'computed',
    title: 'Strom, Querschnitt, Schutzorgan und Spannungsfall der EINEN Leitung',
    basis:
      'Aus dem Konduktionsgraphen und der Tabellenbasis des Planers berechnet (AMP-001…006, VDR-001/002, RCD-005). Gilt für das Single-Line-Modell, nicht für jeden Einzelleiter.',
    remedy: 'Ergebnisse im Prüfbericht und im Kabel-Inspektor prüfen; keine zusätzliche Annahme nötig.',
  },
  {
    id: 'assumed-network',
    group: 'conductors',
    assessment: 'assumption-based',
    title: 'Netzform und N-PE-Bezug aus deklarierten Bauteilfeldern',
    basis:
      'NET-001/002 werten `systemForm` und `neutralEarthBond` aus. Fehlt ein Feld, meldet die Engine UNVERIFIABLE; ein fehlender Wert wird nicht als „potenzialfrei ⇒ sicher" angenommen.',
    remedy: 'Datenblattangaben der Einspeisung und des Wechselrichters im Bauteil-Inspektor eintragen.',
  },
  {
    id: 'assumed-impedance',
    group: 'verification',
    assessment: 'assumption-based',
    title: 'Schleifenimpedanz und Abschaltbedingung mit Modellannahmen',
    basis:
      '`UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8` (ELE-002, UNVERIFIED), 2/3-Regel der Leitererwärmung, 3:1-Heuristik der RCD-Selektivität. Messwerte und Herstellerkennlinien fehlen.',
    remedy:
      'Z_s, I_k und Abschaltzeiten vor Ort messen bzw. dem Datenblatt entnehmen und mit dem Modell vergleichen.',
  },
  {
    id: 'separate-conductors',
    group: 'conductors',
    assessment: 'unverifiable',
    title: 'L/N/PE als getrennte Leiter mit je eigenem Querschnitt und eigener Verlegung',
    basis:
      'Der Plan ist einleiterig: L, N und PE sind nicht als getrennte Kanten abgebildet. Aussagen über einen einzelnen Leiter (z. B. PEN-Führung) stützen sich nur auf deklarierte Felder.',
    remedy: 'Verdrahtung, Aderzahl und Querschnitte am realen Aufbau durch qualifiziertes Personal prüfen.',
  },
  {
    id: 'two-pole-disconnect',
    group: 'switching',
    assessment: 'unverifiable',
    title: 'Zweipolige/allpolige Trennung als reales Schaltgerät',
    basis:
      'RCD-004 wertet nur das Datenfeld `poles` des Schutzorgans aus. Ein real vorhandener, allpolig trennender Schalter und seine Verschaltung sind nicht modelliert.',
    remedy:
      'Trenneinrichtung und allpolige Abschaltung am Aufbau prüfen; Polzahl im Inspektor korrekt deklarieren.',
  },
  {
    id: 'changeover',
    group: 'switching',
    assessment: 'unverifiable',
    title: 'Umschaltung Landstrom ↔ Wechselrichter inkl. Verriegelung',
    basis:
      'Umschalter, mechanische/elektrische Verriegelung und Umschaltzeit existieren im Graphen nicht. `acSourceKindOf` unterscheidet nur die Herkunft eines Pfads.',
    remedy:
      'Umschalteinrichtung, Verriegelung und Verschaltung durch qualifiziertes Personal abnehmen lassen.',
  },
  {
    id: 'backfeed',
    group: 'switching',
    assessment: 'unverifiable',
    title: 'Verhinderung der Rückspeisung / parallelen Einspeisung',
    basis:
      'Es gibt keine Verriegelungs- oder Rückspeiselogik. Zwei gleichzeitige Quellen sind im Plan nicht als Fehlerfall abbildbar.',
    remedy:
      'Rückspeiseschutz und Quellenverriegelung real nachweisen; dieser Bericht trifft dazu keine Aussage.',
  },
  {
    id: 'chassis-bond-real',
    group: 'verification',
    assessment: 'unverifiable',
    title: 'PE zur Karosserie: Anschlussstelle, Übergangswiderstand, Korrosion',
    basis:
      'GND-001 prüft nur den deklarierten Querschnitt der Masseanbindung. Kontaktwiderstand, Massepunkt und Schleifenwiderstand sind nicht messbar/modelliert.',
    remedy:
      'Massepunkt und Übergangswiderstand am Fahrzeug messen und durch qualifiziertes Personal beurteilen lassen.',
  },
  {
    id: 'acceptance',
    group: 'verification',
    assessment: 'unverifiable',
    title: 'Normative Abnahme der 230-V-Installation',
    basis:
      'Die Engine bewertet ein Modell, keine ausgeführte Anlage. Messwerte, Herstellernachweise und Prüfprotokolle sind nicht Gegenstand des Plans.',
    remedy: QUALIFIED_PERSONNEL_NOTICE,
  },
]);

const GROUPS: readonly {
  id: AcScopeItem['group'];
  title: string;
  remedy: string;
}[] = Object.freeze([
  {
    id: 'conductors',
    title: 'Leiter & Netzform',
    remedy:
      'L/N/PE-Verdrahtung, Netzform und Erdungskonzept am realen Aufbau durch qualifiziertes Personal prüfen; deklarierte Felder im Bauteil-Inspektor vervollständigen.',
  },
  {
    id: 'switching',
    title: 'Trennung, Umschaltung & Rückspeisung',
    remedy:
      'Trenn- und Umschalteinrichtungen sowie die Verriegelung gegen Rückspeisung real abnehmen lassen; der Plan modelliert diese Geräte nicht.',
  },
  {
    id: 'verification',
    title: 'Messwerte & Abnahme',
    remedy:
      'Z_s, Auslösezeiten, Masseanschluss und Herstellernachweise vor Ort messen bzw. beibringen; die Abnahme durch qualifiziertes Personal durchführen lassen.',
  },
]);

/**
 * NET-003: Für jeden 230-V-Kreis wird je Gruppe EIN UNVERIFIABLE-Befund
 * erzeugt. Ohne 230-V-Kante ist die Regel „nicht anwendbar" (0 Entitäten) —
 * ein reiner 12-V-Plan bekommt dadurch keine künstlichen Warnungen.
 *
 * `details.acScopeItems` trägt die einzelnen Gegenstände maschinenlesbar,
 * damit Inspektor und Bericht sie nicht aus einem Fließtext rekonstruieren
 * müssen.
 */
export function checkAcModelScope(context: PassContext): CheckResult {
  const ruleId = 'NET-003-ac-model-scope' as const;
  const acCables = sortedCables(context.graph).filter((cable) => cable.domain === 'AC_LV');
  if (acCables.length === 0) return passedCheck(ruleId, 0);

  const events: AuditEvent[] = GROUPS.map((group) => {
    const items = AC_230V_SCOPE_ITEMS.filter((item) => item.group === group.id);
    return auditEvent({
      ruleId,
      entity: { kind: 'system' as const, id: `ac-230v-${group.id}` },
      kind: 'UNVERIFIABLE',
      severity: 'EFFICIENCY_WARNING',
      equation: '¬(„geprüft" ohne modellierten Gegenstand)',
      message:
        `230 V · ${group.title}: ${items.map((item) => item.title).join('; ')} — ` +
        `${AC_ASSESSMENT_LABEL.unverifiable}. ${QUALIFIED_PERSONNEL_NOTICE}`,
      autoFixRemedy: group.remedy,
      details: {
        acAssessment: 'unverifiable',
        acScopeItems: items,
      },
    });
  });

  return checkOrNotApplicable(ruleId, events, acCables.length);
}
