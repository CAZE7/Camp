import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { getEdgeDomain } from '../../../lib/electrical';
import { SOLAR_DESIGN_MIN_TEMPERATURE_C, stringColdVocOf } from '../../../lib/solar'; // ELE-007
import { chemistriesParallelSafe } from '../../../lib/autoWire/primitives'; // AUTO-003
import {
  FUSE_BREAKING_CAPACITY_A,
  bankShortCircuitCurrentA,
  breakingCapacityAOf,
  shortCircuitAtFuseA,
} from '../../../lib/shortCircuit'; // DOM-002
import {
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  UPSTREAM_IMPEDANCE_MIN_OHM, // AUDIT N1: Niederimpedanz-Grenze der Einspeisung
  acSourceKindOf,
  evaluateAcEdgeProtection,
} from '../../../lib/acProtection'; // DOM-001

import { getSystemVoltage } from '../utils/voltage';
import { calculateEdgeCurrent } from '../../../lib/vde-standards';
import { acCurrentA } from '../../../lib/autoWire/sizing';
import { assessCableSelection, designAmpacity, isThermallyOverloaded } from '../../../lib/electrical';
import { PX_PER_METER } from '../../../lib/units';
// AUDIT T1: Diagnose-Texte (Typ statt `[object Object]`) kommen aus derselben
// Stelle wie alle anderen Modellwert-Texte — keine zweite Implementierung.
import { diagnosticText } from '../../../lib/safeText';

export interface ValidationWarning {
  id: string;
  category: 'safety' | 'topology' | 'monitoring' | 'estimation';
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

export function useLiveValidation(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  return useMemo(() => {
    const warnings: ValidationWarning[] = [];

    if (!nodes || !edges) return warnings;

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
          unit: 'V',
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

    // --- Rule A: Quellschutz-Regel ---
    // Look for edges coming from battery, inverter, solar charger on positive line
    edges.forEach((edge) => {
      if (edge.data?.edgeDomain === 'AC_230V') return; // Skip DC fuse warning for AC edges
      if (edge.sourceHandle?.includes('plus')) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        const isHighPowerSource =
          sourceNode?.type === 'battery' ||
          sourceNode?.type === 'inverter' ||
          sourceNode?.type === 'solar' ||
          sourceNode?.type === 'roofSolar' ||
          ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(
            sourceNode?.type as string
          );
        const isProtectedTarget = targetNode?.type === 'fuse';

        if (isHighPowerSource && !isProtectedTarget) {
          if (!edge.data?.fuseSize) {
            warnings.push({
              id: `missing-fuse-${edge.id}`,
              category: 'safety',
              type: 'critical',
              title: 'Sicherung fehlt',
              focusId: edge.id,
              focusType: 'edge',
              message: `⚠️ Kritisch: Quellschutz fehlt! Die Leitung von ${nodeLabel(sourceNode, '?')} muss direkt am Anfang abgesichert werden (Kabel-Sicherung oder Sicherungsblock).`,
            });
          }
        }
      }
    });

    const sysVoltage = getSystemVoltage(nodes);

    // --- Rule A3: Verpolte Gleichspannungs-Quellen (AUDIT ELE-003) ---
    // Die Polaritäts-Ausnahme für battery×battery / solar×solar in
    // isValidConnection erlaubt plus↔minus-Kanten (Serienverschaltung).
    // Ohne separates Serien-Modell ist dieselbe Kante eine VERPOLTE
    // PARALLELSCHALTUNG, sobald beide Quellen zusätzlich auf gemeinsamen
    // Schienen liegen — im realen Fahrzeug ein Kurzschluss im kA-Bereich.
    // Die Kante wird daher nie still akzeptiert: kritische Warnung mit
    // Klartext, was elektrisch passiert.
    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return;
      const isBatteryPair = sourceNode.type === 'battery' && targetNode.type === 'battery';
      const isSolarPair =
        (sourceNode.type === 'solar' || sourceNode.type === 'roofSolar') &&
        (targetNode.type === 'solar' || targetNode.type === 'roofSolar');
      if (!isBatteryPair && !isSolarPair) return;
      const reversed =
        (edge.sourceHandle?.includes('plus') && edge.targetHandle?.includes('minus')) ||
        (edge.sourceHandle?.includes('minus') && edge.targetHandle?.includes('plus'));
      if (!reversed) return;
      warnings.push({
        id: `reversed-polarity-${edge.id}`,
        category: 'safety',
        type: 'critical',
        title: 'Polarität vertauscht',
        focusId: edge.id,
        focusType: 'edge',
        ruleId: 'ELE-003-reversed-polarity',
        measuredValue: `${edge.sourceHandle} → ${edge.targetHandle}`,
        expectedValue: 'plus → plus / minus → minus',
        unit: '',
        source: 'Polaritätsmodell (Physik): verpolte Parallelschaltung = Kurzschluss',
        message: `⚠️ Kritisch: Polarität vertauscht! ${
          isBatteryPair ? 'Zwei Batterien' : 'Zwei Solarpanele'
        } sind plus auf minus verbunden. Als Parallelschaltung ist das ein direkter Kurzschluss; eine Serienschaltung (z. B. 24 V) ist im Planer nicht modelliert — trenne diese Verbindung und verbinde gleiche Pole (plus→plus, minus→minus).`,
      });
    });

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
          unit: 'V',
          source: 'Regel M: fehlende Eingabe ⇒ UNKNOWN; Modell prüft Voc(T_min) gegen maxPvVoltage',
          message:
            '⚠️ Hinweis: Am Laderegler ist die maximale PV-Eingangsspannung nicht eingetragen. Die Kalt-Voc-Prüfung (Strings können bei −10 °C über die Leerlaufspannung hinausgehen) ist damit unbewertet. Wert im Regler-Inspektor eintragen — erst dann prüft das Modell das Eingangsfenster.',
        });
        return;
      }
      // Erreichbare Panels per BFS über alle Kanten ab dem Regler.
      const adjacent = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (!adjacent.has(edge.source)) adjacent.set(edge.source, []);
        if (!adjacent.has(edge.target)) adjacent.set(edge.target, []);
        adjacent.get(edge.source)!.push(edge.target);
        adjacent.get(edge.target)!.push(edge.source);
      });
      const visited = new Set<string>([mppt.id]);
      const queue = [mppt.id];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        for (const next of adjacent.get(currentId) ?? []) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
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
          unit: 'V',
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
          unit: '%/K',
          source: 'Modell: Voc(T) = Voc_STC · (1 + |TK|·(25 °C − T)); Faktor muss positiv sein',
          message: `⚠️ Warnung: Bei mindestens einem Panel ist die kalte Leerlaufspannung nicht berechenbar — der eingetragene Temperaturkoeffizient Voc liegt außerhalb des Modellbereichs (üblich sind −0,20 bis −0,50 %/K für c-Si). Die Voc-Fensterprüfung des Ladereglers ist damit AUSGEFALLEN, nicht bestanden. Wert im Panel-Inspektor korrigieren.`,
        });
      }
    });

    // --- Rule A4: RCD/FI am Wechselrichter-Kreis (AUDIT AC-001) ---
    // Rule A2 prüft nur Landstrom-Nodes. Ein Plan „Batterie → Wechselrichter
    // → 230-V-Verbraucher" ohne jedes Fehlerstrom-Schutzorgan erzeugte
    // KEINE Warnung — dabei führt der Inverter-Kreis dieselbe Gefahr
    // (Berührungsschutz 230 V) wie die Landstromseite.
    const acAdjacency = new Map<string, string[]>();
    const addAcLink = (from: string, to: string): void => {
      const list = acAdjacency.get(from) ?? [];
      list.push(to);
      acAdjacency.set(from, list);
    };
    for (const edge of edges) {
      const s = nodeMap.get(edge.source)?.type;
      const t = nodeMap.get(edge.target)?.type;
      const domain = edge.data?.edgeDomain ?? getEdgeDomain(s, t, edge.sourceHandle, edge.targetHandle);
      if (domain !== 'AC_230V') continue;
      addAcLink(edge.source, edge.target);
      addAcLink(edge.target, edge.source);
    }
    const acReachable = (startId: string): Set<string> => {
      const visited = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || visited.has(current)) continue;
        visited.add(current);
        for (const next of acAdjacency.get(current) ?? []) {
          if (!visited.has(next)) queue.push(next);
        }
      }
      return visited;
    };
    inverters.forEach((inverter) => {
      if (inverter.data?.hasRcd) return;
      const island = acReachable(inverter.id);
      let consumerCount = 0;
      island.forEach((id) => {
        if (nodeMap.get(id)?.type === 'consumer230v') consumerCount += 1;
      });
      if (consumerCount === 0) return;
      warnings.push({
        id: `inverter-missing-rcd-${inverter.id}`,
        category: 'safety',
        type: 'critical',
        title: 'FI-Schutz am Wechselrichter fehlt',
        focusId: inverter.id,
        focusType: 'node',
        ruleId: 'AC-001-inverter-rcd',
        measuredValue: `${consumerCount} × 230-V-Verbraucher ohne FI`,
        expectedValue: 'RCD/FI ≤ 30 mA (Typ A) im AC-Ausgangskreis',
        unit: '',
        source: 'Schutz bei indirektem Berühren, 230-V-Fahrzeugkreis (DIN VDE 0100-721-Kontext)',
        message: `⚠️ Kritisch: Der Wechselrichter „${nodeLabel(
          inverter,
          'Wechselrichter'
        )}“ speist ${consumerCount} 230-V-Verbraucher, der AC-Kreis hat aber keinen FI-Schutzschalter (RCD ≤ 30 mA, Typ A). Auch ohne Landstrom besteht Berührungsgefahr an 230 V. Lass diese Schutzmaßnahme von einer Elektrofachkraft einplanen.`,
      });
    });

    // --- Rule A2: RCD / FI-Pflicht an Landstrom (DIN VDE 0100-721) ---
    shorePowerNodes.forEach((sp) => {
      if (!sp.data?.hasRcd) {
        warnings.push({
          id: `missing-rcd-${sp.id}`,
          category: 'safety',
          type: 'critical',
          title: 'FI-Schutzschalter fehlt',
          focusId: sp.id,
          focusType: 'node',
          ruleId: 'A2-shore-rcd',
          measuredValue: 'kein FI',
          expectedValue: 'RCD <= 30 mA',
          unit: 'mA',
          source: 'DIN VDE 0100-721 (Landstromanschluss Wohnmobil)',
          message: `Am Landstromanschluss „${nodeLabel(sp, 'Landstrom')}" fehlt ein FI-Schutzschalter mit höchstens 30 mA (RCD ≤ 30 mA). Nach DIN VDE 0100-721 ist dieser zwingend vorgeschrieben — Stromschlaggefahr. Lass den 230-V-Schutz von einer Elektrofachkraft einplanen.`,
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

    // --- Rule A7: Kurzschlussstrom vs. Abschaltvermögen (AUDIT DOM-002) ---
    // Erster Modellschnitt mit geschätztem Ik (Batterie-Innenwiderstand oder
    // Chemie-Faustformel) und typischen Abschaltvermögen je Bauform —
    // Modellgrenzen und Quellenlage: lib/shortCircuit.ts. Geprüft werden nur
    // Batterie-Plus-Ausgänge mit eingetragener Sicherung: genau dort ist die
    // Sicherung das Trennorgan zwischen dem höchsten Fehlerstrom des Plans
    // und der Installation.
    {
      const bankIk = bankShortCircuitCurrentA(batteries, sysVoltage);
      let fuseTypeNotePushed = false;
      if (bankIk === null && batteries.length > 0) {
        // AUDIT ELE-008: Vorher `break` — die Kurzschlussprüfung verschwand
        // lautlos, sobald die Bank nicht schätzbar war (z. B. leere oder
        // schema-frisch angelegte Batterie). „Ehrlich schweigen“ ist hier
        // nicht ehrlich: der Nutzer sieht nicht, dass GAR NICHT geprüft wurde.
        const hasFuse = edges.some((e) => e.sourceHandle?.includes('plus') && Number(e.data?.fuseSize) > 0);
        if (hasFuse) {
          warnings.push({
            id: 'sc-bank-unknown',
            category: 'estimation',
            type: 'warning',
            title: 'Kurzschlussstrom der Batteriebank nicht schätzbar',
            focusId: batteries[0]?.id,
            focusType: 'node',
            ruleId: 'DOM-002-bank-ik-unknown',
            measuredValue: 'Ik Schätzung nicht möglich',
            expectedValue: 'Kapazität/Chemie oder Innenwiderstand je Batterie',
            unit: 'kA',
            source: 'Modell: Ik-Schätzung aus Innenwiderstand oder Chemie-Faustwert (lib/shortCircuit.ts)',
            message:
              '⚠️ Hinweis: Für die Batteriebank fehlen die Angaben, aus denen der Kurzschlussstrom geschätzt wird (Kapazität/Chemie oder Innenwiderstand). Das Abschaltvermögen der Sicherungen ist damit NICHT geprüft — Datenblattwerte im Batterie-Inspektor eintragen.',
          });
        }
      }
      for (const battery of batteries) {
        if (bankIk === null) break; // Bank nicht schätzbar → geprüft wird unten nichts
        for (const edge of edges) {
          const isBatterySourcePlus = edge.source === battery.id && !!edge.sourceHandle?.includes('plus');
          if (!isBatterySourcePlus) continue;
          const edgeData = edge.data;
          if (!(Number(edgeData?.fuseSize) > 0)) continue;
          const capacity = breakingCapacityAOf(
            edgeData?.fuseType,
            edgeData?.fuseBreakingCapacity,
            sysVoltage
          );
          const ikAtFuse = shortCircuitAtFuseA(
            batteries,
            edgeData?.fuseOffset,
            edgeData?.crossSection,
            sysVoltage
          );
          if (ikAtFuse === null) continue;
          if (capacity === null) {
            // Ohne Bauform/Datenblatt ist das Abschaltvermögen nicht
            // bewertbar — einmal pro Plan als Hinweis (kein Warn-Spam je Kante).
            if (!fuseTypeNotePushed && bankIk > FUSE_BREAKING_CAPACITY_A.ato) {
              fuseTypeNotePushed = true;
              warnings.push({
                id: 'sc-fuse-type-unknown',
                category: 'estimation',
                type: 'warning',
                title: 'Abschaltvermögen der Hauptsicherung unbekannt',
                focusId: battery.id,
                focusType: 'node',
                ruleId: 'DOM-002-fuse-type-unknown',
                measuredValue: `≈ ${(bankIk / 1000).toFixed(1)} kA`,
                expectedValue: 'Bauform bzw. Datenblatt-Abschaltvermögen angeben',
                unit: 'kA',
                source: 'Modell: geschätzter Bank-Kurzschlussstrom (lib/shortCircuit.ts)',
                message: `Hinweis: Die Batteriebank kann im Kurzschlussfall ≈ ${(bankIk / 1000).toFixed(1)} kA liefern (geschätzt aus Innenwiderstand/Faustformel). Ohne Bauform der Hauptsicherung (ATO/MIDI/MEGA/ANL/MRBF/Class T) ist ihr Abschaltvermögen hier nicht geprüft — im Leitungs-Inspektor eintragen.`,
              });
            }
            continue;
          }
          if (ikAtFuse > capacity) {
            warnings.push({
              id: `sc-breaking-${edge.id}`,
              category: 'safety',
              type: 'critical',
              title: 'Abschaltvermögen der Sicherung zu gering',
              focusId: edge.id,
              focusType: 'edge',
              ruleId: 'DOM-002-breaking-capacity',
              measuredValue: `≈ ${Math.round(ikAtFuse)} A`,
              expectedValue: `≤ ${capacity} A`,
              unit: 'A',
              source:
                'ABYC-E-11-AIC-Anforderung; Bauform-Tabelle lib/shortCircuit.ts (typische Herstellerwerte, UNVERIFIED)',
              message: `⚠️ Kritisch: Die Sicherung (Abschaltvermögen ${capacity} A) kann den geschätzten Kurzschlussstrom der Bank am Einbauort (≈ ${Math.round(ikAtFuse)} A) nicht sicher trennen. Bauform mit höherem Abschaltvermögen wählen (z. B. Class T ≈ 20 kA) oder Datenblatt-Wert eintragen.`,
            });
          }
        }
      }
    }

    // --- Rule A8: AC-Abschaltbedingung / Mehrleiter-Schutz (AUDIT DOM-001) ---
    // Bisher waren AC-Kanten Einleiter-Abstraktionen mit einem Zahlenfeld
    // als „Sicherung". Jetzt wird die Abschaltbedingung (IEC 60364-4-41,
    // TN: Zs·Ia ≤ U0, 2/3-Regel) geschätzt bewertet: Leitungsanteil über
    // Phase+PE (Tabelle 54.2), vorgelagerte Netzimpedanz als deklarierte
    // Annahme. Sonderfälle ehrlich: Wechselrichter-Ausgang (elektronisch
    // begrenzt) und 30-mA-FI am Einspeisepunkt (oder RCBO) decken den
    // Fehlerschutz. FI-Deckung ≠ Messpflicht-Freischein: 'rcd-covered'
    // bleibt ein Hinweis, kein OK.
    {
      const anyUpstreamRcd = [...shorePowerNodes, ...chargers].some((n) => n.data?.hasRcd === true);
      // AUDIT N1: ein angegebener/gemessener prospektiver Kurzschlussstrom an
      // der Einspeisestelle schlägt beide Netzimpedanz-Annahmen. Er ist eine
      // Eigenschaft der Einspeisung, nicht der einzelnen Leitung — mehrere
      // Landstrom-Knoten ergeben den ungünstigsten (größten) bekannten Wert.
      const declaredIkValues = shorePowerNodes
        .map((n) => n.data?.prospectiveIkA)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      const supplyProspectiveIkA = declaredIkValues.length > 0 ? Math.max(...declaredIkValues) : undefined;
      let acProtectionNotePushed = false;
      let acLengthNotePushed = false;
      let acAssumptionNotePushed = false;
      let acReachNotePushed = false;
      for (const edge of edges) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        const isAc =
          (edge.data?.edgeDomain ??
            getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle)) ===
          'AC_230V';
        if (!isAc) continue;

        // Wechselrichter-Ausgänge erzeugen bewusst KEINEN Statushinweis:
        // das „Auto-Wired-Plan ist meldungsfrei"-Versprechen (Szenario-Tests)
        // gilt weiter; das Modelllimit steht sichtbar am Kanten-Chip
        // (elektronisch begrenzt → Hersteller-Datenblatt beachten). Die
        // Schätzung selbst verweigert dort ebenfalls ('inverter-limited').
        const sourceKind = acSourceKindOf(sourceNode?.type);

        const rated = Number(edge.data?.fuseSize);
        if (!(rated > 0)) continue; // ungesicherte AC-Kante: bestehender Status quo (FI/LS-Hinweis im Chip)
        const assessment = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          descriptor: edge.data?.acProtection,
          lengthM: typeof edge.data?.length === 'number' ? edge.data.length : undefined,
          crossSection: typeof edge.data?.crossSection === 'number' ? edge.data.crossSection : undefined,
          sourceKind,
          upstreamRcd: anyUpstreamRcd,
          supplyProspectiveIkA,
        });

        const fmt = (value: number | null) => (value === null ? '—' : `≈ ${value.toFixed(2)} Ω`);
        const base = {
          focusId: edge.id,
          focusType: 'edge' as const,
          unit: 'Ω',
          source: `Schätzung nach IEC 60364-4-41 (Zs·Ia ≤ U0, 2/3-Regel); vorgelagert angenommen ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω, PE nach IEC 60364-5-54 Tab. 54.2; lib/acProtection.ts`,
        };

        // AUDIT N1: Reichweitengrenze der Abschaltvermögens-Prüfung. Ohne
        // gemessenen I_k kann das Modell nur gegen die hochohmige Annahme
        // (Campingplatz-Pitch) prüfen; reicht Icn nicht bis zur
        // Niederimpedanz-Grenze, ist das ein Hinweis auf die Reichweite des
        // Verdikts — kein Datenfehler und kein PASS ohne Anmerkung.
        if (
          assessment.limitation === 'breaking-capacity-reach' &&
          assessment.verdict !== 'breaking-capacity-fail'
        ) {
          if (!acReachNotePushed) {
            acReachNotePushed = true;
            warnings.push({
              ...base,
              id: 'ac-breaking-capacity-reach',
              category: 'estimation',
              type: 'warning',
              title: 'Abschaltvermögen nur für hochohmige Einspeisung nachgewiesen',
              focusId: edge.id,
              focusType: 'edge',
              ruleId: 'DOM-001-breaking-capacity-reach',
              measuredValue:
                assessment.prospectiveIkA !== null
                  ? `I_p ≈ ${(assessment.prospectiveIkA / 1000).toFixed(2)} kA (Annahme)`
                  : '—',
              expectedValue:
                assessment.prospectiveIkUpperBoundA !== null
                  ? `Icn ≥ ${(assessment.prospectiveIkUpperBoundA / 1000).toFixed(2)} kA bei niederimpedanter Einspeisung`
                  : 'Icn ≥ I_p',
              source: `Zwei deklarierte Annahmen in lib/acProtection.ts: ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω vorgelagert (Campingplatz-Pitch, typisch) und ${UPSTREAM_IMPEDANCE_MIN_OHM} Ω (Niederimpedanz-Grenze: netznahe Einspeisung/Generator). Ein gemessener I_k am Landstrom-Knoten schlägt beide.`,
              message: `Hinweis: ${assessment.reason} Trage den gemessenen oder vom Platzbetreiber genannten prospektiven Kurzschlussstrom am Landstrom-Knoten ein, um die Prüfung scharf zu stellen — sonst gilt sie nur für den hochohmigen Einspeisefall.`,
            });
          }
        }

        switch (assessment.verdict) {
          case 'fail':
            warnings.push({
              ...base,
              id: `ac-trip-${edge.id}`,
              category: 'safety',
              type: 'critical',
              title: 'AC-Abschaltbedingung nicht gesichert (Schleifenimpedanz)',
              ruleId: 'DOM-001-trip-condition',
              measuredValue: fmt(assessment.zsEstimateOhm),
              expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω (Ia = ${Math.round(assessment.iaA ?? 0)} A)`,
              message: `⚠️ Kritisch: ${assessment.reason} Die geschätzte magnetische Abschaltung des LS-Schalters ist im Fehlerfall nicht gesichert — 30-mA-FI am Landstromanschluss aktivieren oder FI/LS (RCBO) statt LS wählen, Schleifenimpedanz vor Ort messen lassen. Ohne FI kann ein Körperschluss die Leitung dauerhaft gefährlich spannungsführend halten.`,
            });
            break;
          case 'borderline':
            warnings.push({
              ...base,
              id: `ac-trip-${edge.id}`,
              category: 'estimation',
              type: 'warning',
              title: 'AC-Abschaltbedingung knapp (Leitungslänge treibt Schleifenimpedanz)',
              ruleId: 'DOM-001-trip-borderline',
              measuredValue: fmt(assessment.zsEstimateOhm),
              expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω`,
              message: `Hinweis: ${assessment.reason} Die Abschaltung hängt damit an der angenommenen Netzimpedanz — Schleifenimpedanz messen lassen oder Leitung kürzen/verstärken.`,
            });
            break;
          case 'rcd-covered':
            warnings.push({
              ...base,
              id: `ac-trip-rcd-${edge.id}`,
              category: 'estimation',
              type: 'info',
              title: 'AC-Fehlerschutz über 30-mA-FI gedeckt (TN-Grenze überschritten)',
              ruleId: 'DOM-001-trip-rcd-covered',
              measuredValue: fmt(assessment.zsEstimateOhm),
              expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω`,
              message: `Hinweis: ${assessment.reason}`,
            });
            break;
          case 'ok-with-assumption': {
            // Ohne Datenblatt wird mit der konservativen C-Annahme gerechnet
            // (AUDIT ELE-004) — das Ergebnis ist dann KEIN stilles OK, sondern
            // eine ausdrücklich benannte Annahme (Regel M: Annahme ja,
            // Schweigen nein).
            if (assessment.descriptorAssumed && !acAssumptionNotePushed) {
              acAssumptionNotePushed = true;
              warnings.push({
                ...base,
                id: 'ac-descriptor-assumed',
                category: 'estimation',
                type: 'warning',
                title: 'AC-Schutzorgan ohne Datenblatt — unter Annahme geprüft',
                focusId: edge.id,
                focusType: 'edge',
                ruleId: 'DOM-001-descriptor-assumed',
                measuredValue: 'LS C, 6 kA (Annahme)',
                expectedValue: 'Bauform (LS/RCBO), Charakteristik B/C, Icn laut Datenblatt',
                source:
                  'Annahme in lib/acProtection.ts: ungünstigste übliche Charakteristik C (10 × In) statt B (5 × In) — Zs,max(C16) = 0,96 Ω statt 1,92 Ω. Eine Leitung, die damit besteht, besteht auch mit jedem real verbauten B-Gerät.',
                message: `Hinweis: Für mindestens eine 230-V-Leitung ist kein Schutzorgan hinterlegt. Gerechnet wurde deshalb mit der UNGÜNSTIGSTEN üblichen Charakteristik (LS C, 6 kA) — das Ergebnis liegt damit auf der sicheren Seite, ist aber eine Annahme. Trage Bauform, Charakteristik und Abschaltvermögen im Leitungs-Inspektor ein, dann prüft der Plan gegen das echte Gerät.`,
              });
            }
            break;
          }
          case 'not-modeled': {
            // Jede Lücke wird benannt und einmal je Plan gemeldet. Der Grund
            // entscheidet über Text und Fokus: „Länge fehlt“ ist eine andere
            // Aufgabe als „Bauform fehlt“ (AUDIT ELE-002/003/004).
            const limitation = assessment.limitation;
            if (limitation === 'missing-length' || limitation === 'missing-cross-section') {
              if (!acLengthNotePushed) {
                acLengthNotePushed = true;
                warnings.push({
                  ...base,
                  id: `ac-missing-input-${limitation}`,
                  category: 'safety',
                  // Bewusst `warning`, nicht `info`: ohne Länge/Querschnitt ist
                  // die Abschaltbedingung UNBEKANNT — ein Plan, der hier
                  // schweigt, sieht geprüft aus, ist es aber nicht.
                  type: 'warning',
                  title:
                    limitation === 'missing-length'
                      ? 'AC-Leitung ohne Länge — Abschaltung nicht bewertet'
                      : 'AC-Leitung ohne Querschnitt — Abschaltung nicht bewertet',
                  ruleId: 'DOM-001-trip-unknown-input',
                  measuredValue: limitation === 'missing-length' ? 'Länge fehlt' : 'Querschnitt fehlt',
                  expectedValue: 'Länge [m] und Querschnitt [mm²] an der Leitung',
                  source:
                    'Regel M (kein stiller Fallback): fehlende Eingabe ⇒ UNKNOWN, niemals PASS; lib/acProtection.ts',
                  message: `${assessment.reason} Ohne diese Angabe ist die Abschaltbedingung der 230-V-Leitung unbekannt — der Plan darf sie nicht als geprüft ausweisen.`,
                });
              }
              break;
            }
            if (!acProtectionNotePushed) {
              acProtectionNotePushed = true;
              warnings.push({
                ...base,
                id: 'ac-protection-not-modeled',
                category: 'estimation',
                type: 'info',
                title: 'AC-Schutzorgan ohne Bauform — Abschaltbedingung unbewertet',
                focusId: edge.id,
                focusType: 'edge',
                ruleId: 'DOM-001-protection-not-modeled',
                measuredValue: 'Sicherung als Zahl',
                expectedValue: 'Bauform (LS/RCBO), Charakteristik B/C, Icn 6/10 kA',
                source:
                  'DOM-001: AC-Schutzdaten fehlen — Bewertung erst mit Datenblatt-Angaben (Edge-Inspektor)',
                message: `Hinweis: Für mindestens eine 230-V-Leitung ist die Sicherung nur als Bemessungsstrom eingetragen. Bauform (LS oder FI/LS), Charakteristik (B/C) und Abschaltvermögen im Leitungs-Inspektor angeben — erst dann wird die Abschaltbedingung geschätzt geprüft (IEC 60898-1 / 60364-4-41). Ohne diese Angaben ist sie UNBEKANNT, nicht erfüllt.`,
              });
            }
            break;
          }
          case 'breaking-capacity-fail': {
            warnings.push({
              ...base,
              id: `ac-breaking-${edge.id}`,
              category: 'safety',
              type: 'critical',
              title: 'Abschaltvermögen des AC-Schutzorgans zu gering',
              ruleId: 'DOM-001-breaking-capacity',
              measuredValue: `Icn ${edge.data?.acProtection?.breakingCapacityKA} kA`,
              expectedValue: `> I_p ≈ ${((assessment.prospectiveIkA ?? 0) / 1000).toFixed(2)} kA`,
              unit: 'kA',
              message: `⚠️ Kritisch: ${assessment.reason} Schutzorgan mit höherem Abschaltvermögen wählen (üblich 6 kA) oder die Netzimpedanz vor Ort messen lassen.`,
            });
            break;
          }
        }
      }
    }

    // --- Rule SIZE: verlegter Querschnitt gegen Anforderung (AUDIT ELE-001) ---
    //
    // Bis hierher wurde der QUERSCHNITT nirgends gegen die Rechnung verglichen:
    // Anzeige, Spannungsfall und Sicherungsgrenze liefen alle über
    // `calculateCrossSection(…, data.crossSection)`, und das ist das Maximum
    // aus Empfehlung und gespeichertem Wert. Eine zu dünn gespeicherte Leitung
    // (2,5 mm² gespeichert, 10 mm² gerechnet) zeigte damit 10 mm², 2,87 %
    // Spannungsfall und 32 A Maximalsicherung — real verlegt waren 2,5 mm² mit
    // 11,49 % und höchstens 16 A. Diese Regel vergleicht beide Zahlen
    // ausdrücklich und meldet die Differenz als kritisch.
    {
      const nodePos = (id: string) => nodeMap.get(id)?.position;
      const geometricLength = (edge: Edge<CableEdgeData>): number | undefined => {
        const a = nodePos(edge.source);
        const b = nodePos(edge.target);
        if (!a || !b) return undefined;
        return Math.hypot(b.x - a.x, b.y - a.y) / PX_PER_METER;
      };

      for (const edge of edges) {
        if (edge.type === 'waterPipe') continue;
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) continue;
        const domain =
          edge.data?.edgeDomain ??
          getEdgeDomain(sourceNode.type, targetNode.type, edge.sourceHandle, edge.targetHandle);
        // Solar-Zuleitungen werden an der MPP-Spannung und mit dem
        // Designstrom (≥ 1,25 × Isc) bemessen — eigene Regelkette, nicht hier.
        if (domain === 'Solar') continue;

        const isAC = domain === 'AC_230V';
        const I = isAC
          ? acCurrentA(sourceNode, targetNode, nodes, edges)
          : calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage, edges);
        if (!(I > 0)) continue;

        // Wie in der Anzeige: gespeicherte Länge, sonst geometrische Schätzung.
        const rawLength = edge.data?.length;
        const storedLength = typeof rawLength === 'number' && rawLength >= 0 ? rawLength : undefined;
        const length = storedLength ?? geometricLength(edge);
        if (length === undefined || !(length >= 0)) continue;

        const storedCs =
          typeof edge.data?.crossSection === 'number' && edge.data.crossSection > 0
            ? edge.data.crossSection
            : undefined;
        const selection = assessCableSelection(I, length, storedCs, isAC ? 'AC_230V' : 'DC_12V');
        const lengthNote = storedLength === undefined ? ' (Länge geschätzt)' : '';

        if (selection.undersized) {
          warnings.push({
            id: `cross-section-undersized-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Kabelquerschnitt zu klein verlegt',
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'ELE-001-undersized-cross-section',
            measuredValue: `${storedCs} mm²`,
            expectedValue: `${selection.recommendedCrossSection} mm²`,
            unit: 'mm²',
            source:
              'Modell: max(Spannungsfall-Budget, Iz = Tabellenwert × 0,7) — verlegt ist der gespeicherte Querschnitt',
            message: `⚠️ Kritisch: Verlegt sind ${storedCs} mm², gefordert sind ${selection.recommendedCrossSection} mm² (Spannungsfall/Thermik bei ${Math.round(
              I
            )} A über ${length.toFixed(1)} m${lengthNote}). Der reale Spannungsfall und die zulässige Sicherung sind am verbauten Querschnitt gerechnet — Querschnitt im Leitungs-Inspektor anheben (oder Länge kürzen).`,
          });
        }

        if (isThermallyOverloaded(I, selection.installedCrossSection)) {
          const iz = designAmpacity(selection.installedCrossSection);
          warnings.push({
            id: `thermal-overload-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Leitung thermisch überlastet',
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'ELE-002-thermal-overload',
            measuredValue: `${Math.round(I)} A`,
            expectedValue: `${Math.round(iz)} A`,
            unit: 'A',
            source: 'Modell: Iz = Tabellenwert × 0,7 (lib/electrical.ts, DIN VDE 0298-4-Belastbarkeiten)',
            message: `⚠️ Kritisch: Die Leitung (${selection.installedCrossSection} mm²) führt ${Math.round(
              I
            )} A, dauerhaft zulässig sind ${Math.round(
              iz
            )} A (Tabellenwert × 0,7 für Bündelung/Temperatur). Last reduzieren, Parallelverlegung planen oder — falls möglich — den nächsten Normquerschnitt über 70 mm² wählen.`,
          });
        }

        // AutoWire-Marker (AUDIT ELE-009): `dropWarning`/`fuseWarning` wurden
        // vierfach geschrieben und von NICHTS gelesen — die Markierung war ein
        // stiller Datenwert. Hier werden beide sichtbar.
        if (edge.data?.dropWarning) {
          warnings.push({
            id: `drop-not-solvable-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Spannungsfall-Budget nicht auflösbar',
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'AUTO-003-drop-warning',
            measuredValue: '3 %-Budget gerissen',
            expectedValue: '≤ 3 % bis zum Verbraucher',
            unit: '%',
            source: 'AutoWire-Dimensionierung (lib/autoWire/sizing.ts): Pfad bleibt bei 70 mm² über Budget',
            message:
              '⚠️ Kritisch: Auch mit dem größten Normquerschnitt (70 mm²) bleibt der Spannungsfall auf dieser Versorgungskette über dem 3-%-Budget. Die Last ist an 12 V so nicht ausführbar — kürzere Wege, Querschnitt-Erhöhung über die Normreihe oder eine höhere Systemspannung planen.',
          });
        }
        if (edge.data?.fuseWarning) {
          warnings.push({
            id: `fuse-not-possible-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Keine Normsicherung kann den Laststrom schützen',
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'ELE-001-fuse-not-feasible',
            measuredValue: `${Math.round(I)} A`,
            expectedValue: `≤ ${designAmpacity(selection.installedCrossSection) > 0 ? Math.round(Math.min(designAmpacity(selection.installedCrossSection), I)) : '—'} A`,
            unit: 'A',
            source:
              'Modell: I_B ≤ I_n ≤ I_z = 0,7 × Tabellenwert; AutoWire markiert hier eine nicht ausführbare Dimensionierung',
            message: `⚠️ Kritisch: Für diese Leitung existiert keine zulässige Normsicherung: der Laststrom (≈ ${Math.round(
              I
            )} A) liegt über der Absicherungsgrenze des größten Normquerschnitts. Die Leitung ist so nicht schutzfähig — Last aufteilen, Parallelverlegung/Sammelschiene planen oder die Systemspannung erhöhen.`,
          });
        }
      }
    }

    // --- Rule C: Battery Capacity Alert ---
    if (batteries.length > 0 && consumers.length > 0) {
      const totalBatteryAh = batteries.reduce((acc, node) => acc + (Number(node.data.capacity) || 0), 0);

      // Calculate daily Ah consumption using dynamic system voltage
      const totalDailyAh = consumers.reduce((acc, node) => {
        const watts = Number(node.data.watts) || 0;
        const hours = Number(node.data.hours) || 4; // default to 4 hours
        return acc + (watts * hours) / sysVoltage;
      }, 0);

      if (totalDailyAh > totalBatteryAh) {
        warnings.push({
          id: 'battery-capacity',
          category: 'estimation',
          type: 'info',
          title: 'Batterie könnte knapp werden',
          focusId: batteries[0]?.id,
          focusType: 'node',
          message: `💡 Tipp: Deine Batterie könnte knapp werden. Verbrauch: ~${Math.round(totalDailyAh)}Ah/Tag (geschätzt), Batterie: ${totalBatteryAh}Ah.`,
        });
      }
    }

    // --- Rule G: Inverter Protection ---
    inverters.forEach((inverter) => {
      const targetEdges = edgesByTarget.get(inverter.id) || [];
      const incomingPlusEdges = targetEdges.filter((e) => e.targetHandle?.includes('plus'));
      const incomingMinusEdges = targetEdges.filter((e) => e.targetHandle?.includes('minus'));

      if (incomingMinusEdges.length === 0) {
        warnings.push({
          id: `inverter-no-minus-${inverter.id}`,
          category: 'topology',
          type: 'warning',
          title: 'Wechselrichter: Minus fehlt',
          focusId: inverter.id,
          focusType: 'node',
          message: `⚠️ Hinweis: Dem Wechselrichter fehlt die Rückleitung (Minuspol).`,
        });
      }

      incomingPlusEdges.forEach((edge) => {
        let isProtected = false;
        if (edge.data?.fuseSize) {
          isProtected = true;
        } else {
          const sourceNode = nodeMap.get(edge.source);
          if (sourceNode?.type === 'fuse') {
            isProtected = true;
          }
        }

        if (!isProtected) {
          warnings.push({
            id: `inverter-unprotected-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Wechselrichter ohne Sicherung',
            focusId: edge.id,
            focusType: 'edge',
            message: `⚠️ Kritisch: Direkter Batterie-zu-Inverter-Pfad! Der Wechselrichter muss zwingend über eine eigene Sicherung abgesichert sein.`,
          });
        }
      });
    });

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

    // --- Rule F: Der Shunt wird umgangen ---
    // Nur die Aufbaubatterie, an der der Shunt hängt. Die Starterbatterie
    // des Ladeboosters führt Minus fachgerecht direkt und ist kein Bypass.
    if (shunts.length > 0) {
      const shuntBatteryIds = new Set<string>();
      for (const shunt of shunts) {
        const connectedEdges = [
          ...(edgesByTarget.get(shunt.id) || []),
          ...(edgesBySource.get(shunt.id) || []),
        ];
        for (const edge of connectedEdges) {
          const otherId = edge.source === shunt.id ? edge.target : edge.source;
          if (nodeMap.get(otherId)?.type === 'battery') {
            shuntBatteryIds.add(otherId);
          }
        }
      }
      const isStarterBatteryNode = (n: Node | undefined) => /starter/i.test(String(nodeLabel(n, '')));
      const isMonitoredBattery = (n: Node | undefined) => {
        if (!n || n.type !== 'battery' || isStarterBatteryNode(n)) return false;
        if (shuntBatteryIds.size === 0) return true;
        return shuntBatteryIds.has(n.id);
      };

      edges.forEach((edge) => {
        const targetNode = nodeMap.get(edge.target);
        const sourceNode = nodeMap.get(edge.source);

        const sourceIsMonitoredMinus =
          isMonitoredBattery(sourceNode) && !!edge.sourceHandle?.includes('minus');
        const targetIsMonitoredMinus =
          isMonitoredBattery(targetNode) && !!edge.targetHandle?.includes('minus');

        if (sourceIsMonitoredMinus || targetIsMonitoredMinus) {
          const otherNode = sourceIsMonitoredMinus ? targetNode : sourceNode;
          if (otherNode && otherNode.type !== 'shunt' && otherNode.type !== 'battery') {
            warnings.push({
              id: `shunt-bypass-${edge.id}`,
              category: 'monitoring',
              type: 'critical',
              title: 'Shunt wird umgangen',
              focusId: edge.id,
              focusType: 'edge',
              message: `⚠️ Kritisch: Der Shunt wird umgangen! Relevante Minus-Verbindungen (wie von ${nodeLabel(otherNode, '?')}) dürfen nicht am Shunt vorbei direkt an Batterie-Minus hängen.`,
            });
          }
        }
      });
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

    return warnings;
  }, [nodes, edges]);
}
