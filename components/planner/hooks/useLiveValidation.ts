import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { SOLAR_DESIGN_MIN_TEMPERATURE_C, stringColdVocOf } from '../../../lib/solar'; // ELE-007
import { chemistriesParallelSafe } from '../../../lib/autoWire/primitives'; // AUTO-003
import { isHouseBattery, reachesHouseBattery } from '../../../lib/autoWire/validation'; // TOPO-002
import { reachableNodeIds } from '../../../lib/domain/graph';
import type { VerificationReport } from '../../../lib/verify';

import { getSystemVoltage } from '../utils/voltage';
import { calculateEdgeCurrent } from '../../../lib/vde-standards';
// V2: Bauteilgrenzen und Strombudget kommen aus der elektrischen Ebene —
// eine Tabelle statt verstreuter `node.type ===`-Zweige.
import {
  componentCurrentLimit,
  computeCurrentBudget,
  deriveBatteryBanks,
  evaluateLoadFeasibility,
  resolveComponentConstraints,
} from '../../../lib/electricalGraph';
import { amps } from '../../../lib/units';
import { verificationReportFor, verificationWarnings } from '../utils/verificationWarnings';
import type { AutoWireConflict, AutoWireReport } from '../../../lib/autoWire/conflicts';
// AUDIT T1: Diagnose-Texte (Typ statt `[object Object]`) kommen aus derselben
// Stelle wie alle anderen Modellwert-Texte — keine zweite Implementierung.
import { diagnosticText } from '../../../lib/safeText';
import { isRouteLocked } from '../../../lib/electricalGraph/intent';
import { useCableRouteFinalValidation } from '../../edges/utils/cableRouteStore';

export interface ValidationWarning {
  id: string;
  category: 'safety' | 'topology' | 'monitoring' | 'estimation' | 'routing';
  type: 'critical' | 'warning' | 'info';
  message: string;
  /** Kurzer, laienverständlicher Titel für die Warn-Zentrale. */
  title?: string;
  /** ID der betroffenen Komponente/Leitung, die "Beheben" im Plan fokussiert. */
  focusId?: string;
  /** Ob focusId eine Node oder eine Kante (Leitung) ist. */
  focusType?: 'node' | 'edge';
  /**
   * Strukturierte Messwerte (AUDIT UX-001): Gemessener Ist-Wert der Regel,
   * erwarteter Grenzwert und Einheit — statt nur Prosa im message-String.
   * `ruleId` benennt die Regel maschinenlesbar, `source` die fachliche
   * Grundlage (Modellannahme oder Norm-Kontext).
   */
  ruleId?: string;
  measuredValue?: string;
  expectedValue?: string;
  unit?: string;
  source?: string;
  /**
   * Fertiger Reparaturvorschlag aus der Verifikations-Engine
   * (`AuditEvent.autoFixRemedy`). Gesetzt nur bei Engine-Befunden: Sie
   * formulieren ihre Abhilfe selbst; die Warn-Zentrale zeigt sie bevorzugt
   * an und fällt nur für Altbefunde auf ihre ID-basierte Textzuordnung
   * zurück (siehe `nextStep`).
   */
  remedy?: string;
  /**
   * Der Befund meldet eine **Datenlücke** („nicht entscheidbar"), keine
   * Verletzung. Die Warn-Zentrale formuliert die Folge-Zeile dann als
   * »ungeprüft« statt als »kann überhitzen« — ein UNPROVABLE als Defekt
   * auszugeben wäre eine Behauptung, die die Engine gerade nicht trifft.
   */
  unverified?: boolean;
}

/** Reihenfolge der Schwere für die Sortierung in der Warn-Zentrale. */
export const SEVERITY_ORDER: Record<ValidationWarning['type'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * AUDIT T1 — Nutzertext ohne `[object Object]`.
 *
 * Diese Datei baut Warnmeldungen aus Knotendaten, deren Felder typseitig lose
 * sind (`label` kommt als `{}` an, Rohwerte als `unknown`). In einem
 * Template-Literal wird daraus stillschweigend die Default-Stringifikation von
 * Object: Die Warn-Zentrale zeigte dann „[object Object]" statt des Bauteils —
 * in genau den Meldungen, die der Nutzer lesen soll, um einen Fehler zu finden.
 * `String(x)` war dabei keine Rettung, sondern dieselbe Falle mit Funktion drum.
 *
 * Bewusst NICHT `safeText` aus `lib/safeText.ts`: Das ist die join-kompatible
 * Variante für Sortierschlüssel und Cache-Signaturen (`true` -> `'true'`,
 * `NaN` -> `'NaN'`). Hier geht es um Nutzertext in einer Warnmeldung, also
 * gilt die Anzeige-Konvention: Boolesche als `ja`/`nein`, Leerzeichen-only und
 * nicht endliche Zahlen als Fallback. Zwei Verträge, zwei Funktionen — aber
 * derselbe Grundsatz, und `diagnosticText` (Diagnose ungültiger Eingaben) ist
 * identisch und liegt deshalb gemeinsam in `lib/safeText.ts`.
 */
function displayText(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() === '' ? fallback : value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  return fallback;
}

/** Anzeigename eines Knotens: Label, sonst Typ, sonst der übergebene Fallback. */
function nodeLabel(node: { type?: string; data?: unknown } | undefined, fallback: string): string {
  const data = node?.data as { label?: unknown } | undefined;
  const label = displayText(data?.label, '');
  if (label !== '') return label;
  const type = displayText(node?.type, '');
  return type !== '' ? type : fallback;
}

/** Ein benanntes Datenfeld eines Knotens als Text (z. B. `chemistry`). */
function nodeField(node: { data?: unknown } | undefined, field: string, fallback: string): string {
  const data = node?.data as Record<string, unknown> | undefined;
  return displayText(data?.[field], fallback);
}

/**
 * Prüfbericht der Verifikations-Engine für den aktuellen Plan.
 *
 * Der Bericht wird genau EINMAL pro Plan berechnet und an alle Verbraucher
 * (`useLiveValidation`, Prüfsiegel) gereicht: Zwei getrennte Aufrufe könnten
 * bei einem Plan, der sich zwischen zwei Renders nicht ändert, nicht
 * auseinanderlaufen — aber sie würden die Rechnung doppelt bezahlen, und ein
 * späterer Zwischenspeicher hätte zwei Wahrheiten (Regel A: ein Plan, ein
 * Ergebnis).
 */
export function useVerificationReport(nodes: Node[], edges: Edge<CableEdgeData>[]): VerificationReport {
  return useMemo(() => verificationReportFor(nodes, edges), [nodes, edges]);
}

/**
 * Live-Prüfung des Plans — zwei Quellen, klar getrennt.
 *
 *   1. **Verifikations-Engine (`lib/verify`)** — Eigentümerin jeder Aussage,
 *      die in ihrer Regelmatrix steht: Konnektivität, Polarität, Domäne,
 *      Topologie, Ampazität (I_b/I_n/I_z, I₂, 0,2-m-Regel, Abschaltvermögen,
 *      Selektivität, Leerrohr), Spannungsfall, Energiebilanz, Erdung,
 *      Fehlerstromschutz, Netzform. Ihre Befunde kommen aus
 *      `verificationWarnings` — inklusive Klartext, Messwert, Grenzwert und
 *      Reparaturvorschlag; hier wird nichts davon nachgerechnet.
 *   2. **Planer-Hinweise (diese Datei)** — Aussagen, die die Engine NICHT
 *      trifft: Mischspannung, Batterie-Chemie, Solar-Voc-Fenster,
 *      Laderegler-Größe, BMS-Stromgrenzen, Ladebooster-Pfad,
 *      Wechselrichter-Minus, ungültige Lastwerte.
 *
 * Beide zusammen ergeben die Liste der Warn-Zentrale. Was in der Matrix der
 * Engine steht, wird hier NICHT ein zweites Mal geprüft: Zwei Implementierungen
 * derselben Aussage können auseinanderlaufen, und der Nutzer bekäme denselben
 * Befund zweimal in unterschiedlichen Worten (Regel M — eine Aussage, eine
 * Quelle).
 *
 * @param report Vorberechneter Prüfbericht (aus `useVerificationReport`).
 *   Fehlt er, wird er hier einmalig berechnet — der Aufrufer im Dashboard
 *   übergibt ihn, damit Anzeige und Prüfsiegel denselben Bericht sehen.
 */
export function useLiveValidation(
  nodes: Node[],
  edges: Edge<CableEdgeData>[],
  report?: VerificationReport,
  autoWireReport?: AutoWireReport | null
): ValidationWarning[] {
  // Quelle ist der vom globalen Router publizierte Final-Report (nicht der
  // Kanten-Tooltip und nicht der separate PlannerError-Store).
  const routingReport = useCableRouteFinalValidation();
  return useMemo(() => {
    if (!nodes || !edges) return [];

    // Die Engine-Befunde stehen vorn: Sie tragen die Norm-/Datenblatt-Herkunft
    // und formulieren ihre Abhilfe selbst.
    const warnings: ValidationWarning[] = verificationWarnings(report ?? verificationReportFor(nodes, edges));

    // Single-pass node classification and indexing O(N) to avoid 8x nodes.filter scans
    const nodeMap = new Map<string, Node>();
    const shorePowerNodes: Node[] = [];
    const solarNodes: Node[] = [];
    const chargers: Node[] = [];
    const batteries: Node[] = [];
    const consumers: Node[] = [];
    const inverters: Node[] = [];
    const dcdcChargers: Node[] = [];
    const shunts: Node[] = [];

    for (const node of nodes) {
      nodeMap.set(node.id, node);

      switch (node.type) {
        case 'shorePower':
          shorePowerNodes.push(node);
          break;
        case 'solar':
        case 'roofSolar':
          solarNodes.push(node);
          break;
        case 'charger':
        case 'mpptController':
          chargers.push(node);
          break;
        case 'battery':
          batteries.push(node);
          break;
        case 'consumer':
        case 'consumer230v':
          consumers.push(node);
          break;
        case 'inverter':
          inverters.push(node);
          break;
        case 'dcdcCharger':
          dcdcChargers.push(node);
          break;
        case 'shunt':
          shunts.push(node);
          break;
      }
    }

    // Pre-build target and source edge maps O(E) to eliminate O(N*E) nested array scans
    const edgesByTarget = new Map<string, Edge<CableEdgeData>[]>();
    const edgesBySource = new Map<string, Edge<CableEdgeData>[]>();

    // ELE-008: Mischspannungsplan verhindern
    //
    // AUDIT ELE-006: Hier stand `Number(b.data?.voltage) || 12`. Batterien
    // tragen ihre Nennspannung aber in `nominalVoltage` (components/nodes/types.ts,
    // geschrieben vom NodeInspector). Die Menge war damit IMMER {12} — die
    // Regel konnte nie feuern, während ihr CI-Test grün blieb, weil das
    // Fixture das Phantomfeld `voltage` benutzte. Gelesen wird jetzt das
    // echte Feld; der fehlende Wert ist ausdrücklich „unbekannt“ (nicht 12),
    // sonst entsteht dieselbe stille Gleichsetzung.
    if (batteries.length > 1) {
      const declaredVoltages = batteries
        .map((b) => Number((b.data as Record<string, unknown> | undefined)?.nominalVoltage))
        .filter((v) => Number.isFinite(v) && v > 0);
      const hasUnknownVoltage = declaredVoltages.length < batteries.length;
      const voltages = new Set(declaredVoltages);
      if (hasUnknownVoltage) {
        warnings.push({
          id: 'mixed-voltage-unknown',
          category: 'estimation',
          type: 'info',
          title: 'Batterie-Nennspannung fehlt',
          ruleId: 'ELE-008-voltage-unknown',
          measuredValue: `${batteries.length - declaredVoltages.length} × ohne Angabe`,
          expectedValue: 'Nennspannung je Batterie eintragen',
          // Kein Einheitenfeld: Der Messwert ist eine ANZAHL ohne Angabe, keine
          // Spannung. Vorher stand hier „V“ und die Zeile las sich
          // „Ist: 2 × ohne Angabe V“ (AUDIT UX-001, Einheiten-Disziplin).
          unit: '',
          source: 'Datenmodell: battery.nominalVoltage (NodeInspector)',
          message:
            'ℹ️ Hinweis: Bei mindestens einer Batterie ist die Nennspannung nicht eingetragen. Die Mischspannungs-Prüfung (12 V / 24 V) kann diese Batterie nicht einbeziehen — trage die Nennspannung im Batterie-Inspektor ein.',
        });
      }
      if (voltages.size > 1) {
        warnings.push({
          id: 'mixed-voltage-batteries',
          category: 'topology',
          type: 'critical',
          title: 'Mischspannung (12 V / 24 V)',
          message:
            'Batterien mit unterschiedlichen Nennspannungen im Plan. Dies ist gefährlich und wird vom Berechnungsmodell nicht unterstützt.',
          ruleId: 'ELE-008-mixed-voltage',
          measuredValue: Array.from(voltages).join(' V, ') + ' V',
          expectedValue: 'einheitliche Spannung',
          unit: 'V',
        });
      }
    }

    for (const edge of edges) {
      let targetList = edgesByTarget.get(edge.target);
      if (!targetList) {
        targetList = [];
        edgesByTarget.set(edge.target, targetList);
      }
      targetList.push(edge);

      let sourceList = edgesBySource.get(edge.source);
      if (!sourceList) {
        sourceList = [];
        edgesBySource.set(edge.source, sourceList);
      }
      sourceList.push(edge);
    }

    const sysVoltage = getSystemVoltage(nodes);

    // Die Bank-Topologie ist eine Eingabe, keine aus der Mitgliederzahl
    // erratene Verschaltung. Deklarierte Zählfehler müssen deshalb schon vor
    // Auto-Wire im Prüfzentrum sichtbar sein.
    const bankModel = deriveBatteryBanks(nodes, sysVoltage);
    const actionableBankQuestions = bankModel.questions.filter(
      (question) =>
        question.kind === 'member-count-mismatch' ||
        question.kind === 'declaration-mismatch' ||
        question.kind === 'missing-counts'
    );
    for (const question of actionableBankQuestions) {
      const mismatch = question.kind !== 'missing-counts';
      warnings.push({
        id: `battery-bank-${question.kind}-${question.bankId}`,
        category: 'topology',
        type: mismatch ? 'critical' : 'warning',
        title:
          question.kind === 'member-count-mismatch'
            ? 'Batterie-Bank: Mitgliederzahl stimmt nicht'
            : question.kind === 'declaration-mismatch'
              ? 'Batterie-Bank: widersprüchliche Deklaration'
              : 'Batterie-Bank: Reihen-/Parallelzahlen fehlen',
        focusId: question.batteryIds[0],
        focusType: 'node',
        ruleId:
          question.kind === 'member-count-mismatch'
            ? 'BANK-COUNT-MISMATCH'
            : question.kind === 'declaration-mismatch'
              ? 'BANK-DECLARATION-MISMATCH'
              : 'BANK-MISSING-COUNTS',
        expectedValue:
          question.kind === 'missing-counts' ? 'bankSeries × bankParallel = Mitgliederzahl' : undefined,
        unit: '',
        source: 'Explizite Angaben am Batteriebank-Modell',
        message: `${mismatch ? 'Kritisch' : 'Hinweis'}: ${question.question}`,
      });
    }

    // --- Rule A5: Parallelschaltung inkompatibler Batterie-Chemien (AUTO-003) ---
    // Auto-Wire legt AGM ‖ Gel nicht mehr auf die Schiene, aber Nutzer-Kanten
    // sind weiterhin frei ziehbar: plus↔plus / minus↔minus zwischen Batterien
    // ist eine Parallelschaltung — bei unterschiedlichen Chemien mit
    // verschiedenen Ladeschlussspannungen lädt ein Partner dauerüber/unter.
    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (sourceNode?.type !== 'battery' || targetNode?.type !== 'battery') return;
      const sPlus = edge.sourceHandle?.includes('plus') ?? false;
      const tPlus = edge.targetHandle?.includes('plus') ?? false;
      const sMinus = edge.sourceHandle?.includes('minus') ?? false;
      const tMinus = edge.targetHandle?.includes('minus') ?? false;
      const isParallel = (sPlus && tPlus) || (sMinus && tMinus);
      if (!isParallel) return; // plus↔minus = Serienfall, dafür gibt es A3
      if (chemistriesParallelSafe(sourceNode, targetNode)) return;
      warnings.push({
        id: `battery-parallel-chemistry-${edge.id}`,
        category: 'safety',
        type: 'critical',
        title: 'Batterie-Chemien nicht parallel-sicher',
        focusId: edge.id,
        focusType: 'edge',
        ruleId: 'AUTO-003-parallel-chemistry',
        measuredValue: `${nodeField(sourceNode, 'chemistry', '?')} ‖ ${nodeField(targetNode, 'chemistry', '?')}`,
        expectedValue: 'identische Chemie (z. B. AGM ‖ AGM)',
        unit: '',
        source: 'Modell: Ladeschlussspannungen/Fenster je Chemie (AGM ~14,4–14,7 V, Gel ~14,1–14,4 V)',
        message: `⚠️ Kritisch: „${nodeLabel(sourceNode, 'Batterie')}“ (${nodeField(sourceNode, 'chemistry', '?')}) und „${nodeLabel(targetNode, 'Batterie')}“ (${nodeField(targetNode, 'chemistry', '?')}) sind parallel geschaltet. Unterschiedliche Chemien haben unterschiedliche Ladeschlussspannungen — ein Partner wird dauerhaft über- oder unterladen (Sulfatierung/Gasung). Trenne die Verbindung oder verwende identische Chemien.`,
      });
    });

    // --- Rule A6: MPPT-Voc-Fenster bei Kälte (AUDIT ELE-007) ---
    // Der Regler muss die KALT-Leerlaufspannung des Strings verkraften:
    // Voc(T_min) = Voc_STC · (1 + |TK| · (25 °C − T_min)), Modell-T_min = −20 °C.
    // Geprüft wird, sobald der Regler ein maxPvVoltage-Eintrag hat; fehlen
    // Panel-Voc-Datenblattwerte, fordert eine Hinweis-Warnung sie an (still
    // überschätzen wäre die alte, unsichere Variante).
    nodes.forEach((mppt) => {
      if (mppt.type !== 'mpptController') return;
      const maxPvVoltage = Number((mppt.data as Record<string, unknown> | undefined)?.maxPvVoltage || 0);
      if (maxPvVoltage <= 0) {
        // AUDIT ELE-008: Vorher `return` — der „Voc fehlt“-Hinweis unten stand
        // im else-Zweig hinter dieser Zeile und war damit für genau den Fall
        // unerreichbar, für den er geschrieben war: Ein MPPT-String ohne
        // Eingangsfenster blieb komplett stumm (UNKNOWN sah aus wie „ok“).
        warnings.push({
          id: `solar-voc-window-unknown-${mppt.id}`,
          category: 'estimation',
          type: 'warning',
          title: 'MPPT-Eingangsspannung nicht angegeben — Fenster unbewertet',
          focusId: mppt.id,
          focusType: 'node',
          ruleId: 'ELE-007-voc-window-unknown',
          measuredValue: 'maxPvVoltage fehlt',
          expectedValue: 'max. PV-Eingangsspannung laut Datenblatt',
          unit: '',
          source: 'Regel M: fehlende Eingabe ⇒ UNKNOWN; Modell prüft Voc(T_min) gegen maxPvVoltage',
          message:
            '⚠️ Hinweis: Am Laderegler ist die maximale PV-Eingangsspannung nicht eingetragen. Die Kalt-Voc-Prüfung (Strings können bei −10 °C über die Leerlaufspannung hinausgehen) ist damit unbewertet. Wert im Regler-Inspektor eintragen — erst dann prüft das Modell das Eingangsfenster.',
        });
        return;
      }
      // Erreichbare Panels ab dem Regler — undirektional über alle Kanten.
      // Die Breitensuche stand hier als dritte Kopie derselben Logik im Baum;
      // sie liegt jetzt in `reachableNodeIds` (lib/domain/graph.ts), das auch
      // die Pfadprüfung des Ladeboosters (TOPO-002) benutzt.
      const visited = reachableNodeIds(mppt.id, edges);
      const connectedNodes = nodes.filter((n) => visited.has(n.id));
      const { stringVoc, missingVoc, uncomputableVoc } = stringColdVocOf(connectedNodes, edges);
      const worst = stringVoc.length > 0 ? Math.max(...stringVoc) : 0;
      if (worst > maxPvVoltage) {
        warnings.push({
          id: `solar-voc-window-${mppt.id}`,
          category: 'safety',
          type: 'critical',
          title: 'MPPT-Eingangsspannung zu klein für Kalt-Voc',
          focusId: mppt.id,
          focusType: 'node',
          ruleId: 'ELE-007-voc-window',
          measuredValue: `Voc kalt ≈ ${Math.round(worst)} V (bei ${SOLAR_DESIGN_MIN_TEMPERATURE_C} °C)`,
          expectedValue: `max. ${maxPvVoltage} V`,
          unit: 'V',
          source: 'Modellannahme: Voc(T_min) = Voc_STC · (1 + |TK|·ΔT); TK-Default −0,35 %/K (c-Si)',
          message: `⚠️ Kritisch: Die Leerlaufspannung des Solar-Strings steigt in der Kälte auf ≈ ${Math.round(
            worst
          )} V (Auslegungstemperatur ${SOLAR_DESIGN_MIN_TEMPERATURE_C} °C) — der Laderegler „${nodeLabel(
            mppt,
            'MPPT'
          )}“ erlaubt aber max. ${maxPvVoltage} V. Überspannung zerstört den Regler. Strings kürzen (weniger Panels in Serie) oder Regler mit höherem PV-Eingangsbereich wählen.`,
        });
      } else if (missingVoc) {
        warnings.push({
          id: `solar-voc-missing-${mppt.id}`,
          category: 'estimation',
          type: 'info',
          title: 'Solar-Voc-Datenblattwerte fehlen',
          focusId: mppt.id,
          focusType: 'node',
          ruleId: 'ELE-007-voc-missing-data',
          measuredValue: 'Voc nicht angegeben',
          expectedValue: 'Voc (STC) je Panel',
          unit: '',
          source: 'Modell: Voc-Fensterprüfung nur mit Datenblattwert (schätzen wäre unehrlich)',
          message: `ℹ️ Hinweis: Für die Kalt-Voc-Prüfung des Ladereglers fehlt bei mindestens einem Panel der Datenblattwert „Leerlaufspannung Voc“. Trage ihn im Panel-Inspektor ein, damit das Eingangsfenster geprüft werden kann.`,
        });
      }
      // AUDIT S1: Voc ist eingetragen, aber die Kalt-Voc ist nicht auswertbar —
      // der Temperaturfaktor (1 + |TK|·ΔT) ist nicht positiv. Früher flog hier
      // ein uncaught RangeError aus lib/units.ts (volts() lehnt negative Werte
      // ab), jetzt liefert das Modell null. Die Prüfung fällt damit aus und
      // muss das SELBST sagen: ein still unterschätztes Voc-Fenster (das Panel
      // zahlt 0 V ein) wäre die gefährlichere Variante.
      if (uncomputableVoc) {
        warnings.push({
          id: `solar-voc-uncomputable-${mppt.id}`,
          category: 'estimation',
          type: 'warning',
          title: 'Kalt-Voc nicht auswertbar — Temperaturkoeffizient prüfen',
          focusId: mppt.id,
          focusType: 'node',
          ruleId: 'ELE-007-voc-uncomputable',
          measuredValue: 'Voc vorhanden, Temperaturfaktor ≤ 0',
          expectedValue: 'TK im Bereich −0,20…−0,50 %/K (c-Si)',
          unit: '',
          source: 'Modell: Voc(T) = Voc_STC · (1 + |TK|·(25 °C − T)); Faktor muss positiv sein',
          message: `⚠️ Warnung: Bei mindestens einem Panel ist die kalte Leerlaufspannung nicht berechenbar — der eingetragene Temperaturkoeffizient Voc liegt außerhalb des Modellbereichs (üblich sind −0,20 bis −0,50 %/K für c-Si). Die Voc-Fensterprüfung des Ladereglers ist damit AUSGEFALLEN, nicht bestanden. Wert im Panel-Inspektor korrigieren.`,
        });
      }
    });

    // --- Rule A4: Direktes Solar an DC (ohne MPPT) ---
    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return;

      const isSourceSolar = sourceNode.type === 'solar' || sourceNode.type === 'roofSolar';
      const isTargetSolar = targetNode.type === 'solar' || targetNode.type === 'roofSolar';

      if (isSourceSolar || isTargetSolar) {
        const otherNode = isSourceSolar ? targetNode : sourceNode;
        const isOtherSolar = otherNode.type === 'solar' || otherNode.type === 'roofSolar';
        const isCharger = otherNode.type === 'mpptController' || otherNode.type === 'charger';
        const isFuse = otherNode.type === 'fuse';
        const isConduit = otherNode.type === 'conduit';
        const isGround = otherNode.type === 'ground'; // Solar minus to ground is sometimes OK

        if (!isOtherSolar && !isCharger && !isFuse && !isConduit && !isGround) {
          const solarNode = isSourceSolar ? sourceNode : targetNode;
          warnings.push({
            id: `solar-direct-${edge.id}`,
            category: 'topology',
            type: 'critical',
            title: 'Solar ohne Laderegler',
            message: `Kritisch: Das Solarmodul "${nodeLabel(solarNode, 'Solar')}" ist direkt mit "${nodeLabel(otherNode, '?')}" verbunden. Solarmodule müssen zwingend über einen Laderegler (MPPT) an das System angeschlossen werden!`,
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'ELE-009-solar-direct',
            measuredValue: `Solar → ${otherNode.type}`,
            expectedValue: 'Solar → Laderegler',
            unit: '',
          });
        }
      }
    });

    // --- Rule B: Overloaded Solar Regulator ---
    if (solarNodes.length > 0 && chargers.length > 0) {
      const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
      const mpptCapacity =
        chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * sysVoltage;

      if (totalSolarWatts > mpptCapacity) {
        warnings.push({
          id: 'solar-overload',
          category: 'estimation',
          type: 'warning',
          title: 'Solarregler zu klein',
          focusId: chargers[0]?.id,
          focusType: 'node',
          message: `⚠️ Hinweis: Solarregler unterdimensioniert (Solar: ~${totalSolarWatts}W, MPPT max: ~${Math.round(mpptCapacity)}W).`,
        });
      }
    }

    // --- Rule BMMS: BMS-Dauerstromgrenzen (AUDIT ELE-005) ---
    // Die Batterie-/BMS-Grenzwerte sind im Datenmodell vorhanden, wurden aber
    // nie geprüft. Eine 50-A-BMS-Batterie mit einem 1,5-kW-Wechselrichter
    // (~138 A) wäre sonst ein „sicherer“ AutoWire-Plan. Bei explizit
    // eingetragener Grenze prüfen wir die berechneten DC-Ströme der
    // Batterie-Hauptleitungen.
    for (const battery of batteries) {
      const dischargeLimit = Number(battery.data?.bmsContinuousDischarge || 0);
      const chargeLimit = Number(battery.data?.bmsContinuousCharge || 0);
      for (const edge of edges) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        const isBatterySourcePlus = edge.source === battery.id && !!edge.sourceHandle?.includes('plus');
        const isBatteryTargetPlus = edge.target === battery.id && !!edge.targetHandle?.includes('plus');
        if (!isBatterySourcePlus && !isBatteryTargetPlus) continue;
        const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage, edges);
        if (dischargeLimit > 0 && isBatterySourcePlus && I > dischargeLimit) {
          warnings.push({
            id: `bms-discharge-${battery.id}-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Batterie-/BMS-Dauerstrom überschritten',
            focusId: battery.id,
            focusType: 'node',
            ruleId: 'ELE-005-bms-discharge',
            measuredValue: `${Math.round(I)} A`,
            expectedValue: `max. ${dischargeLimit} A`,
            unit: 'A',
            source: 'Batteriemodell: bmsContinuousDischarge (BMS-Grenze)',
            message: `⚠️ Kritisch: Die Leitung von „${nodeLabel(
              battery,
              'Batterie'
            )}“ wird mit ≈${Math.round(I)} A belastet, das BMS erlaubt dauerhaft nur ${dischargeLimit} A. Kabeldimensionierung und Sicherung schützen das Kabel, nicht das BMS — die Batterie kann abgeschaltet werden oder Schaden nehmen.`,
          });
        }
        if (chargeLimit > 0 && isBatteryTargetPlus && I > chargeLimit) {
          warnings.push({
            id: `bms-charge-${battery.id}-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Batterie-/BMS-Ladestrom überschritten',
            focusId: battery.id,
            focusType: 'node',
            ruleId: 'ELE-005-bms-charge',
            measuredValue: `${Math.round(I)} A`,
            expectedValue: `max. ${chargeLimit} A`,
            unit: 'A',
            source: 'Batteriemodell: bmsContinuousCharge (BMS-Grenze)',
            message: `⚠️ Kritisch: Der Ladezweig zu „${nodeLabel(
              battery,
              'Batterie'
            )}“ führt ≈${Math.round(I)} A, das BMS erlaubt dauerhaft nur ${chargeLimit} A Ladestrom.`,
          });
        }
      }
    }

    // --- Rule CMP: Bauteilgrenzen (V2-LIMIT-001) ---
    //
    // Befund: Geprüft wurden bisher NUR die BMS-Werte der Batterie. Jede
    // andere eingetragene Grenze — Nennstrom der Sammelschiene, Ladestrom des
    // Reglers, Dauerstrom des Boosters — stand im Plan, wurde aber von keiner
    // Regel gelesen. Eine 150-A-Schiene mit 300 A Last war ein „fertig
    // dimensionierter\" Plan mit grünem Haken.
    //
    // Die Grenzen kommen aus `resolveComponentConstraints` (eine Tabelle, kein
    // Typ-Vergleich), der Strom aus der EINEN Quelle `calculateEdgeCurrent`.
    // Es wird ausschließlich geprüft, was ausdrücklich eingetragen ist —
    // fehlende Angaben erzeugen hier keine Meldung (das wäre Lärm), sondern
    // bleiben in der Domänenschicht als „nicht bewertbar\" sichtbar.
    for (const node of nodes) {
      if (node.type === 'battery') continue; // deckt Rule BMMS ab
      const constraints = resolveComponentConstraints({
        type: node.type,
        data: node.data as Record<string, unknown>,
      });
      if (!constraints.allowedDomains?.includes('DC_12V')) continue;
      const limit = componentCurrentLimit(constraints);
      if (limit === undefined) continue;

      let worst = 0;
      let worstEdgeId: string | undefined;
      for (const edge of edges) {
        if (edge.source !== node.id && edge.target !== node.id) continue;
        if (edge.data?.edgeDomain === 'AC_230V') continue;
        const current = calculateEdgeCurrent(
          nodeMap.get(edge.source),
          nodeMap.get(edge.target),
          nodes,
          sysVoltage,
          edges
        );
        if (current > worst) {
          worst = current;
          worstEdgeId = edge.id;
        }
      }
      if (worst <= 0) continue;

      const verdict = evaluateLoadFeasibility(
        amps(worst),
        computeCurrentBudget({ component: limit }),
        `„${nodeLabel(node, 'Bauteil')}“`
      );
      // Nur die ÜBERSCHREITUNG ist ein Befund. Die 90-%-Reserve aus
      // `evaluateLoadFeasibility` gilt für Abschaltschwellen (BMS), nicht für
      // den Nennbetrieb eines Bauteils: Ein 30-A-Laderegler, der 30 A liefert,
      // tut genau das, wofür er gekauft wurde — eine Warnung darüber wäre
      // Lärm und würde echte Befunde zudecken.
      if (verdict.feasible) continue;
      warnings.push({
        id: `component-limit-${node.id}`,
        category: 'safety',
        type: 'critical',
        title: 'Bauteil über seiner Belastungsgrenze',
        focusId: worstEdgeId ?? node.id,
        focusType: worstEdgeId ? 'edge' : 'node',
        ruleId: 'ELE-010-component-limit',
        measuredValue: `${Math.round(worst)} A`,
        expectedValue: `max. ${Math.round(limit)} A`,
        unit: 'A',
        source: 'Bauteildaten (Nennstrom/Dauerstrom laut Eingabe)',
        message: `⚠️ Kritisch: ${verdict.message} Die Leitung ist zwar passend dimensioniert, das Bauteil selbst trägt diesen Strom aber nicht.`,
      });
    }

    // --- Rule E: DC-DC Charger Connection ---
    dcdcChargers.forEach((charger) => {
      const hasInput = (edgesByTarget.get(charger.id)?.length ?? 0) > 0;
      const hasOutput = (edgesBySource.get(charger.id)?.length ?? 0) > 0;

      if (!hasInput || !hasOutput) {
        warnings.push({
          id: `dcdc-unconnected-${charger.id}`,
          category: 'topology',
          type: 'warning',
          title: 'Ladebooster nicht komplett',
          focusId: charger.id,
          focusType: 'node',
          message: `💡 Hinweis: Der Ladebooster (DC-DC) scheint nicht vollständig angeschlossen zu sein. Bitte Starterseite (Eingang) und Aufbaubatterie-Pfad (Ausgang) prüfen.`,
        });
      }
    });

    /**
     * Rule E2 (TOPO-002): Der Ladebooster erreicht keine Aufbaubatterie.
     *
     * Warum es diese Regel gibt (Prüfbericht 2026-09-28): Regel E prüft nur,
     * DASS ein Ein- und ein Ausgang existiert. Eine Kante Booster → Schiene
     * genügte damit auch dann, wenn die Schiene mit keiner Aufbaubatterie
     * verbunden war — während die Meldung „Aufbaubatterie-Pfad (Ausgang)
     * prüfen" genau das versprach. Ein Versprechen ohne Prüfung ist ein
     * stiller Fallback: Der Plan sah geprüft aus und war es nicht.
     *
     * Hier wird der Pfad tatsächlich gelaufen (`reachesHouseBattery`) — über
     * die Schienen, undirektional, weil die Aufbaubatterie in Richtung
     * Batterie → Schiene verdrahtet ist und der Lader in Richtung Lader →
     * Schiene. Zwei Fälle, zwei ehrliche Meldungen: keine Aufbaubatterie im
     * Plan (dann kann keine erreicht werden) oder vorhanden, aber nicht
     * angeschlossen.
     */
    if (dcdcChargers.length > 0) {
      const houseBatteries = batteries.filter(isHouseBattery);
      for (const charger of dcdcChargers) {
        const hasInput = (edgesByTarget.get(charger.id)?.length ?? 0) > 0;
        const hasOutput = (edgesBySource.get(charger.id)?.length ?? 0) > 0;
        // Unvollständig angeschlossen ⇒ Regel E meldet es bereits; hier gäbe
        // es sonst zwei Meldungen für denselben Sachverhalt.
        if (!hasInput || !hasOutput) continue;

        if (houseBatteries.length === 0) {
          warnings.push({
            id: `dcdc-no-house-battery-${charger.id}`,
            category: 'topology',
            type: 'warning',
            title: 'Ladebooster ohne Aufbaubatterie im Plan',
            focusId: charger.id,
            focusType: 'node',
            ruleId: 'TOPO-002-dcdc-house-path',
            measuredValue: '0 Aufbaubatterien',
            expectedValue: '≥ 1 Aufbaubatterie am Ladepfad',
            unit: '',
            source:
              'Regel E2: Pfadprüfung Lader → Verteilung → Aufbaubatterie (Regel M: fehlendes Ziel ist UNKNOWN, nicht OK)',
            message: `⚠️ Hinweis: Im Plan ist keine Aufbaubatterie vorhanden — der Ladebooster kann nichts laden. Eine Batterie mit Rolle „Aufbau" anlegen; die Starterseite zählt nicht.`,
          });
          continue;
        }

        if (!reachesHouseBattery(charger.id, nodes, edges)) {
          warnings.push({
            id: `dcdc-house-path-${charger.id}`,
            category: 'topology',
            type: 'warning',
            title: 'Ladebooster erreicht die Aufbaubatterie nicht',
            focusId: charger.id,
            focusType: 'node',
            ruleId: 'TOPO-002-dcdc-house-path',
            measuredValue: '0 erreichbare Aufbaubatterien',
            expectedValue: '≥ 1 erreichbare Aufbaubatterie',
            unit: '',
            source:
              'Regel E2: Pfadprüfung Lader → Verteilung → Aufbaubatterie (Regel M: keine stille Annahme „angeschlossen")',
            message: `⚠️ Hinweis: Der Ladebooster hat Ein- und Ausgang, aber vom Ausgang führt kein Pfad zu einer Aufbaubatterie — geladen wird nur die Starterseite. Verbindung zur Verteilung/Sammelschiene prüfen, an der die Aufbaubatterie hängt.`,
          });
        }
      }
    }

    // --- Rule DATA: Ungültige Last-/Stromwerte (AUDIT ELE-009) ---
    // Negative Werte und NaN dürfen nicht still als 0 A verschwinden. Das
    // würde Kabel und Sicherung zu klein erscheinen lassen, während das Gerät
    // real Leistung zieht.
    for (const node of nodes) {
      const data = node.data as Record<string, unknown> | undefined;
      for (const field of ['watts', 'amps'] as const) {
        const raw = data?.[field];
        if (raw === undefined || raw === null || raw === '') continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          warnings.push({
            id: `invalid-load-${node.id}-${field}`,
            category: 'safety',
            type: 'critical',
            title: 'Ungültiger Last-/Stromwert',
            focusId: node.id,
            focusType: 'node',
            ruleId: 'DATA-001-invalid-load-value',
            measuredValue: diagnosticText(raw),
            expectedValue: 'endlicher Wert ≥ 0',
            source: 'Datenmodell: watts/amps ≥ 0 (Import-/Altdaten-Validierung)',
            message: `⚠️ Kritisch: Bei „${nodeLabel(node, '?')}“ ist ${
              field === 'watts' ? 'die Leistung' : 'der Strom'
            } ungültig (${diagnosticText(raw)}). Der Wert wird intern als 0 A behandelt und kann zu dünn dimensionierte Leitungen verbergen. Korrigiere die Angabe im Inspektor.`,
          });
        }
      }
    }

    // --- Auto-Wire-Bericht (V2-CONFLICT-001) ---------------------------
    // Der Automat entscheidet nicht heimlich. Was er NICHT entscheiden
    // konnte (offene Fragen) und wo seine Regel der Nutzereingabe
    // widerspricht, steht hier in derselben Liste wie jeder andere Befund —
    // vorher verschwand der Bericht im Rückgabewert von `performAutoWiring`.
    if (autoWireReport) {
      const bankQuestionTexts = new Set(actionableBankQuestions.map((question) => question.question));
      const autoWarnings = autoWireWarnings(autoWireReport, nodeMap, edges).filter(
        (warning) =>
          warning.ruleId !== 'AUTO-OPEN-QUESTION' ||
          ![...bankQuestionTexts].some((question) => warning.message.includes(question))
      );
      warnings.push(...autoWarnings);
    }

    // Final-Validation ist die kanonische Routing-Diagnose. Ein Befund wird
    // nur dann zur Lock-Warnung, wenn seine edgeId tatsächlich eine fixierte
    // Plan-Kante ist; Tooltip-Prosa wird nie als Datenquelle geparst.
    const lockedEdges = new Map(edges.filter(isRouteLocked).map((edge) => [edge.id, edge]));
    for (const violation of routingReport?.violations ?? []) {
      const lockedId = [violation.edgeId, violation.otherId].find(
        (id) => id !== undefined && lockedEdges.has(id)
      );
      if (!lockedId) continue;
      const invariant = violation.invariant;
      warnings.push({
        id: `route-lock-${invariant}-${lockedId}-${violation.otherId ?? 'node'}`,
        category: 'routing',
        type: invariant === 'I3' ? 'warning' : 'critical',
        title:
          invariant === 'I1'
            ? 'Fixierte Leitung kollidiert mit einem Bauteil'
            : invariant === 'I2'
              ? 'Fixierte Leitung überdeckt eine andere Leitung'
              : 'Fixierte Leitung unterschreitet den Mindestabstand',
        focusId: lockedId,
        focusType: 'edge',
        ruleId: `ROUTE-LOCK-${invariant}`,
        expectedValue:
          invariant === 'I1'
            ? 'keine Kollision'
            : invariant === 'I2'
              ? 'keine Überdeckung'
              : 'Mindestabstand eingehalten',
        source: 'Globaler Routing-Pass: Final-Validation der veröffentlichten Wegpunkte',
        remedy: 'Leitung entsperren, die Bauteile/Leitungsführung anpassen und bei Bedarf erneut fixieren.',
        message: violation.detail,
      });
    }
    const lockRemedy = (code: string): string =>
      code === 'ROUTE-LOCK-MISSING'
        ? 'Leitung entsperren und erneut fixieren, damit ein unveränderlicher Wegpunktsnapshot gespeichert wird.'
        : 'Leitung entsperren, Bauteilposition oder Verbindung korrigieren und nach der Prüfung erneut fixieren.';
    const lockTitles: Record<string, string> = {
      'ROUTE-LOCK-MISSING': 'Fixierte Leitung hat keinen Wegpunktsnapshot',
      'ROUTE-LOCK-GEOMETRY': 'Fixierte Leitungsgeometrie wurde verändert',
      'ROUTE-LOCK-ENDPOINT': 'Fixierte Leitung passt nicht mehr zu ihren Anschlüssen',
      'ROUTE-LOCK-INVALID': 'Fixierter Leitungsweg ist ungültig',
    };
    for (const violation of routingReport?.lockedRouteViolations ?? []) {
      if (!lockedEdges.has(violation.edgeId)) continue;
      warnings.push({
        id: `${violation.code}-${violation.edgeId}`,
        category: 'routing',
        type: 'critical',
        title: lockTitles[violation.code] ?? 'Konflikt an fixierter Leitung',
        focusId: violation.edgeId,
        focusType: 'edge',
        ruleId: violation.code,
        expectedValue: 'gespeicherte Geometrie und aktuelle Anschlusspunkte stimmen überein',
        source: 'Globaler Routing-Pass: Lock-Snapshot-/Endpunktprüfung',
        remedy: lockRemedy(violation.code),
        message: violation.detail,
      });
    }

    return warnings;
  }, [nodes, edges, report, autoWireReport, routingReport]);
}

/**
 * Bildet den Auto-Wire-Bericht auf Warnungen ab.
 *
 * Der Bericht ist eine MOMENTAUFNAHME des letzten Laufs. Befunde, deren
 * Bauteile oder Leitungen es nicht mehr gibt, werden deshalb verworfen:
 * Sonst stünde nach dem Löschen einer Batterie noch die Frage nach ihrer
 * Verschaltung in der Liste. Was der Nutzer dagegen NICHT geändert hat,
 * bleibt stehen, bis Auto-Wire erneut läuft — eine offene Entscheidung
 * verschwindet nicht dadurch, dass man woanders klickt.
 */
function autoWireWarnings(
  report: AutoWireReport,
  nodeMap: Map<string, Node>,
  edges: Edge<CableEdgeData>[]
): ValidationWarning[] {
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const stillPresent = (conflict: AutoWireConflict) =>
    conflict.nodeIds.every((id) => nodeMap.has(id)) && conflict.edgeIds.every((id) => edgeIds.has(id));

  const out: ValidationWarning[] = [];
  for (const conflict of report.conflicts) {
    if (!stillPresent(conflict)) continue;
    const focusEdge = conflict.edgeIds[0];
    const focusNode = conflict.nodeIds[0];
    out.push({
      id: `autowire-${conflict.ruleId}-${focusEdge ?? focusNode ?? 'plan'}`,
      category: AUTO_WIRE_CATEGORY[conflict.kind],
      type: conflict.severity,
      title: AUTO_WIRE_TITLE[conflict.kind],
      message: conflict.message,
      ruleId: conflict.ruleId,
      source: 'Auto-Verdrahtung',
      ...(focusEdge
        ? { focusId: focusEdge, focusType: 'edge' as const }
        : focusNode
          ? { focusId: focusNode, focusType: 'node' as const }
          : {}),
    });
  }

  // Offene Fragen sind keine Fehler, sondern fehlende Entscheidungen. Sie
  // stehen als Hinweis in der Liste, damit sie beantwortet werden — geraten
  // wird nicht (AUTO-BANK-001 / AUTO-AC-001).
  for (const [index, question] of report.questions.entries()) {
    out.push({
      id: `autowire-question-${index}`,
      category: 'topology',
      type: 'info',
      title: 'Offene Entscheidung',
      message: `❓ ${question}`,
      ruleId: 'AUTO-OPEN-QUESTION',
      source: 'Auto-Verdrahtung',
    });
  }
  return out;
}

const AUTO_WIRE_CATEGORY: Readonly<Record<AutoWireConflict['kind'], ValidationWarning['category']>> = {
  'pinned-edge-violates-rule': 'topology',
  'healed-user-edge': 'topology',
  'dropped-user-edge': 'topology',
  'ambiguous-battery-topology': 'topology',
  'ambiguous-ac-source': 'topology',
  'load-exceeds-limit': 'safety',
  'voltage-mismatch': 'safety',
};

const AUTO_WIRE_TITLE: Readonly<Record<AutoWireConflict['kind'], string>> = {
  'pinned-edge-violates-rule': 'Benutzerentscheidung widerspricht einer Regel',
  'healed-user-edge': 'Eigene Leitung wurde eingefädelt',
  'dropped-user-edge': 'Eigene Leitung wurde entfernt',
  'ambiguous-battery-topology': 'Batterie-Verschaltung ist nicht erklärt',
  'ambiguous-ac-source': '230-V-Quelle ist nicht eindeutig',
  'load-exceeds-limit': 'Last übersteigt die zulässige Belastbarkeit',
  'voltage-mismatch': 'Bauteil passt nicht zur Spannungsebene',
};
